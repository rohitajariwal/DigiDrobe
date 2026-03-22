(function () {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileMeasurements = document.getElementById("profileMeasurements");
    const profileAvatarLg = document.getElementById("profileAvatarLg");
    const profileWardrobeCount = document.getElementById("profileWardrobeCount");
    const profileCategoryCount = document.getElementById("profileCategoryCount");
    const profileMemberSince = document.getElementById("profileMemberSince");
    const detailFullName = document.getElementById("detailFullName");
    const detailEmail = document.getElementById("detailEmail");
    const detailMeasurements = document.getElementById("detailMeasurements");
    const profileFilter = document.getElementById("profileFilter");
    const profileFilterTag = document.getElementById("profileFilterTag");
    const profileClearFilter = document.getElementById("profileClearFilter");
    const wardrobeGrid = document.getElementById("profileWardrobe");
    const logoutProfile = document.getElementById("logoutProfile");
    const editMeasurementsBtn = document.getElementById("editMeasurementsBtn");
    const measurementsDisplay = document.getElementById("measurementsDisplay");
    const measurementsForm = document.getElementById("measurementsForm");
    const measurementsFormElement = document.getElementById("measurementsFormElement");
    const cancelMeasurementsBtn = document.getElementById("cancelMeasurementsBtn");
    const displayHeight = document.getElementById("displayHeight");
    const displayChest = document.getElementById("displayChest");
    const displayWaist = document.getElementById("displayWaist");
    const displayHips = document.getElementById("displayHips");
    const avatarFileInput = document.getElementById("avatarFileInput");

    const CLOTHING_CATEGORIES = ['Shirt', 'Top/T-Shirt', 'Trouser/Jeans', 'Skirt', 'Jacket', 'Dress'];
    const COLOR_OPTIONS = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Pink', 'Brown', 'Navy', 'Maroon', 'Beige', 'Cream', 'Gray', 'Black', 'White', 'Unknown'];
    const COLOR_MAP = {
        'Red': '#E74C3C', 'Orange': '#E67E22', 'Yellow': '#F1C40F',
        'Green': '#27AE60', 'Cyan': '#1ABC9C', 'Blue': '#3498DB',
        'Purple': '#9B59B6', 'Pink': '#E91E90', 'Brown': '#8B4513',
        'Navy': '#1B2A4A', 'Maroon': '#800020', 'Beige': '#D4B896',
        'Cream': '#FFFDD0', 'Gray': '#808080',
        'Black': '#000000', 'White': '#FFFFFF', 'Unknown': '#808080'
    };

    let userInfo = null;
    let wardrobeCache = [];

    logoutProfile?.addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        window.location.href = "login.html";
    });

    function fetchUser() {
        if (window.DB && typeof DB.getUser === "function") {
            userInfo = DB.getUser(currentUser);
        }
        if (!userInfo) {
            try {
                const users = JSON.parse(localStorage.getItem("users") || "[]");
                userInfo = users.find(u => u.email === currentUser) || null;
            } catch (err) {
                userInfo = null;
            }
        }
    }

    function getWardrobe() {
        if (window.DB && typeof DB.getWardrobe === "function") {
            return DB.getWardrobe(currentUser) || [];
        }
        const key = "wardrobe_" + currentUser;
        return JSON.parse(localStorage.getItem(key) || "[]");
    }

    function getDisplayName() {
        if (userInfo?.name) return userInfo.name;
        return currentUser.split("@")[0];
    }

    function getInitials() {
        const raw = userInfo?.name || currentUser;
        const letters = raw
            .split(/[\s@._-]+/)
            .filter(Boolean)
            .map(part => part[0])
            .join("")
            .slice(0, 2);
        return letters ? letters.toUpperCase() : "DD";
    }

    function formatDate(dateStr) {
        if (!dateStr) return "—";
        const dt = new Date(dateStr);
        if (Number.isNaN(dt.getTime())) return "—";
        return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function parseMeasurements(measurementsStr) {
        if (!measurementsStr) return null;
        try {
            const parsed = JSON.parse(measurementsStr);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
        } catch (e) {
            const parts = measurementsStr.split(';');
            const result = {};
            parts.forEach(part => {
                const match = part.trim().match(/(\w+):\s*(\d+(?:\.\d+)?)/i);
                if (match) {
                    const key = match[1].toLowerCase();
                    const value = parseFloat(match[2]);
                    if (key.includes('height')) result.height = value;
                    else if (key.includes('chest') || key.includes('bust')) result.chest = value;
                    else if (key.includes('waist')) result.waist = value;
                    else if (key.includes('hip')) result.hips = value;
                }
            });
            return Object.keys(result).length > 0 ? result : null;
        }
        return null;
    }

    function formatMeasurements(measurements) {
        if (!measurements) return "Not provided";
        const parts = [];
        if (measurements.height) parts.push(`Height: ${measurements.height}cm`);
        if (measurements.chest) parts.push(`Chest: ${measurements.chest}cm`);
        if (measurements.waist) parts.push(`Waist: ${measurements.waist}cm`);
        if (measurements.hips) parts.push(`Hips: ${measurements.hips}cm`);
        return parts.length > 0 ? parts.join('; ') : "Not provided";
    }

    /* ---- Profile Photo ---- */

    function loadProfilePhoto() {
        const photoData = localStorage.getItem("profilePhoto_" + currentUser);
        if (photoData && profileAvatarLg) {
            profileAvatarLg.innerHTML = `<img src="${photoData}" alt="Profile photo">`;
        }
    }

    function initProfilePhoto() {
        avatarFileInput?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    // Resize to 200x200 for storage efficiency
                    const canvas = document.createElement("canvas");
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d");

                    // Center-crop the image to a square
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

                    const dataURL = canvas.toDataURL("image/jpeg", 0.85);
                    localStorage.setItem("profilePhoto_" + currentUser, dataURL);

                    if (profileAvatarLg) {
                        profileAvatarLg.innerHTML = `<img src="${dataURL}" alt="Profile photo">`;
                    }
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ---- Hydrate Profile ---- */

    function hydrateProfile() {
        const name = getDisplayName();
        const measurementsObj = parseMeasurements(userInfo?.measurements);
        const measurements = formatMeasurements(measurementsObj);

        profileName && (profileName.textContent = name);
        profileEmail && (profileEmail.textContent = currentUser);
        profileMeasurements && (profileMeasurements.textContent = `Measurements: ${measurements}`);
        detailFullName && (detailFullName.textContent = userInfo?.name || name);
        detailEmail && (detailEmail.textContent = currentUser);
        detailMeasurements && (detailMeasurements.textContent = measurements);
        profileMemberSince && (profileMemberSince.textContent = formatDate(userInfo?.createdAt));

        // Load profile photo or show initials
        const photoData = localStorage.getItem("profilePhoto_" + currentUser);
        if (photoData && profileAvatarLg) {
            profileAvatarLg.innerHTML = `<img src="${photoData}" alt="Profile photo">`;
        } else if (profileAvatarLg) {
            profileAvatarLg.textContent = getInitials();
        }

        // Update measurements display
        if (measurementsObj) {
            displayHeight && (displayHeight.textContent = measurementsObj.height ? `${measurementsObj.height} cm` : "—");
            displayChest && (displayChest.textContent = measurementsObj.chest ? `${measurementsObj.chest} cm` : "—");
            displayWaist && (displayWaist.textContent = measurementsObj.waist ? `${measurementsObj.waist} cm` : "—");
            displayHips && (displayHips.textContent = measurementsObj.hips ? `${measurementsObj.hips} cm` : "—");
        } else {
            displayHeight && (displayHeight.textContent = "—");
            displayChest && (displayChest.textContent = "—");
            displayWaist && (displayWaist.textContent = "—");
            displayHips && (displayHips.textContent = "—");
        }
    }

    function updateStats() {
        const total = wardrobeCache.length;
        const categories = new Set(wardrobeCache.map(it => it.category || "Uncategorized"));
        profileWardrobeCount && (profileWardrobeCount.textContent = `${total} ${total === 1 ? "item" : "items"}`);
        profileCategoryCount && (profileCategoryCount.textContent = categories.size);
    }

    /* ---- Wardrobe Item Update Helpers ---- */

    function updateItemInStorage(itemId, updates) {
        const key = "wardrobe_" + currentUser;
        const items = JSON.parse(localStorage.getItem(key) || "[]");
        const item = items.find(it => it.id === itemId);
        if (item) {
            Object.assign(item, updates);
            localStorage.setItem(key, JSON.stringify(items));
            wardrobeCache = items;
        }
    }

    function handleCategoryChange(itemId, newCategory) {
        updateItemInStorage(itemId, { category: newCategory });
        updateStats();
        updateFilterOptions(wardrobeCache);
        renderWardrobe();
    }

    function handleColorChange(itemId, newColor) {
        const newColorHex = COLOR_MAP[newColor] || '#808080';
        updateItemInStorage(itemId, { color: newColor, colorHex: newColorHex });
        renderWardrobe();
    }

    /* ---- Build Wardrobe Card with Inline Editing ---- */

    function buildWardrobeCard(item) {
        const displayCategory = item.category || "Uncategorized";
        const displayColor = item.color || "Unknown";
        const colorHex = item.colorHex || COLOR_MAP[displayColor] || '#808080';

        const categoryOptions = CLOTHING_CATEGORIES.map(cat =>
            `<option value="${cat}" ${cat === displayCategory ? 'selected' : ''}>${cat}</option>`
        ).join('');

        const colorOptions = COLOR_OPTIONS.map(c =>
            `<option value="${c}" ${c === displayColor ? 'selected' : ''}>${c}</option>`
        ).join('');

        return `
            <div class="wardrobe-item" data-item-id="${item.id}">
                <button class="wardrobe-delete" type="button" data-id="${item.id}" aria-label="Remove ${item.name}">×</button>
                <img src="${item.dataURL}" alt="${item.name}">
                <div class="wardrobe-meta">
                    <strong>${item.name || 'Unnamed'}</strong>
                    <div class="wardrobe-edit-row">
                        <span class="category-label" title="Click to change type">${displayCategory}</span>
                        <button class="edit-icon-btn edit-category-btn" type="button" title="Edit type">&#9998;</button>
                        <select class="inline-edit-select category-select" style="display:none;" data-id="${item.id}">
                            ${categoryOptions}
                        </select>
                    </div>
                    <div class="wardrobe-edit-row">
                        <span class="color-dot-sm" style="background:${colorHex}"></span>
                        <span class="color-label" title="Click to change color">${displayColor}</span>
                        <button class="edit-icon-btn edit-color-btn" type="button" title="Edit color">&#9998;</button>
                        <select class="inline-edit-select color-select" style="display:none;" data-id="${item.id}">
                            ${colorOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    function updateFilterOptions(items) {
        if (!profileFilter) return;
        const categories = Array.from(new Set(items.map(it => it.category || "Uncategorized"))).sort();
        const currentValue = profileFilter.value;
        profileFilter.innerHTML = '<option value="">All categories</option>';
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            profileFilter.appendChild(option);
        });
        if (currentValue && categories.includes(currentValue)) {
            profileFilter.value = currentValue;
        }
        toggleFilterTag();
    }

    function toggleFilterTag() {
        if (!profileFilter) return;
        const cat = profileFilter.value;
        profileFilterTag && (profileFilterTag.textContent = cat ? `Filtering by ${cat}` : "");
        profileClearFilter?.classList.toggle("hidden", !cat);
    }

    function renderWardrobe() {
        if (!wardrobeGrid) return;
        const selectedCategory = profileFilter?.value || "";
        const filtered = selectedCategory
            ? wardrobeCache.filter(item => (item.category || "Uncategorized") === selectedCategory)
            : wardrobeCache;

        if (!filtered.length) {
            wardrobeGrid.innerHTML = `<div class="empty-state">${selectedCategory ? "No clothes in this category." : "No clothes uploaded yet."}</div>`;
            return;
        }

        wardrobeGrid.innerHTML = filtered.map(buildWardrobeCard).join("");

        // Bind delete buttons
        wardrobeGrid.querySelectorAll(".wardrobe-delete").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                const id = btn.getAttribute("data-id");
                removeWardrobeItem(id);
            });
        });

        // Bind category edit buttons and selects
        wardrobeGrid.querySelectorAll(".edit-category-btn").forEach((btn) => {
            const item = btn.closest(".wardrobe-item");
            const label = item.querySelector(".category-label");
            const select = item.querySelector(".category-select");

            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                label.style.display = "none";
                btn.style.display = "none";
                select.style.display = "inline-block";
                setTimeout(() => select.focus(), 10);
            });

            select.addEventListener("change", (e) => {
                e.stopPropagation();
                handleCategoryChange(select.dataset.id, select.value);
            });

            select.addEventListener("blur", () => {
                select.style.display = "none";
                label.style.display = "inline";
                btn.style.display = "";
            });
        });

        // Bind color edit buttons and selects
        wardrobeGrid.querySelectorAll(".edit-color-btn").forEach((btn) => {
            const item = btn.closest(".wardrobe-item");
            const label = item.querySelector(".color-label");
            const select = item.querySelector(".color-select");

            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                label.style.display = "none";
                btn.style.display = "none";
                item.querySelector(".color-dot-sm").style.display = "none";
                select.style.display = "inline-block";
                setTimeout(() => select.focus(), 10);
            });

            select.addEventListener("change", (e) => {
                e.stopPropagation();
                handleColorChange(select.dataset.id, select.value);
            });

            select.addEventListener("blur", () => {
                select.style.display = "none";
                label.style.display = "inline";
                btn.style.display = "";
                item.querySelector(".color-dot-sm").style.display = "";
            });
        });
    }

    async function removeWardrobeItem(itemId) {
        if (!itemId) return;
        try {
            if (window.DB && typeof DB.removeClothing === "function") {
                wardrobeCache = await DB.removeClothing(currentUser, itemId);
            } else {
                const key = "wardrobe_" + currentUser;
                wardrobeCache = JSON.parse(localStorage.getItem(key) || "[]").filter(item => item.id !== itemId);
                localStorage.setItem(key, JSON.stringify(wardrobeCache));
            }
        } catch (err) {
            console.error("Remove wardrobe item failed", err);
            return;
        }

        updateStats();
        updateFilterOptions(wardrobeCache);
        renderWardrobe();
    }

    function initFilters() {
        profileFilter?.addEventListener("change", () => {
            toggleFilterTag();
            renderWardrobe();
        });

        profileClearFilter?.addEventListener("click", () => {
            profileFilter.value = "";
            toggleFilterTag();
            renderWardrobe();
        });
    }

    function initMeasurements() {
        editMeasurementsBtn?.addEventListener("click", () => {
            const measurementsObj = parseMeasurements(userInfo?.measurements);
            if (measurementsObj) {
                document.getElementById("heightInput").value = measurementsObj.height || "";
                document.getElementById("chestInput").value = measurementsObj.chest || "";
                document.getElementById("waistInput").value = measurementsObj.waist || "";
                document.getElementById("hipsInput").value = measurementsObj.hips || "";
            }
            measurementsDisplay.classList.add("hidden");
            measurementsForm.classList.remove("hidden");
        });

        cancelMeasurementsBtn?.addEventListener("click", () => {
            measurementsDisplay.classList.remove("hidden");
            measurementsForm.classList.add("hidden");
        });

        measurementsFormElement?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const measurementsObj = {
                height: parseFloat(document.getElementById("heightInput").value) || null,
                chest: parseFloat(document.getElementById("chestInput").value) || null,
                waist: parseFloat(document.getElementById("waistInput").value) || null,
                hips: parseFloat(document.getElementById("hipsInput").value) || null
            };

            Object.keys(measurementsObj).forEach(key => {
                if (measurementsObj[key] === null) delete measurementsObj[key];
            });

            const measurementsStr = Object.keys(measurementsObj).length > 0
                ? JSON.stringify(measurementsObj)
                : "";

            try {
                const users = JSON.parse(localStorage.getItem("users") || "[]");
                const userIndex = users.findIndex(u => u.email === currentUser);
                if (userIndex !== -1) {
                    users[userIndex].measurements = measurementsStr;
                    localStorage.setItem("users", JSON.stringify(users));
                    userInfo = users[userIndex];
                    hydrateProfile();
                    measurementsDisplay.classList.remove("hidden");
                    measurementsForm.classList.add("hidden");
                    localStorage.setItem("measurementsUpdated", "true");
                }
            } catch (err) {
                console.error("Failed to save measurements:", err);
                alert("Failed to save measurements. Please try again.");
            }
        });
    }

    function init() {
        fetchUser();
        hydrateProfile();
        initProfilePhoto();
        wardrobeCache = getWardrobe();
        updateStats();
        updateFilterOptions(wardrobeCache);
        renderWardrobe();
        initFilters();
        initMeasurements();
    }

    init();
})();
