// dashboard.js — Dashboard page logic with charts and recommendations
(function () {
    "use strict";

    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // ========================================
    // DOM ELEMENTS
    // ========================================
    const dashGreeting = document.getElementById("dashGreeting");
    const dashSubtext = document.getElementById("dashSubtext");
    const dashAvatar = document.getElementById("dashAvatar");
    const dashUserEmail = document.getElementById("dashUserEmail");
    const dashLogout = document.getElementById("dashLogout");
    const statTotalItems = document.getElementById("statTotalItems");
    const statCategories = document.getElementById("statCategories");
    const statPossibleOutfits = document.getElementById("statPossibleOutfits");
    const statVersatility = document.getElementById("statVersatility");
    const categoryChart = document.getElementById("categoryChart");
    const colorChart = document.getElementById("colorChart");
    const styleTips = document.getElementById("styleTips");
    const wardrobeGaps = document.getElementById("wardrobeGaps");
    const occasionFilter = document.getElementById("occasionFilter");
    const refreshRecoBtn = document.getElementById("refreshRecoBtn");
    const recoGrid = document.getElementById("recoGrid");
    const favGrid = document.getElementById("favGrid");
    const wardrobePreviewGrid = document.getElementById("wardrobePreviewGrid");

    let userInfo = null;
    let wardrobeItems = [];
    let analytics = null;

    // ========================================
    // USER INFO
    // ========================================
    function fetchUser() {
        if (window.DB && typeof DB.getUser === "function") {
            userInfo = DB.getUser(currentUser);
        }
        if (!userInfo) {
            try {
                const users = JSON.parse(localStorage.getItem("users") || "[]");
                userInfo = users.find((u) => u.email === currentUser) || null;
            } catch (e) {
                userInfo = null;
            }
        }
    }

    function getWardrobe() {
        if (window.DB && typeof DB.getWardrobe === "function") {
            return DB.getWardrobe(currentUser) || [];
        }
        return JSON.parse(localStorage.getItem("wardrobe_" + currentUser) || "[]");
    }

    function getDisplayName() {
        if (userInfo && userInfo.name) return userInfo.name;
        return currentUser.split("@")[0];
    }

    function getInitials() {
        const raw = userInfo?.name || currentUser;
        return raw
            .split(/[\s@._-]+/)
            .filter(Boolean)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "DD";
    }

    function getTimeGreeting() {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    }

    // ========================================
    // LOGOUT
    // ========================================
    dashLogout?.addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        window.location.href = "login.html";
    });

    // ========================================
    // POPULATE HEADER
    // ========================================
    function populateHeader() {
        const name = getDisplayName();
        if (dashGreeting) dashGreeting.textContent = `${getTimeGreeting()}, ${name}!`;
        if (dashAvatar) dashAvatar.textContent = getInitials();
        if (dashUserEmail) dashUserEmail.textContent = currentUser;

        const memberDate = userInfo?.createdAt
            ? new Date(userInfo.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : "";
        if (dashSubtext) {
            dashSubtext.textContent = wardrobeItems.length > 0
                ? `You have ${wardrobeItems.length} items in your wardrobe. Here are today's picks.`
                : "Start by uploading clothes to your wardrobe to get outfit recommendations.";
        }
    }

    // ========================================
    // STAT CARDS
    // ========================================
    function populateStats() {
        if (!analytics) return;
        if (statTotalItems) statTotalItems.textContent = analytics.totalItems;
        if (statCategories) statCategories.textContent = Object.keys(analytics.categoryCount).length;
        if (statPossibleOutfits) statPossibleOutfits.textContent = analytics.possibleOutfits;
        if (statVersatility) statVersatility.textContent = analytics.versatilityScore + "%";
    }

    // ========================================
    // CHARTS (Pure CSS/HTML — no external libs)
    // ========================================

    const CATEGORY_COLORS = {
        "Shirt": "#5B9BD5",
        "Top/T-Shirt": "#70AD47",
        "Trouser/Jeans": "#FFC000",
        "Skirt": "#ED7D31",
        "Jacket": "#4472C4",
        "Dress": "#A87C7C",
        "Uncategorized": "#888",
    };

    const COLOR_MAP = {
        Red: "#E74C3C",
        Orange: "#E67E22",
        Yellow: "#F1C40F",
        Green: "#27AE60",
        Cyan: "#1ABC9C",
        Blue: "#3498DB",
        Purple: "#9B59B6",
        Pink: "#E91E90",
        Gray: "#95A5A6",
        Black: "#2C3E50",
        White: "#ECF0F1",
        Unknown: "#7F8C8D",
    };

    function renderCategoryChart() {
        if (!categoryChart || !analytics) return;
        const entries = Object.entries(analytics.categoryCount).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            categoryChart.innerHTML = '<p class="muted small">No data yet</p>';
            return;
        }

        const max = Math.max(...entries.map((e) => e[1]));
        let html = '<div class="bar-chart">';
        entries.forEach(([cat, count]) => {
            const pct = Math.round((count / max) * 100);
            const color = CATEGORY_COLORS[cat] || "#A87C7C";
            html += `
                <div class="bar-row">
                    <span class="bar-label">${cat}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
                    </div>
                    <span class="bar-value">${count}</span>
                </div>`;
        });
        html += "</div>";
        categoryChart.innerHTML = html;
    }

    function renderColorChart() {
        if (!colorChart || !analytics) return;
        const entries = Object.entries(analytics.colorCount).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            colorChart.innerHTML = '<p class="muted small">No data yet</p>';
            return;
        }

        const total = entries.reduce((s, e) => s + e[1], 0);
        let html = '<div class="color-donut-chart">';
        // Build a CSS conic gradient donut
        let gradientParts = [];
        let cumPct = 0;
        entries.forEach(([col, count]) => {
            const pct = (count / total) * 100;
            const color = COLOR_MAP[col] || analytics.colorHexMap[col] || "#888";
            gradientParts.push(`${color} ${cumPct}% ${cumPct + pct}%`);
            cumPct += pct;
        });
        const gradient = `conic-gradient(${gradientParts.join(", ")})`;

        html += `<div class="donut" style="background:${gradient}"><div class="donut-hole"><span>${total}</span><small>items</small></div></div>`;
        html += '<div class="donut-legend">';
        entries.forEach(([col, count]) => {
            const color = COLOR_MAP[col] || analytics.colorHexMap[col] || "#888";
            const pct = Math.round((count / total) * 100);
            html += `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${col} <span class="muted small">(${pct}%)</span></div>`;
        });
        html += "</div></div>";
        colorChart.innerHTML = html;
    }

    // ========================================
    // STYLE TIPS
    // ========================================
    function renderStyleTips() {
        if (!styleTips) return;
        const RE = window.RecommendationEngine;
        if (!RE) return;

        const tips = RE.getStyleTips(wardrobeItems);
        if (tips.length === 0) {
            styleTips.innerHTML = '<p class="muted small">Upload items to get style insights.</p>';
            return;
        }

        const ICONS = { wardrobe: "&#128090;", pants: "&#128086;", shirt: "&#128085;", star: "&#11088;", spark: "&#9889;", palette: "&#127912;" };
        let html = "";
        tips.forEach((t) => {
            html += `<div class="dash-tip"><span class="dash-tip-icon">${ICONS[t.icon] || "&#128161;"}</span><span>${t.tip}</span></div>`;
        });
        styleTips.innerHTML = html;

        // Wardrobe gaps
        if (wardrobeGaps && analytics && analytics.gaps.length > 0) {
            let gapsHtml = '<h4 style="margin:12px 0 8px;">Suggestions</h4>';
            analytics.gaps.forEach((gap) => {
                gapsHtml += `<div class="dash-gap-item">&#8226; ${gap}</div>`;
            });
            wardrobeGaps.innerHTML = gapsHtml;
        }
    }

    // ========================================
    // RECOMMENDATIONS
    // ========================================
    function renderRecommendations() {
        if (!recoGrid) return;
        const RE = window.RecommendationEngine;
        if (!RE || wardrobeItems.length < 2) {
            recoGrid.innerHTML = `
                <div class="dash-reco-empty">
                    <p>Upload at least 2 clothing items (a top and a bottom) to get outfit recommendations.</p>
                    <a href="main.html" class="btn-main" style="display:inline-block;width:auto;padding:10px 24px;margin-top:12px;">Go to Studio</a>
                </div>`;
            return;
        }

        const occasion = occasionFilter?.value || "casual";
        const outfits = RE.generateOutfits(wardrobeItems, { occasion, maxResults: 8 });

        if (outfits.length === 0) {
            recoGrid.innerHTML = '<div class="dash-reco-empty"><p>No outfits could be generated for this occasion. Try adding more variety to your wardrobe.</p></div>';
            return;
        }

        let html = "";
        outfits.forEach((outfit, idx) => {
            const scoreClass = outfit.score >= 80 ? "score-high" : outfit.score >= 60 ? "score-mid" : "score-low";
            html += `<div class="dash-reco-card">
                <div class="reco-card-header">
                    <span class="reco-label">${outfit.occasion}</span>
                    <span class="reco-score ${scoreClass}">${outfit.score}%</span>
                </div>
                <div class="reco-card-items">`;

            outfit.items.forEach((item) => {
                html += `<div class="reco-item-thumb">
                    <img src="${item.dataURL}" alt="${item.name}" />
                    <span class="reco-item-cat">${item.category}</span>
                </div>`;
            });

            html += `</div>
                <div class="reco-card-colors">`;
            outfit.colors.forEach((col) => {
                const hex = COLOR_MAP[col] || "#888";
                html += `<span class="reco-color-dot" style="background:${hex}" title="${col}"></span>`;
            });
            html += `</div>
                <div class="reco-card-actions">
                    <button class="btn-ghost tiny reco-fav-btn" data-idx="${idx}" type="button">Save</button>
                    <button class="btn-main tiny reco-use-btn" data-idx="${idx}" type="button">Use in Studio</button>
                </div>
            </div>`;
        });

        recoGrid.innerHTML = html;

        // Attach event listeners
        recoGrid.querySelectorAll(".reco-fav-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.idx);
                if (outfits[idx]) {
                    RE.saveFavoriteOutfit(currentUser, outfits[idx]);
                    RE.saveRecommendationHistory(currentUser, outfits[idx]);
                    btn.textContent = "Saved!";
                    btn.disabled = true;
                    renderFavorites();
                }
            });
        });

        recoGrid.querySelectorAll(".reco-use-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.idx);
                if (outfits[idx]) {
                    // Save outfit to a temp key and redirect to studio
                    localStorage.setItem("tempRecoOutfit", JSON.stringify(outfits[idx]));
                    window.location.href = "main.html";
                }
            });
        });
    }

    // ========================================
    // FAVORITES
    // ========================================
    function renderFavorites() {
        if (!favGrid) return;
        const RE = window.RecommendationEngine;
        if (!RE) return;

        const favs = RE.getFavoriteOutfits(currentUser);
        if (favs.length === 0) {
            favGrid.innerHTML = '<p class="muted small">No favorite outfits yet. Save outfits you like from the recommendations above.</p>';
            return;
        }

        let html = "";
        favs.forEach((fav) => {
            html += `<div class="dash-reco-card fav-card">
                <div class="reco-card-header">
                    <span class="reco-label">${fav.occasion || "Outfit"}</span>
                    <span class="reco-score score-high">${fav.score || "—"}%</span>
                </div>
                <div class="reco-card-items">`;
            fav.items.forEach((item) => {
                html += `<div class="reco-item-thumb">
                    <img src="${item.dataURL}" alt="${item.name}" />
                    <span class="reco-item-cat">${item.category}</span>
                </div>`;
            });
            html += `</div>
                <div class="reco-card-actions">
                    <span class="muted small">${new Date(fav.savedAt).toLocaleDateString()}</span>
                    <button class="btn-ghost tiny fav-remove-btn" data-id="${fav.id}" type="button">Remove</button>
                </div>
            </div>`;
        });

        favGrid.innerHTML = html;

        favGrid.querySelectorAll(".fav-remove-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                RE.removeFavoriteOutfit(currentUser, btn.dataset.id);
                renderFavorites();
            });
        });
    }

    // ========================================
    // WARDROBE PREVIEW
    // ========================================
    function renderWardrobePreview() {
        if (!wardrobePreviewGrid) return;
        if (wardrobeItems.length === 0) {
            wardrobePreviewGrid.innerHTML = '<p class="muted small">Your wardrobe is empty. Head to the Studio to upload clothes.</p>';
            return;
        }

        // Show up to 12 items
        const preview = wardrobeItems.slice(0, 12);
        let html = "";
        preview.forEach((item) => {
            html += `<div class="dash-wardrobe-item">
                <img src="${item.dataURL}" alt="${item.name}" />
                <div class="dash-wardrobe-meta">
                    <strong>${item.name}</strong>
                    <span class="small muted">${item.category || "Uncategorized"} &middot; ${item.color || "Unknown"}</span>
                </div>
            </div>`;
        });

        if (wardrobeItems.length > 12) {
            html += `<a href="profile.html" class="dash-wardrobe-more">+${wardrobeItems.length - 12} more items</a>`;
        }

        wardrobePreviewGrid.innerHTML = html;
    }

    // ========================================
    // EVENTS
    // ========================================
    occasionFilter?.addEventListener("change", renderRecommendations);
    refreshRecoBtn?.addEventListener("click", renderRecommendations);

    // ========================================
    // INIT
    // ========================================
    function init() {
        fetchUser();
        wardrobeItems = getWardrobe();

        const RE = window.RecommendationEngine;
        if (RE) {
            analytics = RE.getWardrobeAnalytics(wardrobeItems);
        }

        populateHeader();
        populateStats();
        renderCategoryChart();
        renderColorChart();
        renderStyleTips();
        renderRecommendations();
        renderFavorites();
        renderWardrobePreview();
    }

    init();
})();
