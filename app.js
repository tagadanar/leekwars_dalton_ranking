const IMG = "https://raw.githubusercontent.com/leek-wars/leek-wars/master/public/image";
const LW = "https://leekwars.com/image";

// Actual leek renders from leekwars.com (skin=dalton, appearance=11, varying face/metal)
const DALTON_IMGS = {
    46733: `${LW}/leek/svg/leek_11_front_dalton_angry.svg`,       // JoeDalton: face=angry
    51098: `${LW}/leek/svg/leek_11_front_dalton_metal.svg`,       // WilliamDalton: metal
    51257: `${LW}/leek/svg/leek_11_front_dalton.svg`,             // JackDalton: plain
    51613: `${LW}/leek/svg/leek_11_front_dalton_metal_happy.svg`, // AvereIIDalton: metal+happy
};
const FARMER_IMG = `${IMG}/icon/team.png`;

// Trophies for top 3
const MEDAL = {
    1: `${IMG}/trophy/emperor.svg`,
    2: `${IMG}/trophy/baron.svg`,
    3: `${IMG}/trophy/chief.svg`,
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

    let html = "";
    let navHtml = "";

    // Farmer ranking
    if (farmerConfig) {
        const count = farmerRanking.length;
        navHtml += `<a href="#farmer" class="nav-btn">` +
            `<img src="${FARMER_IMG}" alt="">` +
            `${esc(farmerConfig.name)}</a>`;

        html += `<div class="dalton-section" id="farmer">`;
        html += `<div class="section-header">`;
        html += `<img src="${FARMER_IMG}" class="section-leek" alt="">`;
        html += `<div class="section-info">`;
        html += `<h2>${esc(farmerConfig.name)}</h2>`;
        html += `<span class="badge badge-farmer">Farmer fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${count}</span>challengers</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(farmerRanking, "farmer") : renderEmpty();
        html += `</div>`;
    }

    // Per-leek solo sections
    for (const dalton of config) {
        const id = dalton.leek_id;
        const rankings = daltons[String(id)] || [];
        const count = rankings.length;
        const img = DALTON_IMGS[id] || `${IMG}/leek/leek1_front_green.png`;

        navHtml += `<a href="#leek-${id}" class="nav-btn">` +
            `<img src="${img}" alt="">` +
            `${esc(dalton.name)}</a>`;

        html += `<div class="dalton-section" id="leek-${id}">`;
        html += `<div class="section-header">`;
        html += `<img src="${img}" class="section-leek" alt="${esc(dalton.name)}">`;
        html += `<div class="section-info">`;
        html += `<h2>${esc(dalton.name)}</h2>`;
        html += `<span class="badge badge-solo">Solo fight</span>`;
        html += `</div>`;
        html += `<div class="section-stats"><span class="count">${count}</span>challengers</div>`;
        html += `</div>`;
        html += count > 0 ? renderTable(rankings, "solo") : renderEmpty();
        html += `</div>`;
    }

    nav.innerHTML = navHtml;
    main.innerHTML = html || '<p class="loading">No rankings data yet.</p>';
}

function renderTable(entries, type) {
    let html = '<table class="ranking-table"><thead><tr>';
    html += '<th style="text-align:center">#</th>';
    html += '<th>Farmer</th>';
    html += type === "solo" ? '<th>Leek</th>' : '<th>Leeks</th>';
    html += '<th style="text-align:center">Level</th>';
    html += '<th style="text-align:center">Turns</th>';
    html += '<th>Date</th>';
    html += '<th></th>';
    html += '</tr></thead><tbody>';

    entries.forEach((e, i) => {
        const rank = i + 1;
        const cls = rank <= 3 ? ` rank-${rank}` : "";
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
        const farmerLink = farmerId
            ? `<a href="https://leekwars.com/farmer/${farmerId}" target="_blank">${esc(e.farmer_name || "?")}</a>`
            : esc(e.farmer_name || "?");

        html += `<tr class="${cls}">`;
        html += `<td class="rank-cell">${rankHtml}</td>`;
        html += `<td class="farmer-cell">${farmerLink}</td>`;
        html += `<td class="leek-cell">${leekCol}</td>`;
        html += `<td class="level-cell">${level}</td>`;
        html += `<td class="turns-cell">${e.turns || "?"}</td>`;
        html += `<td class="date-cell">${dateStr}</td>`;
        html += `<td><a class="fight-link" href="https://leekwars.com/fight/${e.fight_id}" target="_blank">` +
            `<img src="${IMG}/weapon/pistol.png" alt="">fight</a></td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';
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
