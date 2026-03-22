// recommendation-engine.js — Outfit recommendation system using color theory & fashion rules
(function (global) {
    "use strict";

    // ========================================
    // COLOR THEORY DATA
    // ========================================

    // HSL color wheel positions for the app's color categories
    const COLOR_WHEEL = {
        Red: 0,
        Orange: 30,
        Yellow: 60,
        Green: 120,
        Cyan: 180,
        Blue: 240,
        Purple: 270,
        Pink: 330,
    };

    const NEUTRAL_COLORS = ["Black", "White", "Gray", "Unknown"];

    // Category classification for outfit building
    const TOPS = ["Shirt", "Top/T-Shirt"];
    const BOTTOMS = ["Trouser/Jeans", "Skirt"];
    const LAYERS = ["Jacket"];
    const FULL_BODY = ["Dress"];

    // ========================================
    // OCCASION PROFILES
    // ========================================
    const OCCASION_PROFILES = {
        casual: {
            label: "Casual",
            description: "Relaxed everyday outfits",
            preferredCategories: { tops: ["Top/T-Shirt", "Shirt"], bottoms: ["Trouser/Jeans"], layers: ["Jacket"] },
            colorMood: "relaxed",
            maxItems: 3,
            layerChance: 0.3,
        },
        formal: {
            label: "Formal",
            description: "Professional and elegant looks",
            preferredCategories: { tops: ["Shirt"], bottoms: ["Trouser/Jeans", "Skirt"], layers: ["Jacket"] },
            colorMood: "subdued",
            maxItems: 3,
            layerChance: 0.7,
        },
        party: {
            label: "Party",
            description: "Bold and eye-catching outfits",
            preferredCategories: { tops: ["Top/T-Shirt", "Shirt"], bottoms: ["Skirt", "Trouser/Jeans"], layers: ["Jacket"] },
            colorMood: "vibrant",
            maxItems: 3,
            layerChance: 0.4,
        },
        work: {
            label: "Work",
            description: "Smart and polished office wear",
            preferredCategories: { tops: ["Shirt", "Top/T-Shirt"], bottoms: ["Trouser/Jeans", "Skirt"], layers: ["Jacket"] },
            colorMood: "subdued",
            maxItems: 3,
            layerChance: 0.5,
        },
        date: {
            label: "Date Night",
            description: "Stylish and attractive outfits",
            preferredCategories: { tops: ["Shirt", "Top/T-Shirt"], bottoms: ["Trouser/Jeans", "Skirt"], layers: ["Jacket"] },
            colorMood: "warm",
            maxItems: 3,
            layerChance: 0.3,
        },
        sporty: {
            label: "Sporty",
            description: "Active and comfortable looks",
            preferredCategories: { tops: ["Top/T-Shirt"], bottoms: ["Trouser/Jeans"], layers: ["Jacket"] },
            colorMood: "vibrant",
            maxItems: 2,
            layerChance: 0.3,
        },
    };

    // ========================================
    // SEASONAL COLOR PALETTES
    // ========================================
    const SEASON_COLORS = {
        spring: { preferred: ["Pink", "Green", "Yellow", "Cyan"], avoid: [] },
        summer: { preferred: ["Blue", "Cyan", "White", "Yellow"], avoid: [] },
        autumn: { preferred: ["Orange", "Red", "Brown", "Green"], avoid: [] },
        winter: { preferred: ["Black", "Gray", "Blue", "Red", "White"], avoid: [] },
    };

    // ========================================
    // COLOR HARMONY FUNCTIONS
    // ========================================

    function isNeutral(color) {
        return NEUTRAL_COLORS.includes(color);
    }

    function getHue(color) {
        return COLOR_WHEEL[color] !== undefined ? COLOR_WHEEL[color] : -1;
    }

    function hueDist(h1, h2) {
        const d = Math.abs(h1 - h2);
        return Math.min(d, 360 - d);
    }

    // Score how well two colors go together (0-100)
    function colorHarmonyScore(colorA, colorB) {
        // Neutrals go with everything
        if (isNeutral(colorA) || isNeutral(colorB)) return 85;
        // Same color — monochromatic
        if (colorA === colorB) return 70;

        const hA = getHue(colorA);
        const hB = getHue(colorB);
        if (hA < 0 || hB < 0) return 50;

        const dist = hueDist(hA, hB);

        // Complementary (opposite): ~180 degrees
        if (dist >= 150 && dist <= 210) return 90;
        // Triadic: ~120 degrees
        if (dist >= 100 && dist <= 140) return 80;
        // Analogous: ~30 degrees
        if (dist <= 45) return 75;
        // Split-complementary: ~150 degrees
        if (dist >= 130 && dist <= 170) return 78;

        // Everything else
        return 55;
    }

    // Score for a group of colors together
    function groupColorScore(colors) {
        if (colors.length <= 1) return 80;
        let total = 0;
        let pairs = 0;
        for (let i = 0; i < colors.length; i++) {
            for (let j = i + 1; j < colors.length; j++) {
                total += colorHarmonyScore(colors[i], colors[j]);
                pairs++;
            }
        }
        return pairs > 0 ? Math.round(total / pairs) : 80;
    }

    // ========================================
    // OUTFIT GENERATION
    // ========================================

    function categorizeWardrobe(items) {
        const result = { tops: [], bottoms: [], layers: [], fullBody: [] };
        items.forEach((item) => {
            const cat = item.category || "Uncategorized";
            if (TOPS.includes(cat)) result.tops.push(item);
            else if (BOTTOMS.includes(cat)) result.bottoms.push(item);
            else if (LAYERS.includes(cat)) result.layers.push(item);
            else if (FULL_BODY.includes(cat)) result.fullBody.push(item);
        });
        return result;
    }

    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Generate outfit combinations from wardrobe items
    function generateOutfits(wardrobeItems, options) {
        options = options || {};
        const occasion = options.occasion || "casual";
        const maxResults = options.maxResults || 8;
        const season = options.season || null;

        const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
        const categorized = categorizeWardrobe(wardrobeItems);
        const outfits = [];

        // Strategy 1: Top + Bottom combinations
        const prefTops = profile.preferredCategories.tops;
        const prefBottoms = profile.preferredCategories.bottoms;

        const sortedTops = categorized.tops.slice().sort((a, b) => {
            const aIdx = prefTops.indexOf(a.category);
            const bIdx = prefTops.indexOf(b.category);
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });

        const sortedBottoms = categorized.bottoms.slice().sort((a, b) => {
            const aIdx = prefBottoms.indexOf(a.category);
            const bIdx = prefBottoms.indexOf(b.category);
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });

        // Generate all top+bottom combos, score them
        for (const top of sortedTops) {
            for (const bottom of sortedBottoms) {
                const colors = [top.color || "Unknown", bottom.color || "Unknown"];
                let score = groupColorScore(colors);

                // Occasion bonus
                if (prefTops.includes(top.category)) score += 5;
                if (prefBottoms.includes(bottom.category)) score += 5;

                // Season bonus
                if (season && SEASON_COLORS[season]) {
                    const pref = SEASON_COLORS[season].preferred;
                    if (pref.includes(top.color)) score += 3;
                    if (pref.includes(bottom.color)) score += 3;
                }

                const outfit = {
                    items: [top, bottom],
                    score: Math.min(score, 100),
                    colors: colors,
                    occasion: profile.label,
                    type: "top-bottom",
                };

                // Maybe add a layer
                if (categorized.layers.length > 0 && Math.random() < profile.layerChance) {
                    const layer = categorized.layers[Math.floor(Math.random() * categorized.layers.length)];
                    outfit.items.push(layer);
                    outfit.colors.push(layer.color || "Unknown");
                    outfit.score = Math.min(groupColorScore(outfit.colors) + 5, 100);
                    outfit.type = "top-bottom-layer";
                }

                outfits.push(outfit);
            }
        }

        // Strategy 2: Full body (dresses)
        for (const dress of categorized.fullBody) {
            const colors = [dress.color || "Unknown"];
            let score = 80;

            if (season && SEASON_COLORS[season]) {
                if (SEASON_COLORS[season].preferred.includes(dress.color)) score += 5;
            }

            const outfit = {
                items: [dress],
                score: Math.min(score, 100),
                colors: colors,
                occasion: profile.label,
                type: "dress",
            };

            // Optionally add a jacket
            if (categorized.layers.length > 0 && Math.random() < 0.4) {
                const layer = categorized.layers[Math.floor(Math.random() * categorized.layers.length)];
                outfit.items.push(layer);
                outfit.colors.push(layer.color || "Unknown");
                outfit.score = Math.min(groupColorScore(outfit.colors) + 5, 100);
                outfit.type = "dress-layer";
            }

            outfits.push(outfit);
        }

        // Sort by score descending, then pick diverse results
        outfits.sort((a, b) => b.score - a.score);

        // Deduplicate — avoid showing nearly identical outfits
        const seen = new Set();
        const unique = [];
        for (const outfit of outfits) {
            const key = outfit.items.map((it) => it.id).sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(outfit);
            }
            if (unique.length >= maxResults) break;
        }

        return unique;
    }

    // ========================================
    // SMART RECOMMENDATIONS (Daily picks)
    // ========================================

    function getDailyRecommendations(wardrobeItems, options) {
        options = options || {};
        const count = options.count || 4;

        // Detect current season based on month
        const month = new Date().getMonth();
        let season;
        if (month >= 2 && month <= 4) season = "spring";
        else if (month >= 5 && month <= 7) season = "summer";
        else if (month >= 8 && month <= 10) season = "autumn";
        else season = "winter";

        // Generate recommendations for multiple occasions
        const occasions = ["casual", "work", "formal", "party"];
        const all = [];

        occasions.forEach((occ) => {
            const results = generateOutfits(wardrobeItems, {
                occasion: occ,
                maxResults: Math.ceil(count / 2),
                season: season,
            });
            all.push(...results);
        });

        // Sort by score and return top N unique ones
        all.sort((a, b) => b.score - a.score);
        const seen = new Set();
        const unique = [];
        for (const outfit of all) {
            const key = outfit.items.map((it) => it.id).sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(outfit);
            }
            if (unique.length >= count) break;
        }
        return unique;
    }

    // ========================================
    // WARDROBE ANALYTICS
    // ========================================

    function getWardrobeAnalytics(items) {
        const categoryCount = {};
        const colorCount = {};
        const colorHexMap = {};

        items.forEach((item) => {
            const cat = item.category || "Uncategorized";
            const col = item.color || "Unknown";
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            colorCount[col] = (colorCount[col] || 0) + 1;
            if (item.colorHex) colorHexMap[col] = item.colorHex;
        });

        const categorized = categorizeWardrobe(items);
        const versatilityScore = calculateVersatilityScore(categorized);
        const gaps = identifyWardrobeGaps(categorized);

        return {
            totalItems: items.length,
            categoryCount,
            colorCount,
            colorHexMap,
            topsCount: categorized.tops.length,
            bottomsCount: categorized.bottoms.length,
            layersCount: categorized.layers.length,
            dressesCount: categorized.fullBody.length,
            versatilityScore,
            gaps,
            possibleOutfits: estimatePossibleOutfits(categorized),
        };
    }

    function calculateVersatilityScore(categorized) {
        let score = 0;
        // Having items in multiple categories = more versatile
        if (categorized.tops.length > 0) score += 25;
        if (categorized.bottoms.length > 0) score += 25;
        if (categorized.layers.length > 0) score += 15;
        if (categorized.fullBody.length > 0) score += 10;

        // Color diversity
        const allColors = new Set();
        [...categorized.tops, ...categorized.bottoms, ...categorized.layers, ...categorized.fullBody].forEach((item) => {
            if (item.color && !isNeutral(item.color)) allColors.add(item.color);
        });
        score += Math.min(allColors.size * 5, 25);

        return Math.min(score, 100);
    }

    function identifyWardrobeGaps(categorized) {
        const gaps = [];
        if (categorized.tops.length === 0) gaps.push("You need some tops (shirts, t-shirts) to build outfits");
        if (categorized.bottoms.length === 0) gaps.push("Add some bottoms (trousers, skirts) to complete your looks");
        if (categorized.layers.length === 0) gaps.push("A jacket or blazer would add layering options");
        if (categorized.tops.length > 0 && categorized.bottoms.length > 0) {
            const topColors = new Set(categorized.tops.map((t) => t.color));
            const bottomColors = new Set(categorized.bottoms.map((b) => b.color));
            const hasNeutralTop = [...topColors].some((c) => isNeutral(c));
            const hasNeutralBottom = [...bottomColors].some((c) => isNeutral(c));
            if (!hasNeutralTop && !hasNeutralBottom) {
                gaps.push("Adding neutral-colored basics (black, white, gray) would increase outfit combinations");
            }
        }
        return gaps;
    }

    function estimatePossibleOutfits(categorized) {
        const topBottom = categorized.tops.length * categorized.bottoms.length;
        const withLayers = categorized.layers.length > 0 ? topBottom * (categorized.layers.length + 1) : topBottom;
        const dresses = categorized.fullBody.length;
        const dressesWithLayers = categorized.layers.length > 0 ? dresses * (categorized.layers.length + 1) : dresses;
        return withLayers + dressesWithLayers;
    }

    // ========================================
    // STYLE TIPS BASED ON WARDROBE
    // ========================================

    function getStyleTips(items) {
        const tips = [];
        const analytics = getWardrobeAnalytics(items);

        if (analytics.totalItems < 5) {
            tips.push({ icon: "wardrobe", tip: "Upload more clothes to unlock better recommendations! Aim for at least 5 items." });
        }
        if (analytics.topsCount > 0 && analytics.bottomsCount === 0) {
            tips.push({ icon: "pants", tip: "Add some bottoms to start building complete outfits." });
        }
        if (analytics.bottomsCount > 0 && analytics.topsCount === 0) {
            tips.push({ icon: "shirt", tip: "Add some tops to pair with your bottoms." });
        }
        if (analytics.versatilityScore >= 70) {
            tips.push({ icon: "star", tip: "Great wardrobe versatility! You have a solid mix of categories." });
        }
        if (analytics.possibleOutfits > 10) {
            tips.push({ icon: "spark", tip: `You can create ${analytics.possibleOutfits}+ unique outfit combinations!` });
        }

        const topColorEntries = Object.entries(analytics.colorCount).sort((a, b) => b[1] - a[1]);
        if (topColorEntries.length > 0) {
            tips.push({ icon: "palette", tip: `Your dominant wardrobe color is ${topColorEntries[0][0]} (${topColorEntries[0][1]} items).` });
        }

        return tips;
    }

    // ========================================
    // PERSISTENCE
    // ========================================

    function saveRecommendationHistory(email, outfit) {
        const key = "recHistory_" + email;
        const history = JSON.parse(localStorage.getItem(key) || "[]");
        history.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            items: outfit.items.map((it) => ({ id: it.id, name: it.name, category: it.category, color: it.color })),
            score: outfit.score,
            occasion: outfit.occasion,
            savedAt: new Date().toISOString(),
        });
        // Keep last 50 entries
        if (history.length > 50) history.length = 50;
        localStorage.setItem(key, JSON.stringify(history));
    }

    function getRecommendationHistory(email) {
        const key = "recHistory_" + email;
        return JSON.parse(localStorage.getItem(key) || "[]");
    }

    function saveFavoriteOutfit(email, outfit) {
        const key = "favOutfits_" + email;
        const favs = JSON.parse(localStorage.getItem(key) || "[]");
        const outfitEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            itemIds: outfit.items.map((it) => it.id),
            items: outfit.items.map((it) => ({ id: it.id, name: it.name, category: it.category, color: it.color, dataURL: it.dataURL })),
            score: outfit.score,
            occasion: outfit.occasion,
            savedAt: new Date().toISOString(),
        };
        favs.unshift(outfitEntry);
        localStorage.setItem(key, JSON.stringify(favs));
        return outfitEntry;
    }

    function getFavoriteOutfits(email) {
        const key = "favOutfits_" + email;
        return JSON.parse(localStorage.getItem(key) || "[]");
    }

    function removeFavoriteOutfit(email, outfitId) {
        const key = "favOutfits_" + email;
        const favs = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = favs.filter((f) => f.id !== outfitId);
        localStorage.setItem(key, JSON.stringify(filtered));
        return filtered;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    global.RecommendationEngine = {
        generateOutfits,
        getDailyRecommendations,
        getWardrobeAnalytics,
        getStyleTips,
        colorHarmonyScore,
        groupColorScore,
        saveRecommendationHistory,
        getRecommendationHistory,
        saveFavoriteOutfit,
        getFavoriteOutfits,
        removeFavoriteOutfit,
        OCCASION_PROFILES,
        SEASON_COLORS,
    };
})(window);
