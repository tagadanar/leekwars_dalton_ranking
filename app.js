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
    const config = data.daltons_config || [];
    const daltons = data.daltons || {};
    const farmerRanking = data.farmer_ranking || [];
    const farmerConfig = data.farmer_config;

    let html = "";

    // Farmer ranking section
    if (farmerConfig) {
        html += '<div class="dalton-section">';
        html += '<div class="dalton-header">';
        html += `<h2>${esc(farmerConfig.name)}</h2>`;
        html += '<span class="description">Farmer fight ranking</span>';
        html += "</div>";
        if (farmerRanking.length > 0) {
            html += renderTable(farmerRanking, "farmer");
        } else {
            html += '<p class="empty-msg">No challengers yet</p>';
        }
        html += "</div>";
    }

    // Per-leek solo ranking sections
    for (const dalton of config) {
        const rankings = daltons[String(dalton.leek_id)] || [];
        html += '<div class="dalton-section">';
        html += '<div class="dalton-header">';
        html += `<h2>${esc(dalton.name)}</h2>`;
        html += '<span class="description">Solo fight ranking</span>';
        html += "</div>";
        if (rankings.length > 0) {
            html += renderTable(rankings, "solo");
        } else {
            html += '<p class="empty-msg">No challengers yet</p>';
        }
        html += "</div>";
    }

    main.innerHTML = html || '<p class="loading">No rankings data yet.</p>';
}

function renderTable(entries, type) {
    let html = '<table class="ranking-table"><thead><tr>';
    html += "<th>#</th><th>Farmer</th>";
    html += type === "solo" ? "<th>Leek</th>" : "<th>Leeks</th>";
    html += "<th>Level</th><th>Turns</th><th>Date</th><th></th>";
    html += "</tr></thead><tbody>";

    entries.forEach((e, i) => {
        const rank = i + 1;
        const rankClass = rank <= 3 ? ` rank-${rank}` : "";
        const dateStr = e.date ? new Date(e.date * 1000).toLocaleDateString() : "?";
        const leekCol = type === "solo"
            ? esc(e.leek_name || "?")
            : esc(e.leek_names || "?");
        const level = type === "solo" ? (e.leek_level || e.total_level) : e.total_level;

        html += `<tr class="${rankClass}">`;
        html += `<td class="rank-cell">${rank}</td>`;
        html += `<td>${esc(e.farmer_name || "?")}</td>`;
        html += `<td>${leekCol}</td>`;
        html += `<td class="level-cell">${level}</td>`;
        html += `<td class="turns-cell">${e.turns || "?"}</td>`;
        html += `<td>${dateStr}</td>`;
        html += `<td><a class="fight-link" href="https://leekwars.com/fight/${e.fight_id}" target="_blank">view</a></td>`;
        html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
}

function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
