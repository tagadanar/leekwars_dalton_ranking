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
const SECRET_AVATAR = "https://leekwars.com/avatar/50168.png";

// Capital formula: 50 base + 5/level, +50 at 100/200/300, +100 at 301
function computeCapital(level) {
    if (level < 1) return 0;
    let total = 50;
    for (let lv = 2; lv <= level; lv++) {
        if (lv === 301) total += 100;
        else if (lv % 100 === 0) total += 50;
        else total += 5;
    }
    return total;
}

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

function buildChampions(daltons, config) {
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

    // Only include farmers who beat at least 2 solo sections
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
        const fid = safeInt(c.farmer_id);
        const avatarImg = `<img src="https://leekwars.com/avatar/${fid}.png" class="farmer-mini-avatar" alt="">`;
        const farmerLink = `${avatarImg}<a href="https://leekwars.com/farmer/${fid}" target="_blank" data-farmer-id="${fid}">${esc(c.farmer_name)}</a>`;
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
    initTooltipData(data);

    if (data.last_updated) {
        const d = new Date(data.last_updated);
        document.getElementById("last-updated").textContent =
            "Last updated: " + d.toLocaleString();
    }

    const main = document.getElementById("content");
    const nav = document.getElementById("section-nav");
    const config = data.daltons_config || [];
    const daltons = data.daltons || {};

    let html = "";
    let navHtml = "";
    let sectionIndex = 0;

    // Grand Champion — aggregate across all sections
    const champions = buildChampions(daltons, config);

    if (champions.length > 0) {
        const top = champions[0];
        const topFid = safeInt(top.farmer_id);
        navHtml += `<a href="#champions" class="nav-btn nav-btn-champion">` +
            `<img src="${IMG}/weapon/magnum.png" alt="">` +
            `Grand Champions</a>`;

        html += `<div class="dalton-section champion-section" id="champions">`;
        html += `<div class="section-header champion-header">`;
        html += `<div class="most-wanted">`;
        html += `<div class="most-wanted-avatar-wrap">`;
        html += `<img src="https://leekwars.com/avatar/${topFid}.png" class="most-wanted-avatar" alt="${esc(top.farmer_name)}">`;
        html += `<span class="corner-stud tl"></span><span class="corner-stud tr"></span>`;
        html += `<span class="corner-stud bl"></span><span class="corner-stud br"></span>`;
        html += `</div>`;
        html += `<div class="most-wanted-info">`;
        html += `<p class="most-wanted-label">MOST WANTED</p>`;
        html += `<p class="most-wanted-name"><a href="https://leekwars.com/farmer/${topFid}" target="_blank">${esc(top.farmer_name)}</a></p>`;
        html += `<p class="most-wanted-stats">${top.beaten} Daltons beaten &middot; Total Lv.${top.total_level}</p>`;
        html += `</div>`;
        html += `</div>`;
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
        html += `<div class="section-stats"><span class="count">${count}</span>challengers${renderStatsHtml(rankings, "solo")}</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(rankings, "solo", dalton.name) : renderEmpty();
        html += `</div>`;
        sectionIndex++;
    }

    // Secret section — hidden by default, revealed by ghost click
    const secretRanking = data.secret_ranking || [];
    const secretConfig = data.secret_config;
    if (secretConfig && secretRanking.length > 0) {
        const count = secretRanking.length;
        html += `<div class="haunted-section" id="haunted" style="display:none">`;
        html += `<div class="haunted-divider"><span>&#128128;</span></div>`;
        html += `<div class="dalton-section condemned-section">`;
        html += `<div class="section-header condemned-header">`;
        html += `<img src="${SECRET_AVATAR}" class="farmer-avatar condemned-avatar" alt="${esc(secretConfig.name)}">`;
        html += `<div class="section-info">`;
        html += `<h2 class="condemned-title"><a href="https://leekwars.com/garden/challenge/farmer/${safeInt(secretConfig.farmer_id)}" target="_blank" class="section-link">${esc(secretConfig.name)}</a></h2>`;
        html += `<span class="badge badge-condemned">Ghost fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats condemned-stats"><span class="count">${count}</span>brave souls</div>`;
        html += `</div>`;
        html += count > 0 ? renderSecretTable(secretRanking, secretConfig.name) : renderEmpty();
        html += `</div>`;
        html += `</div>`;
    }

    nav.innerHTML = navHtml;
    main.innerHTML = html || '<p class="loading">No rankings data yet.</p>';

    // Show search bar
    const searchBar = document.getElementById("search-bar");
    if (searchBar) searchBar.style.display = "";

    // Re-apply "my farmer" highlight
    highlightMyFarmer(localStorage.getItem("dalton_my_farmer") || "");

    // Restore secret visibility if previously unlocked
    if (localStorage.getItem("dalton_secret_unlocked")) {
        const haunted = document.getElementById("haunted");
        if (haunted) haunted.style.display = "";
    }
}

function renderStatsHtml(entries, type) {
    const levels = entries.map(e => type === "solo" ? (e.leek_level || e.total_level) : e.total_level);
    if (levels.length === 0) return "";
    const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
    const sorted = [...levels].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return `<span class="stat-line">avg lv.<strong>${avg}</strong> · median lv.<strong>${median}</strong></span>`;
}

function renderTable(entries, type, sectionName) {
    let html = '<div class="table-scroll"><table class="ranking-table"><thead><tr>';
    html += '<th style="text-align:center">#</th>';
    html += type === "team"
        ? '<th class="sortable" data-sort="farmer">Team</th>'
        : '<th class="sortable" data-sort="farmer">Farmer</th>';
    html += type === "solo"
        ? '<th class="sortable" data-sort="leek">Leek</th>'
        : '<th class="sortable" data-sort="leek">' + (type === "team" ? "Composition" : "Leeks") + '</th>';
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
        const leekIds = (e.leeks || []).map(l => safeInt(l.id)).filter(Boolean);
        // For team/farmer: store compact leek info with farmer for grouping
        const compData = (type !== "solo" && leekIds.length > 0)
            ? (e.leeks || []).map(l => ({ id: safeInt(l.id), f: safeInt(l.farmer), fn: l.farmer_name || "" }))
            : null;
        const leekCol = type === "solo"
            ? (leekIds.length === 1
                ? `<span data-leek-id="${leekIds[0]}">${esc(e.leek_name || "?")}</span>`
                : esc(e.leek_name || "?"))
            : (compData
                ? `<span data-comp='${JSON.stringify(compData).replace(/'/g, "&#39;")}'>${esc(e.leek_names || "?")}</span>`
                : esc(e.leek_names || "?"));
        const level = type === "solo" ? (e.leek_level || e.total_level) : e.total_level;

        let rankHtml;
        if (MEDAL[rank]) {
            rankHtml = `<img src="${MEDAL[rank]}" class="rank-medal" alt="#${rank}">`;
        } else {
            rankHtml = rank;
        }

        const farmerId = safeInt(e.farmer_id);
        const avatarImg = farmerId
            ? `<img src="https://leekwars.com/avatar/${farmerId}.png" class="farmer-mini-avatar" alt="">`
            : "";
        const displayName = type === "team" ? (e.team_name || e.farmer_name || "?") : (e.farmer_name || "?");
        const farmerLink = farmerId
            ? `${avatarImg}<a href="https://leekwars.com/farmer/${farmerId}" target="_blank" data-farmer-id="${farmerId}">${esc(displayName)}</a>`
            : esc(displayName);

        const leekName = type === "solo" ? (e.leek_name || "?") : (e.leek_names || "?");
        const hist = e.history || [];
        const histAttr = hist.length > 1 ? ` data-history='${JSON.stringify(hist).replace(/'/g, "&#39;")}'` : "";
        const expandable = hist.length > 1 ? " expandable" : "";
        html += `<tr class="${cls}${expandable}" data-level="${level}" data-turns="${e.turns || 0}" data-date="${e.date || 0}" data-farmer="${safeAttr(displayName.toLowerCase())}" data-leek="${safeAttr(leekName.toLowerCase())}"${histAttr}>`;
        const newBadge = isNew ? `<span class="new-badge">NEW</span>` : "";
        const winsBadge = hist.length > 1 ? `<span class="wins-badge" title="${hist.length} wins">${hist.length}x</span>` : "";
        html += `<td class="rank-cell">${rankHtml}</td>`;
        html += `<td class="farmer-cell">${farmerLink}${newBadge}${winsBadge}</td>`;
        html += `<td class="leek-cell">${leekCol}</td>`;
        html += `<td class="level-cell">${level}</td>`;
        html += `<td class="turns-cell">${e.turns || "?"}</td>`;
        html += `<td class="date-cell">${dateStr}</td>`;
        const fightUrl = `https://leekwars.com/fight/${safeInt(e.fight_id)}`;
        const shareText = `I beat ${sectionName} at Lv.${level} in ${e.turns || "?"}t! ${fightUrl}`;
        html += `<td class="action-cell">` +
            `<a class="fight-link" href="${fightUrl}" target="_blank">` +
            `<img src="${IMG}/weapon/pistol.png" alt="">fight</a>` +
            `<button class="share-btn" data-share="${esc(shareText)}" title="Copy to clipboard">&#128203;</button>` +
            `</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    return html;
}

function renderSecretTable(entries, sectionName) {
    let html = '<div class="table-scroll"><table class="ranking-table condemned-table"><thead><tr>';
    html += '<th style="text-align:center">#</th>';
    html += '<th class="sortable" data-sort="farmer">Farmer</th>';
    html += '<th class="sortable" data-sort="leek">Leeks</th>';
    html += '<th class="sortable sort-active sort-asc" data-sort="capital" style="text-align:center">Capital</th>';
    html += '<th class="sortable" data-sort="level" style="text-align:center">Level</th>';
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
        const leekIds = (e.leeks || []).map(l => safeInt(l.id)).filter(Boolean);
        const compData = leekIds.length > 0
            ? (e.leeks || []).map(l => ({ id: safeInt(l.id), f: safeInt(l.farmer), fn: l.farmer_name || "" }))
            : null;
        const leekCol = compData
            ? `<span data-comp='${JSON.stringify(compData).replace(/'/g, "&#39;")}'>${esc(e.leek_names || "?")}</span>`
            : esc(e.leek_names || "?");
        const capital = e.total_capital || 0;
        const level = e.total_level;

        let rankHtml;
        if (MEDAL[rank]) {
            rankHtml = `<img src="${MEDAL[rank]}" class="rank-medal" alt="#${rank}">`;
        } else {
            rankHtml = rank;
        }

        const farmerId = safeInt(e.farmer_id);
        const avatarImg = farmerId
            ? `<img src="https://leekwars.com/avatar/${farmerId}.png" class="farmer-mini-avatar" alt="">`
            : "";
        const displayName = e.farmer_name || "?";
        const farmerLink = farmerId
            ? `${avatarImg}<a href="https://leekwars.com/farmer/${farmerId}" target="_blank" data-farmer-id="${farmerId}">${esc(displayName)}</a>`
            : esc(displayName);

        const leekName = e.leek_names || "?";
        const hist = e.history || [];
        const histAttr = hist.length > 1 ? ` data-history='${JSON.stringify(hist).replace(/'/g, "&#39;")}'` : "";
        const expandable = hist.length > 1 ? " expandable" : "";
        html += `<tr class="${cls}${expandable}" data-capital="${capital}" data-level="${level}" data-turns="${e.turns || 0}" data-date="${e.date || 0}" data-farmer="${safeAttr(displayName.toLowerCase())}" data-leek="${safeAttr(leekName.toLowerCase())}"${histAttr}>`;
        const newBadge = isNew ? `<span class="new-badge">NEW</span>` : "";
        const winsBadge = hist.length > 1 ? `<span class="wins-badge" title="${hist.length} wins">${hist.length}x</span>` : "";
        html += `<td class="rank-cell">${rankHtml}</td>`;
        html += `<td class="farmer-cell">${farmerLink}${newBadge}${winsBadge}</td>`;
        html += `<td class="leek-cell">${leekCol}</td>`;
        html += `<td class="level-cell">${capital}</td>`;
        html += `<td class="level-cell">${level}</td>`;
        html += `<td class="turns-cell">${e.turns || "?"}</td>`;
        html += `<td class="date-cell">${dateStr}</td>`;
        const fightUrl = `https://leekwars.com/fight/${safeInt(e.fight_id)}`;
        const shareText = `I beat ${sectionName} at ${capital} capital in ${e.turns || "?"}t! ${fightUrl}`;
        html += `<td class="action-cell">` +
            `<a class="fight-link" href="${fightUrl}" target="_blank">` +
            `<img src="${IMG}/weapon/pistol.png" alt="">fight</a>` +
            `<button class="share-btn" data-share="${esc(shareText)}" title="Copy to clipboard">&#128203;</button>` +
            `</td>`;
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

// Sanitize values used in HTML attributes (IDs, etc.)
function safeInt(v) { return parseInt(v, 10) || 0; }
function safeAttr(v) { return esc(String(v)); }

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
    const isNumeric = key === "level" || key === "turns" || key === "date" || key === "capital";

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

// Expand row to show history
document.addEventListener("click", (ev) => {
    // Don't trigger on link/button clicks
    if (ev.target.closest("a, button")) return;
    const row = ev.target.closest("tr.expandable");
    if (!row) return;

    // Toggle: remove existing history rows for this row
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains("history-row")) {
        existing.remove();
        row.classList.remove("expanded");
        return;
    }

    const hist = JSON.parse(row.dataset.history || "[]");
    if (hist.length < 2) return;

    const colCount = row.cells.length;
    const histRow = document.createElement("tr");
    histRow.className = "history-row";
    const td = document.createElement("td");
    td.colSpan = colCount;
    td.className = "history-cell";

    let inner = '<div class="history-list"><span class="history-label">History:</span>';
    hist.forEach((h, i) => {
        const dateStr = h.date ? new Date(h.date * 1000).toLocaleDateString() : "?";
        const best = i === 0 ? ' class="history-best"' : "";
        inner += `<a href="https://leekwars.com/fight/${safeInt(h.fight_id)}" target="_blank"${best}>` +
            `Lv.${safeInt(h.total_level)} in ${safeInt(h.turns)}t <small>(${dateStr})</small></a>`;
    });
    inner += "</div>";
    td.innerHTML = inner;
    histRow.appendChild(td);
    row.after(histRow);
    row.classList.add("expanded");
});

// Share button
document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".share-btn");
    if (!btn) return;
    ev.stopPropagation();
    const text = btn.dataset.share;
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "\u2713";
        setTimeout(() => { btn.innerHTML = "&#128203;"; }, 1500);
    });
});

// Back to top button
window.addEventListener("scroll", () => {
    const btn = document.getElementById("back-to-top");
    if (btn) btn.classList.toggle("visible", window.scrollY > 400);
}, { passive: true });

// "My farmer" highlight — persisted to localStorage
function highlightMyFarmer(name) {
    const query = (name || "").toLowerCase().trim();
    document.querySelectorAll(".ranking-table tbody tr").forEach(row => {
        if (row.classList.contains("history-row")) return;
        const farmer = row.dataset.farmer || "";
        row.classList.toggle("my-row", query && farmer === query);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("my-farmer");
    if (!input) return;
    const saved = localStorage.getItem("dalton_my_farmer") || "";
    if (saved) {
        input.value = saved;
        // Delay to run after render
        setTimeout(() => highlightMyFarmer(saved), 100);
    }
    input.addEventListener("input", () => {
        const val = input.value;
        localStorage.setItem("dalton_my_farmer", val);
        highlightMyFarmer(val);
    });
});

// ---------- Rich Tooltip ----------

const tooltipCache = {};
let tooltipTimer = null;
let tooltipHideTimer = null;
let tooltipEl = null;
let tooltipCurrentTarget = null;

function getTooltipEl() {
    if (!tooltipEl) tooltipEl = document.getElementById("rich-tooltip");
    return tooltipEl;
}

function positionTooltip(anchor) {
    const tt = getTooltipEl();
    const rect = anchor.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const pad = 8;

    // Prefer below the element
    let top = rect.bottom + pad;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    // Flip above if it would overflow bottom
    if (top + ttRect.height > window.innerHeight - pad) {
        top = rect.top - ttRect.height - pad;
    }

    // Clamp horizontally
    left = Math.max(pad, Math.min(left, window.innerWidth - ttRect.width - pad));
    // Clamp vertically
    top = Math.max(pad, top);

    tt.style.left = left + "px";
    tt.style.top = top + "px";
}

function showTooltip(anchor, html) {
    const tt = getTooltipEl();
    tt.innerHTML = html;
    tt.classList.add("visible");
    // Position after render so dimensions are known
    requestAnimationFrame(() => positionTooltip(anchor));
}

function hideTooltip() {
    const tt = getTooltipEl();
    tt.classList.remove("visible");
    tooltipCurrentTarget = null;
}

// Stat icon definitions
const STAT_DEFS = [
    { key: "life",       icon: `${IMG}/charac/life.png` },
    { key: "tp",         icon: `${IMG}/charac/tp.png` },
    { key: "mp",         icon: `${IMG}/charac/mp.png` },
    { key: "strength",   icon: `${IMG}/charac/strength.png` },
    { key: "agility",    icon: `${IMG}/charac/agility.png` },
    { key: "wisdom",     icon: `${IMG}/charac/wisdom.png` },
    { key: "resistance", icon: `${IMG}/charac/resistance.png` },
    { key: "science",    icon: `${IMG}/charac/science.png` },
    { key: "magic",      icon: `${IMG}/charac/magic.png` },
    { key: "frequency",  icon: `${IMG}/charac/frequency.png` },
    { key: "cores",      icon: `${IMG}/charac/cores.png` },
    { key: "ram",        icon: `${IMG}/charac/ram.png` },
];

function renderStatGrid(stats) {
    let html = '<div class="stat-grid">';
    for (const { key, icon } of STAT_DEFS) {
        const val = stats[key];
        if (val === undefined || val === null) continue;
        html += `<span class="stat-item"><img src="${icon}" class="stat-icon" alt="${key}">${safeInt(val)}</span>`;
    }
    html += '</div>';
    return html;
}

function renderLeekRow(leek, showLink) {
    let html = '<div class="rich-tooltip-leek">';
    html += '<div class="rich-tooltip-leek-header">';
    if (showLink) {
        html += `<span class="rich-tooltip-leek-name"><a href="https://leekwars.com/leek/${safeInt(leek.id)}" target="_blank">${esc(leek.name || "?")}</a></span>`;
    } else {
        html += `<span class="rich-tooltip-leek-name">${esc(leek.name || "?")}</span>`;
    }
    html += `<span class="rich-tooltip-leek-level">Lv.${safeInt(leek.level)}</span>`;
    if (leek.talent) {
        html += `<span class="rich-tooltip-leek-talent">${safeInt(leek.talent)}</span>`;
    }
    html += '</div>';
    html += renderStatGrid(leek);
    html += '</div>';
    return html;
}

function renderFarmerTooltip(farmer) {
    const fid = safeInt(farmer.id);
    let html = '<div class="rich-tooltip-header">';
    html += `<img src="https://leekwars.com/avatar/${fid}.png" class="rich-tooltip-avatar" alt="">`;
    html += '<div>';
    html += `<div class="rich-tooltip-name"><a href="https://leekwars.com/farmer/${fid}" target="_blank">${esc(farmer.name || "?")}</a>`;
    if (farmer.talent) {
        html += `<span class="rich-tooltip-talent-badge">${safeInt(farmer.talent)}</span>`;
    }
    html += '</div>';
    if (farmer.team) {
        html += `<div class="rich-tooltip-team">`;
        html += `<img src="https://leekwars.com/emblem/${safeInt(farmer.team.id)}.png" alt="">`;
        html += `${esc(farmer.team.name || "")}</div>`;
    }
    const details = [];
    if (farmer.ranking) details.push(`#${safeInt(farmer.ranking)}`);
    if (farmer.country) details.push(esc(farmer.country).toUpperCase());
    if (farmer.total_level) details.push(`Total Lv.${safeInt(farmer.total_level)}`);
    if (farmer.trophies) details.push(`${safeInt(farmer.trophies)} trophies`);
    if (details.length) {
        html += `<div class="rich-tooltip-sub">${details.join(" · ")}</div>`;
    }
    html += '</div></div>';

    // Leeks with full stats
    const leeks = farmer.leeks ? Object.values(farmer.leeks) : [];
    if (leeks.length > 0) {
        leeks.sort((a, b) => (b.level || 0) - (a.level || 0));
        html += '<div class="rich-tooltip-leeks">';
        for (const leek of leeks) {
            html += renderLeekRow(leek, true);
        }
        html += '</div>';
    }

    return html;
}

function renderEquipIcons(items, imgBase) {
    let html = "";
    for (const name of items) {
        const safeName = esc(name);
        html += `<img src="${imgBase}/${safeName}.png" class="equip-icon" alt="${safeName}" title="${safeName}">`;
    }
    return html;
}

function renderLeekTooltip(leek) {
    const lid = safeInt(leek.id);
    let html = '<div class="rich-tooltip-header">';
    if (leek.farmer && leek.farmer.id) {
        html += `<img src="https://leekwars.com/avatar/${safeInt(leek.farmer.id)}.png" class="rich-tooltip-avatar" alt="">`;
    }
    html += '<div>';
    html += `<div class="rich-tooltip-name"><a href="https://leekwars.com/leek/${lid}" target="_blank">${esc(leek.name || "?")}</a>`;
    html += `<span class="rich-tooltip-leek-level" style="margin-left:0.4rem">Lv.${safeInt(leek.level)}</span>`;
    if (leek.talent) {
        html += `<span class="rich-tooltip-talent-badge">${safeInt(leek.talent)}</span>`;
    }
    html += '</div>';
    if (leek.farmer && leek.farmer.name) {
        html += `<div class="rich-tooltip-sub">Farmer: ${esc(leek.farmer.name)}</div>`;
    }
    if (leek.ranking) {
        html += `<div class="rich-tooltip-sub">Ranking: #${safeInt(leek.ranking)}</div>`;
    }
    html += '</div></div>';
    html += renderStatGrid(leek);

    // Equipment — weapons, separator, chips
    const hasWeapons = leek.weapons && leek.weapons.length > 0;
    const hasChips = leek.chips && leek.chips.length > 0;
    const hasComponents = leek.components && leek.components.length > 0;
    if (hasWeapons || hasChips || hasComponents) {
        html += '<div class="equip-section"><div class="equip-icons">';
        if (hasWeapons) html += renderEquipIcons(leek.weapons, `${LW}/weapon`);
        if (hasWeapons && (hasChips || hasComponents)) html += '<span class="equip-sep"></span>';
        if (hasChips) html += renderEquipIcons(leek.chips, `${LW}/chip`);
        if (hasComponents) {
            if (hasChips) html += '<span class="equip-sep"></span>';
            html += renderEquipIcons(leek.components, `${LW}/component`);
        }
        html += '</div></div>';
    }

    return html;
}

function renderCompositionTooltip(compData) {
    // Group leeks by farmer
    const groups = [];
    const seen = {};
    for (const entry of compData) {
        const fid = entry.f || 0;
        if (!seen[fid]) {
            seen[fid] = { id: fid, name: entry.fn || "?", leeks: [] };
            groups.push(seen[fid]);
        }
        seen[fid].leeks.push(entry.id);
    }

    let html = '';
    for (const group of groups) {
        // Farmer header
        const fid = safeInt(group.id);
        html += '<div class="comp-farmer-group">';
        html += '<div class="comp-farmer-header">';
        if (fid) html += `<img src="https://leekwars.com/avatar/${fid}.png" class="comp-farmer-avatar" alt="">`;
        html += `<a href="https://leekwars.com/farmer/${fid}" target="_blank" class="comp-farmer-name" data-farmer-id="${fid}">${esc(group.name)}</a>`;
        // Show farmer talent if we have tooltip data
        const farmerData = getTooltipData("farmer", fid);
        if (farmerData && farmerData.talent) {
            html += `<span class="rich-tooltip-talent-badge">${safeInt(farmerData.talent)}</span>`;
        }
        html += '</div>';
        // Leeks
        for (const lid of group.leeks) {
            const leek = getTooltipData("leek", lid);
            if (leek) {
                html += renderLeekRow(leek, true);
            }
        }
        html += '</div>';
    }
    return html;
}

// Tooltip data is pre-fetched and stored in rankings.json
let tooltipFarmers = {};
let tooltipLeeks = {};

function initTooltipData(data) {
    tooltipFarmers = data.tooltip_farmers || {};
    tooltipLeeks = data.tooltip_leeks || {};
}

function getTooltipData(type, id) {
    if (type === "farmer") return tooltipFarmers[String(id)] || null;
    if (type === "leek") return tooltipLeeks[String(id)] || null;
    return null;
}

// Event delegation for tooltip triggers
document.addEventListener("mouseenter", (ev) => {
    const farmerLink = ev.target.closest("a[data-farmer-id]");
    const leekSpan = ev.target.closest("[data-leek-id]");
    const compSpan = ev.target.closest("[data-comp]");

    const anchor = farmerLink || leekSpan || compSpan;
    if (!anchor) return;

    // Cancel pending hide
    clearTimeout(tooltipHideTimer);

    // Don't re-trigger for same target
    if (tooltipCurrentTarget === anchor) return;

    // Clear any pending show
    clearTimeout(tooltipTimer);

    tooltipTimer = setTimeout(() => {
        tooltipCurrentTarget = anchor;

        let html;
        if (farmerLink) {
            const data = getTooltipData("farmer", farmerLink.dataset.farmerId);
            html = data ? renderFarmerTooltip(data) : null;
        } else if (leekSpan) {
            const data = getTooltipData("leek", leekSpan.dataset.leekId);
            html = data ? renderLeekTooltip(data) : null;
        } else if (compSpan) {
            const comp = JSON.parse(compSpan.dataset.comp || "[]");
            if (comp.length > 0) html = renderCompositionTooltip(comp);
        }

        if (html) showTooltip(anchor, html);
    }, 400);
}, true);

document.addEventListener("mouseleave", (ev) => {
    const anchor = ev.target.closest("a[data-farmer-id], [data-leek-id], [data-comp]");
    if (!anchor) return;

    clearTimeout(tooltipTimer);
    tooltipHideTimer = setTimeout(() => {
        hideTooltip();
    }, 200);
}, true);

// Keep tooltip open when hovering over it
document.addEventListener("mouseenter", (ev) => {
    if (ev.target.closest(".rich-tooltip")) {
        clearTimeout(tooltipHideTimer);
    }
}, true);

document.addEventListener("mouseleave", (ev) => {
    if (ev.target.closest(".rich-tooltip")) {
        tooltipHideTimer = setTimeout(() => {
            hideTooltip();
        }, 150);
    }
}, true);

// Lucky Clover — secret section trigger
const cloverEl = document.getElementById("lucky-clover");
if (cloverEl) {
    cloverEl.addEventListener("click", () => {
        const haunted = document.getElementById("haunted");
        if (!haunted) return;
        haunted.style.display = "";
        localStorage.setItem("dalton_secret_unlocked", "1");
        cloverEl.classList.remove("drifting");
        cloverEl.style.opacity = "0";
        const snd = new Audio(`https://raw.githubusercontent.com/leek-wars/leek-wars/master/public/sound/heal.mp3`);
        snd.volume = 0.3;
        snd.play().catch(() => {});
        setTimeout(() => haunted.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    });

    function launchClover() {
        if (cloverEl.classList.contains("drifting")) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const side = Math.random();
        let x0, y0, x1, y1, duration;
        if (side < 0.5) {
            x0 = Math.random() * vw * 0.8 + vw * 0.1;
            y0 = -30;
            x1 = x0 + (Math.random() - 0.5) * vw * 0.4;
            y1 = vh + 30;
            duration = 15 + Math.random() * 10;
        } else {
            const fromLeft = Math.random() < 0.5;
            x0 = fromLeft ? -30 : vw + 30;
            y0 = Math.random() * vh * 0.6 + vh * 0.1;
            x1 = fromLeft ? vw + 30 : -30;
            y1 = y0 + (Math.random() - 0.3) * vh * 0.3;
            duration = 18 + Math.random() * 12;
        }
        cloverEl.style.setProperty("--drift-x0", x0 + "px");
        cloverEl.style.setProperty("--drift-y0", y0 + "px");
        cloverEl.style.setProperty("--drift-x1", x1 + "px");
        cloverEl.style.setProperty("--drift-y1", y1 + "px");
        cloverEl.style.setProperty("--drift-duration", duration + "s");
        cloverEl.classList.add("drifting");
        setTimeout(() => { cloverEl.classList.remove("drifting"); }, duration * 1000);
    }

    setTimeout(launchClover, (8 + Math.random() * 7) * 1000);
    setInterval(launchClover, (25 + Math.random() * 25) * 1000);
}

// Easter eggs on hero Daltons
const LW_SND = "https://raw.githubusercontent.com/leek-wars/leek-wars/master/public/sound";
const eggSounds = {
    shoot:  new Audio(`${LW_SND}/double_gun.mp3`),
    wobble: new Audio(`${LW_SND}/gazor.mp3`),
    summon: new Audio(`${LW_SND}/bulb.mp3`),
    bounce: new Audio(`${LW_SND}/move.mp3`),
    bounce2: new Audio(`${LW_SND}/move.mp3`),
    bounce3: new Audio(`${LW_SND}/move.mp3`),
};
Object.values(eggSounds).forEach(s => { s.volume = 0.4; });

document.querySelectorAll(".dalton-mugshot[data-egg]").forEach(mugshot => {
    mugshot.addEventListener("click", () => {
        const egg = mugshot.dataset.egg;
        const cls = `egg-${egg}`;
        const wrap = mugshot.querySelector(".leek-with-hat");
        if (!wrap || wrap.classList.contains(cls)) return;
        wrap.classList.add(cls);

        if (egg === "bounce") {
            eggSounds.bounce.currentTime = 0;
            eggSounds.bounce.play().catch(() => {});
            setTimeout(() => {
                eggSounds.bounce2.currentTime = 0;
                eggSounds.bounce2.play().catch(() => {});
            }, 200);
        } else {
            const snd = eggSounds[egg];
            if (snd) {
                snd.currentTime = 0;
                snd.play().catch(() => {});
            }
        }

        // Wait for the longest animation to finish
        const animations = wrap.getAnimations();
        if (animations.length > 0) {
            Promise.all(animations.map(a => a.finished)).then(() => {
                wrap.classList.remove(cls);
            });
        } else {
            setTimeout(() => wrap.classList.remove(cls), 700);
        }
    });
});
