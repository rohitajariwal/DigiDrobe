// local-db-plain.js — DB layer with API backend + localStorage fallback
(function(global) {
    function normalizeEmail(email) {
        return (email || "").trim().toLowerCase();
    }

    function isValidEmail(email) {
        const e = normalizeEmail(email);
        if (!e) return false;
        if (e.length > 254) return false;
        const at = e.indexOf("@");
        if (at <= 0 || at !== e.lastIndexOf("@")) return false;
        const local = e.slice(0, at);
        const domain = e.slice(at + 1);
        if (!local || !domain) return false;
        if (local.length > 64) return false;
        if (/\s/.test(e)) return false;
        if (!domain.includes(".")) return false;
        if (domain.startsWith(".") || domain.endsWith(".")) return false;
        if (local.startsWith(".") || local.endsWith(".")) return false;
        if (e.includes("..")) return false;
        const basic = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
        return basic.test(e);
    }

    function setLastError(msg) {
        global.DB = global.DB || {};
        global.DB.lastError = msg || "";
    }

    // Check if API backend is reachable
    function hasApi() {
        return !!(global.ApiClient);
    }

    // ---- User operations (localStorage fallback) ----

    function createUser(user) {
        setLastError("");
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const email = normalizeEmail(user.email);
        if (!isValidEmail(email)) { setLastError("Please enter a valid email address."); return false; }
        if (users.find((u) => normalizeEmail(u.email) === email)) { setLastError("User already exists!"); return false; }

        const profile = {
            name: (user.name || "").trim(),
            email,
            password: user.password,
            measurements: (user.measurements || "").trim(),
            preferences: user.preferences || {},
            createdAt: user.createdAt || new Date().toISOString(),
        };

        users.push(profile);
        localStorage.setItem("users", JSON.stringify(users));
        return true;
    }

    function login(email, pass) {
        setLastError("");
        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) { setLastError("Please enter a valid email address."); return false; }
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const u = users.find((x) => normalizeEmail(x.email) === normalizedEmail && x.password === pass);
        if (u) { localStorage.setItem("currentUser", normalizedEmail); return true; }
        setLastError("Incorrect email or password");
        return false;
    }

    function logout() {
        localStorage.removeItem("currentUser");
        location.reload();
    }

    function persistWardrobe(email, wardrobe) {
        localStorage.setItem("wardrobe_" + email, JSON.stringify(wardrobe));
    }

    function addClothesObjects(email, items) {
        return new Promise(async (resolve) => {
            const key = "wardrobe_" + email;
            const wardrobe = JSON.parse(localStorage.getItem(key) || "[]");
            items.forEach((it) => {
                const safe = {
                    id: it.id || Date.now() + "_" + (it.name || Math.random().toString(36).slice(2)),
                    name: it.name || "Uploaded",
                    dataURL: it.dataURL,
                    category: it.category || "Uncategorized",
                    color: it.color || "Unknown",
                    colorHex: it.colorHex || "",
                    sourceUrl: it.sourceUrl || "",
                    productImageUrl: it.productImageUrl || "",
                    sizes: Array.isArray(it.sizes) ? it.sizes.slice(0, 30) : (it.sizes || ""),
                    bgRemoved: !!it.bgRemoved,
                };
                wardrobe.push(safe);
                // Also sync to API if available
                if (hasApi()) ApiClient.addWardrobeItem(email, safe).catch(() => {});
            });
            persistWardrobe(email, wardrobe);
            resolve(wardrobe);
        });
    }

    function addClothesFromFileList(email, fileList) {
        const files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return Promise.resolve(JSON.parse(localStorage.getItem("wardrobe_" + email) || "[]"));
        return new Promise((resolve) => {
            const results = [];
            let done = 0;
            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    results.push({
                        id: Date.now() + "_" + file.name,
                        name: "Uploaded",
                        dataURL: e.target.result,
                        category: "Uncategorized",
                    });
                    done++;
                    if (done === files.length) addClothesObjects(email, results).then(resolve);
                };
                reader.onerror = function() {
                    done++;
                    if (done === files.length) addClothesObjects(email, results).then(resolve);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    async function getWardrobe(email) {
        // Try API first, fallback to localStorage
        if (hasApi()) {
            try {
                const items = await ApiClient.getWardrobe(email);
                if (items && items.length > 0) {
                    // Sync to localStorage as cache
                    persistWardrobe(email, items);
                    return items;
                }
            } catch (e) { /* fallback */ }
        }
        return JSON.parse(localStorage.getItem("wardrobe_" + email) || "[]");
    }

    function removeClothing(email, itemId) {
        return new Promise(async (resolve) => {
            const key = "wardrobe_" + email;
            const wardrobe = JSON.parse(localStorage.getItem(key) || "[]");
            const filtered = wardrobe.filter((item) => item.id !== itemId);
            persistWardrobe(email, filtered);
            if (hasApi()) ApiClient.removeWardrobeItem(email, itemId).catch(() => {});
            resolve(filtered);
        });
    }

    function updateClothingColor(email, itemId, newColor, newColorHex) {
        return new Promise(async (resolve) => {
            const key = "wardrobe_" + email;
            const wardrobe = JSON.parse(localStorage.getItem(key) || "[]");
            const item = wardrobe.find((it) => it.id === itemId);
            if (item) {
                item.color = newColor || "Unknown";
                item.colorHex = newColorHex || "";
                persistWardrobe(email, wardrobe);
                if (hasApi()) ApiClient.updateWardrobeItem(email, itemId, { color: newColor, colorHex: newColorHex }).catch(() => {});
                resolve(item);
            } else {
                resolve(null);
            }
        });
    }

    function updateClothingCategory(email, itemId, newCategory) {
        return new Promise(async (resolve) => {
            const key = "wardrobe_" + email;
            const wardrobe = JSON.parse(localStorage.getItem(key) || "[]");
            const item = wardrobe.find((it) => it.id === itemId);
            if (item) {
                item.category = newCategory;
                persistWardrobe(email, wardrobe);
                if (hasApi()) ApiClient.updateWardrobeItem(email, itemId, { category: newCategory }).catch(() => {});
                resolve(item);
            } else {
                resolve(null);
            }
        });
    }

    async function getUser(email) {
        // Try API first
        if (hasApi()) {
            try {
                const user = await ApiClient.getUser(email);
                if (user) return user;
            } catch (e) { /* fallback */ }
        }
        const normalizedEmail = normalizeEmail(email);
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        return users.find((u) => normalizeEmail(u.email) === normalizedEmail) || null;
    }

    function clearWardrobe(email) {
        localStorage.removeItem("wardrobe_" + email);
    }

    global.DB = {
        createUser,
        login,
        logout,
        addClothesObjects,
        addClothesFromFileList,
        getWardrobe,
        getUser,
        clearWardrobe,
        removeClothing,
        updateClothingColor,
        updateClothingCategory,
        isValidEmail,
        normalizeEmail,
    };
})(window);
