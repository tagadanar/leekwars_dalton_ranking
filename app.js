const IMG = "https://raw.githubusercontent.com/leek-wars/leek-wars/master/public/image";
const LW = "https://leekwars.com/image";

// Actual leek renders (skin=dalton, appearance=11)
const DALTON_IMGS = {
    46733: `${LW}/leek/svg/leek_11_front_dalton_angry.svg`,       // JoeDalton
    51098: `${LW}/leek/svg/leek_11_front_dalton_metal.svg`,       // WilliamDalton
    51257: `${LW}/leek/svg/leek_11_front_dalton.svg`,             // JackDalton
    51613: `${LW}/leek/svg/leek_11_front_dalton_metal_happy.svg`, // AvereIIDalton
};

// Hat images per leek (null = no hat)
const DALTON_HATS = {
    46733: { src: `${LW}/hat/fedora.png`, cls: "hat-fedora" },
    51098: null,
    51257: { src: `${LW}/hat/panama.png`, cls: "hat-panama" },
    51613: { src: `${LW}/hat/sombrero.png`, cls: "hat-sombrero" },
};

const FARMER_AVATAR = "https://leekwars.com/avatar/42851.png";
const TEAM_EMBLEM = "luckyleek.png";

// Star medals for top 3 (gold / silver / bronze)
const STAR = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/>';
function starMedal(color) {
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">${STAR}</svg>`)}`;
}
const MEDAL = {
    1: starMedal("#ffd700"),
    2: starMedal("#b8c0cc"),
    3: starMedal("#cd7f32"),
};

document.addEventListener("DOMContentLoaded", () => {
    fetch("data/rankings.json")
        .then(r => r.json())
        .then(render)
        .catch(err => {
            document.getElementById("content").innerHTML =
                '<p class="loading">Failed to load rankings.</p>';
            console.error(err);
        });
});

function renderLeekWithHat(leekId, wrapClass) {
    const img = DALTON_IMGS[leekId];
    const hat = DALTON_HATS[leekId];
    let html = `<div class="${wrapClass}">`;
    html += `<img src="${img}" class="leek-body" alt="">`;
    if (hat) {
        html += `<img src="${hat.src}" class="leek-hat ${hat.cls}" alt="">`;
    }
    html += `</div>`;
    return html;
}

function buildChampions(daltons, farmerRanking, teamRanking, config) {
    // Collect per farmer: which sections they beat, best level in each
    const farmers = {}; // farmer_id -> { name, sections: [{name, level, turns}] }

    // Solo sections
    for (const dalton of config) {
        const entries = daltons[String(dalton.leek_id)] || [];
        for (const e of entries) {
            const fid = e.farmer_id;
            if (!fid) continue;
            if (!farmers[fid]) farmers[fid] = { name: e.farmer_name, id: fid, sections: [] };
            farmers[fid].sections.push({
                name: dalton.name,
                level: e.leek_level || e.total_level,
                turns: e.turns || 0,
            });
        }
    }

    // Farmer fights
    for (const e of farmerRanking) {
        const fid = e.farmer_id;
        if (!fid) continue;
        if (!farmers[fid]) farmers[fid] = { name: e.farmer_name, id: fid, sections: [] };
        farmers[fid].sections.push({ name: "Farmer", level: e.total_level, turns: e.turns || 0 });
    }

    // Team fights
    for (const e of teamRanking) {
        const fid = e.farmer_id;
        if (!fid) continue;
        if (!farmers[fid]) farmers[fid] = { name: e.farmer_name, id: fid, sections: [] };
        farmers[fid].sections.push({ name: "Team", level: e.total_level, turns: e.turns || 0 });
    }

    // Only include farmers who beat at least 2 sections
    const result = Object.values(farmers)
        .filter(f => f.sections.length >= 2)
        .map(f => ({
            farmer_name: f.name,
            farmer_id: f.id,
            beaten: f.sections.length,
            total_level: f.sections.reduce((s, x) => s + x.level, 0),
            total_turns: f.sections.reduce((s, x) => s + x.turns, 0),
            sections: f.sections,
        }))
        .sort((a, b) => b.beaten - a.beaten || a.total_level - b.total_level || a.total_turns - b.total_turns);

    return result;
}

function renderChampionTable(champions) {
    let html = '<div class="table-scroll"><table class="ranking-table"><thead><tr>';
    html += '<th style="text-align:center">#</th>';
    html += '<th>Farmer</th>';
    html += '<th style="text-align:center">Beaten</th>';
    html += '<th style="text-align:center">Total Level</th>';
    html += '<th style="text-align:center">Total Turns</th>';
    html += '<th>Sections</th>';
    html += '</tr></thead><tbody>';

    champions.forEach((c, i) => {
        const rank = i + 1;
        const cls = rank <= 3 ? `rank-${rank}` : "";
        const rankHtml = MEDAL[rank]
            ? `<img src="${MEDAL[rank]}" class="rank-medal" alt="#${rank}">`
            : rank;
        const avatarImg = `<img src="https://leekwars.com/avatar/${c.farmer_id}.png" class="farmer-mini-avatar" alt="">`;
        const farmerLink = `${avatarImg}<a href="https://leekwars.com/farmer/${c.farmer_id}" target="_blank">${esc(c.farmer_name)}</a>`;
        const sectionList = c.sections.map(s => esc(s.name)).join(", ");

        html += `<tr class="${cls}">`;
        html += `<td class="rank-cell">${rankHtml}</td>`;
        html += `<td class="farmer-cell">${farmerLink}</td>`;
        html += `<td class="level-cell">${c.beaten}</td>`;
        html += `<td class="level-cell">${c.total_level}</td>`;
        html += `<td class="turns-cell">${c.total_turns}</td>`;
        html += `<td class="leek-cell">${sectionList}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    return html;
}

function render(data) {
    if (data.last_updated) {
        const d = new Date(data.last_updated);
        document.getElementById("last-updated").textContent =
            "Last updated: " + d.toLocaleString();
    }

    const main = document.getElementById("content");
    const nav = document.getElementById("section-nav");
    const config = data.daltons_config || [];
    const daltons = data.daltons || {};
    const farmerRanking = data.farmer_ranking || [];
    const farmerConfig = data.farmer_config;
    const teamRanking = data.team_ranking || [];
    const teamConfig = data.team_config;

    let html = "";
    let navHtml = "";
    let sectionIndex = 0;

    // Grand Champion — aggregate across all sections
    const champions = buildChampions(daltons, farmerRanking, teamRanking, config);
    if (champions.length > 0) {
        navHtml += `<a href="#champions" class="nav-btn nav-btn-champion">` +
            `<img src="${IMG}/weapon/magnum.png" alt="">` +
            `Grand Champions</a>`;

        html += `<div class="dalton-section champion-section" id="champions">`;
        html += `<div class="section-header champion-header">`;
        html += `<img src="${IMG}/weapon/magnum.png" class="champion-icon" alt="">`;
        html += `<div class="section-info">`;
        html += `<h2>Grand Champions</h2>`;
        html += `<span class="badge badge-champion">All Daltons combined</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${champions.length}</span>champions</div>`;
        html += `</div>`;
        html += renderChampionTable(champions);
        html += `</div>`;
        sectionIndex++;
    }

    // Farmer ranking
    if (farmerConfig) {
        const count = farmerRanking.length;
        navHtml += `<a href="#farmer" class="nav-btn">` +
            `<img src="${FARMER_AVATAR}" alt="">` +
            `${esc(farmerConfig.name)}</a>`;

        html += `<div class="dalton-section" id="farmer">`;
        html += `<div class="section-header">`;
        html += `<img src="${FARMER_AVATAR}" class="farmer-avatar" alt="${esc(farmerConfig.name)}">`;
        html += `<div class="section-info">`;
        html += `<h2><a href="https://leekwars.com/garden/challenge/farmer/${farmerConfig.farmer_id}" target="_blank" class="section-link">${esc(farmerConfig.name)}</a></h2>`;
        html += `<span class="badge badge-farmer">Farmer fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${count}</span>challengers</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(farmerRanking, "farmer") : renderEmpty();
        html += `</div>`;
        sectionIndex++;
    }

    // Team ranking
    if (teamConfig) {
        const count = teamRanking.length;
        navHtml += `<a href="#team" class="nav-btn">` +
            `<img src="${TEAM_EMBLEM}" alt="">` +
            `${esc(teamConfig.name)}</a>`;

        if (sectionIndex > 0) {
            html += `<div class="section-divider"><span>&#9733;</span></div>`;
        }

        html += `<div class="dalton-section" id="team">`;
        html += `<div class="section-header">`;
        html += `<img src="${TEAM_EMBLEM}" class="farmer-avatar" alt="${esc(teamConfig.name)}">`;
        html += `<div class="section-info">`;
        html += `<h2><a href="https://leekwars.com/garden/challenge/team/${teamConfig.team_id}" target="_blank" class="section-link">${esc(teamConfig.name)}</a></h2>`;
        html += `<span class="badge badge-team">Team fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${count}</span>challengers</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(teamRanking, "team") : renderEmpty();
        html += `</div>`;
        sectionIndex++;
    }

    // Per-leek solo sections
    for (const dalton of config) {
        const id = dalton.leek_id;
        const rankings = daltons[String(id)] || [];
        const count = rankings.length;
        const img = DALTON_IMGS[id];

        navHtml += `<a href="#leek-${id}" class="nav-btn">` +
            `<img src="${img}" alt="">` +
            `${esc(dalton.name)}</a>`;

        if (sectionIndex > 0) {
            html += `<div class="section-divider"><span>&#9733;</span></div>`;
        }

        html += `<div class="dalton-section" id="leek-${id}">`;
        html += `<div class="section-header">`;
        html += renderLeekWithHat(id, "section-leek-wrap");
        html += `<div class="section-info">`;
        html += `<h2><a href="https://leekwars.com/garden/challenge/leek/${id}" target="_blank" class="section-link">${esc(dalton.name)}</a></h2>`;
        html += `<span class="badge badge-solo">Solo fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${count}</span>challengers</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(rankings, "solo") : renderEmpty();
        html += `</div>`;
        sectionIndex++;
    }

    nav.innerHTML = navHtml;
    main.innerHTML = html || '<p class="loading">No rankings data yet.</p>';

    // Show search bar
    const searchBar = document.getElementById("search-bar");
    if (searchBar) searchBar.style.display = "";
}

function renderStats(entries, type) {
    const levels = entries.map(e => type === "solo" ? (e.leek_level || e.total_level) : e.total_level);
    if (levels.length === 0) return "";
    const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
    const sorted = [...levels].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return `<div class="stats-banner">` +
        `<span>Avg level: <strong>${avg}</strong></span>` +
        `<span>Median level: <strong>${median}</strong></span>` +
        `</div>`;
}

function renderTable(entries, type) {
    let html = renderStats(entries, type);
    html += '<div class="table-scroll"><table class="ranking-table"><thead><tr>';
    html += '<th style="text-align:center">#</th>';
    html += '<th class="sortable" data-sort="farmer">Farmer</th>';
    html += type === "solo"
        ? '<th class="sortable" data-sort="leek">Leek</th>'
        : '<th class="sortable" data-sort="leek">Leeks</th>';
    html += '<th class="sortable sort-active sort-asc" data-sort="level" style="text-align:center">Level</th>';
    html += '<th class="sortable" data-sort="turns" style="text-align:center">Turns</th>';
    html += '<th class="sortable" data-sort="date">Date</th>';
    html += '<th></th>';
    html += '</tr></thead><tbody>';

    const now = Date.now() / 1000;
    const RECENT = 48 * 3600;

    entries.forEach((e, i) => {
        const rank = i + 1;
        const isNew = e.date && (now - e.date) < RECENT;
        const cls = (rank <= 3 ? ` rank-${rank}` : "") + (isNew ? " row-new" : "");
        const dateStr = e.date ? new Date(e.date * 1000).toLocaleDateString() : "?";
        const leekCol = type === "solo"
            ? esc(e.leek_name || "?")
            : esc(e.leek_names || "?");
        const level = type === "solo" ? (e.leek_level || e.total_level) : e.total_level;

        let rankHtml;
        if (MEDAL[rank]) {
            rankHtml = `<img src="${MEDAL[rank]}" class="rank-medal" alt="#${rank}">`;
        } else {
            rankHtml = rank;
        }

        const farmerId = e.farmer_id || "";
        const avatarImg = farmerId
            ? `<img src="https://leekwars.com/avatar/${farmerId}.png" class="farmer-mini-avatar" alt="">`
            : "";
        const farmerLink = farmerId
            ? `${avatarImg}<a href="https://leekwars.com/farmer/${farmerId}" target="_blank">${esc(e.farmer_name || "?")}</a>`
            : esc(e.farmer_name || "?");

        const leekName = type === "solo" ? (e.leek_name || "?") : (e.leek_names || "?");
        html += `<tr class="${cls}" data-level="${level}" data-turns="${e.turns || 0}" data-date="${e.date || 0}" data-farmer="${(e.farmer_name || "").toLowerCase()}" data-leek="${leekName.toLowerCase()}">`;
        const newBadge = isNew ? `<span class="new-badge">NEW</span>` : "";
        const hist = e.history || [];
        const winsBadge = hist.length > 1 ? `<span class="wins-badge" title="${hist.length} wins">${hist.length}x</span>` : "";
        html += `<td class="rank-cell">${rankHtml}</td>`;
        html += `<td class="farmer-cell">${farmerLink}${newBadge}${winsBadge}</td>`;
        html += `<td class="leek-cell">${leekCol}</td>`;
        html += `<td class="level-cell">${level}</td>`;
        html += `<td class="turns-cell">${e.turns || "?"}</td>`;
        html += `<td class="date-cell">${dateStr}</td>`;
        html += `<td><a class="fight-link" href="https://leekwars.com/fight/${e.fight_id}" target="_blank">` +
            `<img src="${IMG}/weapon/pistol.png" alt="">fight</a></td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    return html;
}

function renderEmpty() {
    return `<div class="empty-state">` +
        `<img src="${IMG}/weapon/magnum.png" alt="">` +
        `<p>No one has beaten this Dalton yet. Will you be the first?</p>` +
        `</div>`;
}

function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Live countdown to next hourly update
function updateCountdown() {
    const el = document.getElementById("next-update");
    if (!el) return;
    const now = new Date();
    const min = 59 - now.getMinutes();
    const sec = 60 - now.getSeconds();
    const adjustedMin = sec === 60 ? min : min;
    const adjustedSec = sec === 60 ? 0 : sec;
    if (adjustedMin === 0 && adjustedSec < 5) {
        el.textContent = "Updating now...";
    } else {
        el.textContent = `Next update in ${adjustedMin}m ${String(adjustedSec).padStart(2, "0")}s`;
    }
}
updateCountdown();
setInterval(updateCountdown, 1000);

// Sortable table columns
document.addEventListener("click", (ev) => {
    const th = ev.target.closest(".sortable");
    if (!th) return;
    const table = th.closest("table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);
    const key = th.dataset.sort;
    const isNumeric = key === "level" || key === "turns" || key === "date";

    // Toggle direction
    const wasAsc = th.classList.contains("sort-asc");
    const asc = !wasAsc;

    // Clear sort state from sibling headers
    th.closest("tr").querySelectorAll(".sortable").forEach(h => {
        h.classList.remove("sort-active", "sort-asc", "sort-desc");
    });
    th.classList.add("sort-active", asc ? "sort-asc" : "sort-desc");

    rows.sort((a, b) => {
        let va = a.dataset[key], vb = b.dataset[key];
        if (isNumeric) { va = Number(va); vb = Number(vb); }
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
    });

    // Re-insert rows + update rank column
    rows.forEach((row, i) => {
        const rank = i + 1;
        row.className = rank <= 3 ? `rank-${rank}` : "";
        const cell = row.querySelector(".rank-cell");
        cell.innerHTML = MEDAL[rank]
            ? `<img src="${MEDAL[rank]}" class="rank-medal" alt="#${rank}">`
            : rank;
        tbody.appendChild(row);
    });
});

// Farmer search filter
document.addEventListener("input", (ev) => {
    if (ev.target.id !== "farmer-search") return;
    const query = ev.target.value.toLowerCase().trim();
    document.querySelectorAll(".ranking-table tbody").forEach(tbody => {
        Array.from(tbody.rows).forEach(row => {
            if (row.classList.contains("history-row")) return;
            const farmer = row.dataset.farmer || "";
            row.style.display = (!query || farmer.includes(query)) ? "" : "none";
        });
    });
});
