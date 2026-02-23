#!/usr/bin/env python3
"""Fetch LeekWars fight history for Dalton leeks and build rankings."""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_URL = "https://leekwars.com/api"
DATA_DIR = Path(__file__).parent / "data"
CONFIG_PATH = Path(__file__).parent / "config.json"
CACHE_PATH = DATA_DIR / "cache.json"
RANKINGS_PATH = DATA_DIR / "rankings.json"

REQUEST_DELAY = 1.0
MAX_RETRIES = 3
BACKOFF_BASE = 5


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_cache():
    if CACHE_PATH.exists():
        with open(CACHE_PATH) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    DATA_DIR.mkdir(exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def load_rankings():
    if RANKINGS_PATH.exists():
        with open(RANKINGS_PATH) as f:
            return json.load(f)
    return {"last_updated": None, "daltons": {}, "farmer_ranking": []}


def save_rankings(rankings):
    DATA_DIR.mkdir(exist_ok=True)
    with open(RANKINGS_PATH, "w") as f:
        json.dump(rankings, f, indent=2)


def api_request(session, endpoint, retries=MAX_RETRIES):
    for attempt in range(retries):
        time.sleep(REQUEST_DELAY)
        r = session.get(f"{BASE_URL}/{endpoint}")
        if r.status_code == 429:
            wait = BACKOFF_BASE * (2 ** attempt)
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        return r.json()
    print(f"  Failed after {retries} retries for {endpoint}")
    return None


def login(session):
    login_name = os.environ.get("LEEKWARS_LOGIN")
    password = os.environ.get("LEEKWARS_PASSWORD")
    if not login_name or not password:
        print("Error: LEEKWARS_LOGIN and LEEKWARS_PASSWORD env vars required")
        sys.exit(1)

    r = session.post(
        f"{BASE_URL}/farmer/login-token",
        data={"login": login_name, "password": password},
    )
    data = r.json()
    if "token" not in data:
        print(f"Login failed: {data.get('error', 'unknown error')}")
        sys.exit(1)

    session.headers["Authorization"] = f"Bearer {data['token']}"
    print(f"Logged in as {data['farmer']['login']}")
    return data["farmer"]


def count_turns(fight):
    """Count turns from data.actions."""
    actions = fight.get("data", {}).get("actions", [])
    turns = 0
    for action in actions:
        if isinstance(action, list) and len(action) >= 2 and action[0] == 6:
            turns = action[1]
    return turns


def extract_challenger_info(fight, dalton_leek_ids):
    """Extract challenger info from a fight where the Dalton side lost.

    Uses leeks1/leeks2 arrays (leek objects with id, name, level, farmer).
    """
    winner = fight.get("winner", -1)
    if winner not in (1, 2):
        return None  # pending, draw, or unknown

    leeks1 = fight.get("leeks1", [])
    leeks2 = fight.get("leeks2", [])

    # Find which team the Dalton is on
    dalton_team = None
    for leek in leeks1:
        if leek.get("id") in dalton_leek_ids:
            dalton_team = 1
            break
    if dalton_team is None:
        for leek in leeks2:
            if leek.get("id") in dalton_leek_ids:
                dalton_team = 2
                break

    if dalton_team is None:
        return None

    # Dalton's team must have lost
    if winner == dalton_team:
        return None

    # Challenger is the winning team
    challenger_leeks_raw = leeks2 if dalton_team == 1 else leeks1
    fight_type = fight.get("type", 0)  # 0=solo, 1=farmer, 2=team

    challenger_leeks = []
    farmer_name = None
    farmer_id = None
    for leek in challenger_leeks_raw:
        challenger_leeks.append({
            "id": leek.get("id"),
            "name": leek.get("name", "?"),
            "level": leek.get("level", 0),
        })
        if farmer_name is None:
            farmer_name = leek.get("farmer_name")
            farmer_id = leek.get("farmer")

    if not challenger_leeks:
        return None

    # farmer_name may not be in leeks1/2 — we'll fill it from report if needed
    if farmer_name is None:
        # Check farmers1/farmers2
        farmers = fight.get("farmers1", {}) if dalton_team == 2 else fight.get("farmers2", {})
        if isinstance(farmers, dict):
            for fid, fdata in farmers.items():
                farmer_id = int(fid)
                farmer_name = fdata.get("name", "?") if isinstance(fdata, dict) else "?"
                break

    return {
        "fight_id": fight.get("id"),
        "fight_type": fight_type,
        "farmer_name": farmer_name or "?",
        "farmer_id": farmer_id,
        "leeks": challenger_leeks,
        "total_level": sum(l["level"] for l in challenger_leeks),
        "turns": count_turns(fight),
        "date": fight.get("date", 0),
    }


def ranking_key(entry):
    """Sort key: level ASC, then turns ASC."""
    return (entry["total_level"], entry["turns"])


def merge_rankings(existing, new_entries):
    """Merge new entries, keeping best per unique key.

    Also migrates old composite keys (e.g. "53189_71600") to farmer-only
    keys ("53189"), deduplicating by best score.
    """
    by_key = {}
    for e in existing:
        # Migrate old "farmerId_leekId" keys to farmer-only
        key = e["key"]
        if "_" in key and "farmer_id" in e:
            key = str(e["farmer_id"])
            e["key"] = key
        if key not in by_key or ranking_key(e) < ranking_key(by_key[key]):
            by_key[key] = e
    for entry in new_entries:
        key = entry["key"]
        if key not in by_key or ranking_key(entry) < ranking_key(by_key[key]):
            by_key[key] = entry
    return sorted(by_key.values(), key=ranking_key)


def fetch_and_process_history(session, endpoint, cache_key, dalton_leek_ids, cache, type_filter=None):
    """Fetch fight history, get details for new fights, extract Dalton losses."""
    data = api_request(session, endpoint)
    if data is None:
        print(f"  Failed to get history from {endpoint}")
        return []

    fights = data.get("fights", [])
    print(f"  Found {len(fights)} fights in history")

    cached_ids = set(cache.get(cache_key, []))
    new_fights = [f for f in fights if f["id"] not in cached_ids]
    # Pre-filter by type from history entry if requested
    if type_filter is not None:
        new_fights = [f for f in new_fights if f.get("type") == type_filter]
    print(f"  {len(new_fights)} new fights to process")

    entries = []
    for hist_fight in new_fights:
        fight_id = hist_fight["id"]
        fight_data = api_request(session, f"fight/get/{fight_id}")
        if not isinstance(fight_data, dict):
            cached_ids.add(fight_id)
            continue

        info = extract_challenger_info(fight_data, dalton_leek_ids)
        if info:
            entries.append(info)
            leek_desc = ", ".join(f"{l['name']}(L{l['level']})" for l in info["leeks"])
            print(f"  Loss: {info['farmer_name']} with {leek_desc} in {info['turns']}t")

        cached_ids.add(fight_id)

    cache[cache_key] = list(cached_ids)
    return entries


def process_dalton_leek(session, dalton, dalton_leek_ids, cache, rankings):
    """Process solo fight history for one Dalton leek."""
    leek_id = dalton["leek_id"]
    name = dalton["name"]
    print(f"\nProcessing {name} (ID: {leek_id}) — solo fights...")

    entries = fetch_and_process_history(
        session, f"history/get-leek-history/{leek_id}",
        f"leek_{leek_id}", dalton_leek_ids, cache, type_filter=0
    )

    # Key by farmer_id for solo (best entry per farmer)
    for e in entries:
        if len(e["leeks"]) == 1:
            e["key"] = str(e["farmer_id"])
            e["leek_name"] = e["leeks"][0]["name"]
            e["leek_level"] = e["leeks"][0]["level"]

    solo_entries = [e for e in entries if "key" in e]

    existing = rankings.get("daltons", {}).get(str(leek_id), [])
    updated = merge_rankings(existing, solo_entries)
    rankings.setdefault("daltons", {})[str(leek_id)] = updated
    print(f"  Solo rankings: {len(updated)} entries")


def process_farmer(session, farmer_config, dalton_leek_ids, cache, rankings):
    """Process farmer fight history for the Dalton farmer."""
    farmer_id = farmer_config["farmer_id"]
    name = farmer_config["name"]
    print(f"\nProcessing farmer {name} (ID: {farmer_id}) — farmer fights...")

    entries = fetch_and_process_history(
        session, f"history/get-farmer-history/{farmer_id}",
        f"farmer_{farmer_id}", dalton_leek_ids, cache, type_filter=1
    )

    # Key by farmer_id for farmer ranking
    for e in entries:
        e["key"] = str(e["farmer_id"])
        e["leek_names"] = ", ".join(l["name"] for l in e["leeks"])

    existing = rankings.get("farmer_ranking", [])
    updated = merge_rankings(existing, entries)
    rankings["farmer_ranking"] = updated
    print(f"  Farmer rankings: {len(updated)} entries")


def main():
    config = load_config()
    cache = load_cache()
    rankings = load_rankings()

    session = requests.Session()
    login(session)

    dalton_leek_ids = {d["leek_id"] for d in config["daltons"]}

    for dalton in config["daltons"]:
        process_dalton_leek(session, dalton, dalton_leek_ids, cache, rankings)

    if "farmer" in config:
        process_farmer(session, config["farmer"], dalton_leek_ids, cache, rankings)

    rankings["last_updated"] = datetime.now(timezone.utc).isoformat()
    rankings["daltons_config"] = config["daltons"]
    rankings["farmer_config"] = config.get("farmer")

    save_cache(cache)
    save_rankings(rankings)
    print(f"\nDone! Rankings saved to {RANKINGS_PATH}")


if __name__ == "__main__":
    main()
