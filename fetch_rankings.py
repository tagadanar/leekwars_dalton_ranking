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

# Rate limiting
REQUEST_DELAY = 1.0  # seconds between requests
MAX_RETRIES = 3
BACKOFF_BASE = 5  # seconds


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
    return {"last_updated": None, "daltons": {}}


def save_rankings(rankings):
    DATA_DIR.mkdir(exist_ok=True)
    with open(RANKINGS_PATH, "w") as f:
        json.dump(rankings, f, indent=2)


def api_request(session, endpoint, retries=MAX_RETRIES):
    """Make an API request with rate limiting and retry on 429."""
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
    """Authenticate and return session with auth headers."""
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


def get_fight_type(fight):
    """Determine fight type: 'solo', 'farmer', or 'other'."""
    context = fight.get("context", "")
    fight_type = fight.get("type", 0)
    # type 0 = solo, type 1 = farmer, type 2 = team
    if fight_type == 0:
        return "solo"
    elif fight_type == 1:
        return "farmer"
    return "other"


def count_turns(actions):
    """Count number of turns from actions array."""
    turns = 0
    for action in actions:
        if isinstance(action, list) and len(action) >= 2 and action[0] == 6:
            turns = action[1]
    return turns


def extract_challenger_info(fight, dalton_leek_id):
    """Extract challenger info from a fight where the Dalton lost.

    Returns None if the Dalton didn't lose, or dict with challenger info.
    """
    winner = fight.get("winner", -1)
    if winner == -1 or winner == 0:
        return None  # pending or draw

    leeks = fight.get("leeks", {})
    team1 = fight.get("team1", [])
    team2 = fight.get("team2", [])

    # Find which team the Dalton is on
    dalton_team = None
    dalton_id_str = str(dalton_leek_id)
    for lid in team1:
        if str(lid) == dalton_id_str:
            dalton_team = 1
            break
    if dalton_team is None:
        for lid in team2:
            if str(lid) == dalton_id_str:
                dalton_team = 2
                break

    if dalton_team is None:
        return None  # Dalton not found in fight

    # Check if the Dalton's team lost
    if winner == dalton_team:
        return None  # Dalton won, skip

    # Challenger team is the other team
    challenger_team_ids = team2 if dalton_team == 1 else team1

    # Leeks dict uses string keys
    challenger_leeks = []
    farmer_name = None
    farmer_id = None
    for lid in challenger_team_ids:
        lid_str = str(lid)
        if lid_str in leeks:
            leek = leeks[lid_str]
            challenger_leeks.append({
                "id": lid,
                "name": leek.get("name", "?"),
                "level": leek.get("level", 0),
            })
            if farmer_name is None:
                farmer_name = leek.get("farmer_name", leek.get("owner_name", "?"))
                farmer_id = leek.get("farmer", leek.get("owner", None))

    if not challenger_leeks:
        return None

    fight_type = get_fight_type(fight)
    turns = count_turns(fight.get("actions", []))
    fight_date = fight.get("date", 0)

    return {
        "fight_id": fight.get("id"),
        "fight_type": fight_type,
        "farmer_name": farmer_name,
        "farmer_id": farmer_id,
        "leeks": challenger_leeks,
        "total_level": sum(l["level"] for l in challenger_leeks),
        "turns": turns,
        "date": fight_date,
    }


def ranking_key(entry):
    """Sort key: level ASC, then turns ASC."""
    return (entry["total_level"], entry["turns"])


def merge_rankings(existing, new_entries):
    """Merge new entries into existing rankings, keeping best per unique challenger.

    For solo: key is (farmer_id, leek_id) - best attempt per leek
    For farmer: key is farmer_id - best attempt per farmer
    """
    solo = {e["key"]: e for e in existing.get("solo", [])}
    farmer = {e["key"]: e for e in existing.get("farmer", [])}

    for entry in new_entries:
        if entry["fight_type"] == "solo" and len(entry["leeks"]) == 1:
            key = f"{entry['farmer_id']}_{entry['leeks'][0]['id']}"
            entry["key"] = key
            entry["leek_name"] = entry["leeks"][0]["name"]
            entry["leek_level"] = entry["leeks"][0]["level"]
            if key not in solo or ranking_key(entry) < ranking_key(solo[key]):
                solo[key] = entry
        elif entry["fight_type"] == "farmer":
            key = str(entry["farmer_id"])
            entry["key"] = key
            entry["leek_names"] = ", ".join(l["name"] for l in entry["leeks"])
            if key not in farmer or ranking_key(entry) < ranking_key(farmer[key]):
                farmer[key] = entry

    return {
        "solo": sorted(solo.values(), key=ranking_key),
        "farmer": sorted(farmer.values(), key=ranking_key),
    }


def process_dalton(session, dalton, cache, rankings):
    """Process a single Dalton leek: fetch history, extract losses, update rankings."""
    leek_id = dalton["leek_id"]
    leek_id_str = str(leek_id)
    name = dalton["name"]

    print(f"\nProcessing {name} (ID: {leek_id})...")

    # Get fight history
    data = api_request(session, f"history/get-leek-history/{leek_id}")
    if data is None:
        print(f"  Failed to get history for {name}")
        return

    fights = data.get("fights", [])
    print(f"  Found {len(fights)} fights in history")

    # Filter already cached fights
    cached_ids = set(cache.get(leek_id_str, []))
    new_fight_ids = [f["id"] for f in fights if f["id"] not in cached_ids]
    print(f"  {len(new_fight_ids)} new fights to process")

    new_entries = []
    for fight_id in new_fight_ids:
        fight_data = api_request(session, f"fight/get/{fight_id}")
        if fight_data is None:
            continue

        info = extract_challenger_info(fight_data, leek_id)
        if info:
            new_entries.append(info)
            leek_desc = ", ".join(f"{l['name']}(L{l['level']})" for l in info["leeks"])
            print(f"  Loss found: {info['farmer_name']} with {leek_desc} in {info['turns']} turns")

        # Update cache incrementally
        cached_ids.add(fight_id)

    # Save cache
    cache[leek_id_str] = list(cached_ids)

    # Merge rankings
    existing = rankings.get("daltons", {}).get(leek_id_str, {"solo": [], "farmer": []})
    updated = merge_rankings(existing, new_entries)
    if "daltons" not in rankings:
        rankings["daltons"] = {}
    rankings["daltons"][leek_id_str] = updated

    print(f"  Rankings: {len(updated['solo'])} solo, {len(updated['farmer'])} farmer entries")


def main():
    config = load_config()
    cache = load_cache()
    rankings = load_rankings()

    session = requests.Session()
    login(session)

    for dalton in config["daltons"]:
        if dalton["leek_id"] == 0:
            print(f"Skipping {dalton['name']} (placeholder ID 0)")
            continue
        process_dalton(session, dalton, cache, rankings)

    rankings["last_updated"] = datetime.now(timezone.utc).isoformat()
    rankings["daltons_config"] = config["daltons"]

    save_cache(cache)
    save_rankings(rankings)
    print(f"\nDone! Rankings saved to {RANKINGS_PATH}")


if __name__ == "__main__":
    main()
