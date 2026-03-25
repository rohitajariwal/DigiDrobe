// app.js — upload → classify → store → flat-lay outfit styling

(function() {

        // --------------------------
        //  UI ELEMENTS
        // --------------------------
        const fileInput = document.getElementById("fileInput");
        const wardrobeEl = document.getElementById("wardrobeList") || document.getElementById("wardrobe");
        const modelStatusEl = document.getElementById("modelStatus");
        const logoutBtn = document.getElementById("logoutBtn");
        const categoryFilter = document.getElementById("categoryFilter");
        const colorFilter = document.getElementById("colorFilter");
        const clearFilterBtn = document.getElementById("clearFilter");
        // Support either legacy id="productUrl" (current markup) or older id="productUrlInput"
        const productUrlInput = document.getElementById("productUrl") || document.getElementById("productUrlInput");
        const importProductBtn = document.getElementById("importProductBtn");
        const importMsgEl = document.getElementById("importMsg");
        const userEmailEl = document.getElementById("userEmail");
        const profileGreeting = document.getElementById("profileGreeting");
        const profileSubtext = document.getElementById("profileSubtext");
        const wardrobeTitleEl = document.getElementById("wardrobeTitle");
        const wardrobeCountEl = document.getElementById("wardrobeCount");
        const flatLayCanvas = document.getElementById("flatLayCanvas");
        const clearOutfitBtn = document.getElementById("clearOutfitBtn");
        const saveOutfitBtn = document.getElementById("saveOutfitBtn");
        const savedOutfitsList = document.getElementById("savedOutfitsList");
        const currentUser = localStorage.getItem("currentUser");
        let wardrobeCache = [];
        let currentUserInfo = null;
        let currentOutfit = {
            items: [] // Array of {item, x, y, id}
        };
        let draggedElement = null;
        let dragOffset = { x: 0, y: 0 };

        let selectedCanvasItem = null;
        let canvasZoom = 1;
        let canvasPanX = 0;
        let canvasPanY = 0;
const floatingToolbar = document.getElementById('floatingToolbar');


        // Display current user email
        if (userEmailEl && currentUser) {
            userEmailEl.textContent = currentUser;
            userEmailEl.setAttribute('href', 'profile.html');
            userEmailEl.title = "View profile";
        }

        if (!currentUser) {
            console.warn("No logged-in user → redirecting.");
            window.location.href = 'login.html';
            return;
        }

        console.log("App started for user:", currentUser);

        // Unit conversion helpers
        const CM_TO_INCH = 0.393701;
        const INCH_TO_CM = 2.54;

        function convertToCM(value, unit) {
            return unit === 'in' ? value * INCH_TO_CM : value;
        }

        function convertFromCM(value, unit) {
            return unit === 'in' ? value * CM_TO_INCH : value;
        }



        // --------------------------
        //  PROFILE + FILTER HELPERS
        // --------------------------
        function fetchUserInfo() {
            if (!currentUser) return;
            if (window.DB && typeof DB.getUser === 'function') {
                currentUserInfo = DB.getUser(currentUser);
            }
            if (!currentUserInfo) {
                try {
                    const users = JSON.parse(localStorage.getItem("users") || "[]");
                    currentUserInfo = users.find(u => u.email === currentUser) || null;
                } catch (err) {
                    currentUserInfo = null;
                }
            }
        }

        function getDisplayName() {
            if (currentUserInfo && currentUserInfo.name) return currentUserInfo.name;
            if (!currentUser) return "there";
            return currentUser.split("@")[0];
        }

        function getPossessiveName() {
            const name = getDisplayName().split(" ")[0] || "Your";
            return name.endsWith("s") ? `${name}'` : `${name}'s`;
        }

        function updateProfileCard(count = 0) {
            const name = getDisplayName();
            if (profileGreeting) profileGreeting.textContent = `Hi, ${name}!`;
            if (profileSubtext) {
                const msg = count ?
                    `You have ${count} ${count === 1 ? "piece" : "pieces"} ready to style.` :
                    "Upload a new piece to start styling.";
                profileSubtext.textContent = `${msg} Drag items from your wardrobe to the flat-lay canvas.`;
            }
            if (wardrobeCountEl) wardrobeCountEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
            if (wardrobeTitleEl) wardrobeTitleEl.textContent = `${getPossessiveName()} wardrobe`;
        }

        function updateFilterResetState() {
            if (!clearFilterBtn) return;
            const hasCategory = categoryFilter && categoryFilter.value;
            const hasColor = colorFilter && colorFilter.value;
            clearFilterBtn.classList.toggle('hidden', !(hasCategory || hasColor));
        }



        // --------------------------
        //  CLASSIFIER (OPTIONAL)
        // --------------------------
        if (window.Classifier && typeof Classifier.load === "function") {
            Classifier.load()
                .then(() => {
                    modelStatusEl.textContent = "loaded";
                    console.log("Classifier loaded");
                })
                .catch(() => {
                    modelStatusEl.textContent = "error";
                });
        } else {
            modelStatusEl.textContent = "not-present";
        }


        // --------------------------
        //  IMAGE HELPERS
        // --------------------------
        function fileToObjectURL(file) {
            return URL.createObjectURL(file);
        }

        function compressImage(file) {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const maxW = 600;
                    const scale = Math.min(1, maxW / img.width);

                    canvas.width = Math.floor(img.width * scale);
                    canvas.height = Math.floor(img.height * scale);

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    resolve(canvas.toDataURL("image/jpeg", 0.8));
                };
                img.src = URL.createObjectURL(file);
            });
        }


        // --------------------------
        //  HANDLE FILE UPLOAD with background removal
        // --------------------------
        async function handleFiles(fileList) {
            if (!fileList || !fileList.length) return;

            const files = Array.from(fileList);

            for (let f of files) {
                // IMAGE -> convert to base64 -> remove background -> classify -> store
                try {
                    // 1. Convert image to base64
                    const base64 = await compressImage(f);
                    let dataURL = base64;

                    // 2. Remove background using cloth-extractor
                    if (typeof extractClothing === 'function') {
                        try {
                            console.log('Removing background from uploaded image...');
                            dataURL = await extractClothing(dataURL);
                            console.log('Background removed successfully');
                        } catch (err) {
                            console.warn('Background removal failed, using original image:', err);
                            // Continue with original image if background removal fails
                        }
                    } else {
                        console.warn('extractClothing function not available, skipping background removal');
                    }

                    // 3. Category classification - MUST call Classifier.classifyBase64(dataURL)
                    let category = 'Uncategorized';
                    if (window.Classifier && typeof Classifier.classifyBase64 === 'function') {
                        try {
                            category = await Classifier.classifyBase64(dataURL);
                            console.log('Detected category:', category);
                        } catch (err) {
                            console.warn('Classifier error, using default category:', err);
                            category = 'Uncategorized';
                        }
                    } else {
                        console.log('Classifier not ready, using default category: Uncategorized');
                    }

                    // 4. Filter: Only store clothing items (topwear/bottomwear), ignore accessories
                    if (!isClothingItem(category)) {
                        console.log('Skipping non-clothing item:', category);
                        continue;
                    }

                    // 5. Color detection (optional)
                    let color = 'Unknown';
                    let colorHex = '';
                    if (window.ColorClassifier && typeof ColorClassifier.getDominantColorFromDataURL === 'function') {
                        try {
                            const res = await ColorClassifier.getDominantColorFromDataURL(dataURL);
                            if (res && res.name && res.name !== 'Unknown') {
                                color = res.name;
                                colorHex = res.hex || '';
                            }
                        } catch (err) {
                            console.warn('Color classifier error:', err);
                        }
                    }

                    // 6. Prepare item object - MUST contain: id, dataURL, category, color
                    const item = {
                        id: Date.now() + '_' + f.name,
                        name: 'Uploaded',
                        dataURL: dataURL,
                        category: category,
                        color: color,
                        colorHex: colorHex,
                        bgRemoved: true
                    };

                    // 7. Store in localStorage with key: wardrobe_<currentUser> (SINGLE source of truth)
                    const key = 'wardrobe_' + currentUser;
                    const arr = JSON.parse(localStorage.getItem(key) || '[]');
                    
                    // Safety check: prevent duplicates - do not push if item with same id already exists
                    const existingItem = arr.find(existing => existing.id === item.id);
                    if (!existingItem) {
                        arr.push(item);
                        localStorage.setItem(key, JSON.stringify(arr));
                        console.log('Stored item:', item);
                    } else {
                        console.warn('Item with id already exists, skipping duplicate:', item.id);
                    }
                } catch (err) {
                    console.error('Image read / process error', err);
                }
            }

            // 8. Ensure renderWardrobe() is called after upload completes
            renderWardrobe();
            // Re-setup drag and drop after wardrobe is rendered
            setupDragAndDrop();
        }



        // --------------------------
        //  RENDER WARDROBE LIST
        // --------------------------
        function getWardrobeItems() {
            if (!currentUser) {
                console.warn('getWardrobeItems: No current user');
                return [];
            }

            try {
                // Always read from localStorage key "wardrobe_<currentUser>" as primary source
                const key = 'wardrobe_' + currentUser;
                const stored = localStorage.getItem(key);

                if (stored) {
                    const items = JSON.parse(stored);
                    return Array.isArray(items) ? items : [];
                }

                // Fallback: try loading from DB asynchronously and re-render when ready
                if (window.DB && typeof DB.getWardrobe === 'function') {
                    DB.getWardrobe(currentUser).then(function(dbItems) {
                        if (Array.isArray(dbItems) && dbItems.length > 0) {
                            localStorage.setItem(key, JSON.stringify(dbItems));
                            renderWardrobe();
                        }
                    }).catch(function() {});
                }

                return [];
            } catch (err) {
                console.error('getWardrobeItems: Error reading wardrobe items', err);
                return [];
            }
        }

        function rebuildSelectOptions(selectEl, label, values) {
            if (!selectEl) return;
            const currentValue = selectEl.value;
            selectEl.innerHTML = `<option value="">${label}</option>`;
            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                selectEl.appendChild(option);
            });
            // Only preserve the current value if it's still in the available values
            if (currentValue && values.includes(currentValue)) {
                selectEl.value = currentValue;
            } else if (currentValue) {
                // Reset to empty if the selected value is no longer available
                selectEl.value = '';
            }
        }

        function updateCategoryFilter(itemsParam) {
            if (!categoryFilter) return;
            const items = Array.isArray(itemsParam) ? itemsParam : getWardrobeItems();
            // Only show categories for clothing items (topwear/bottomwear)
            const clothingItems = items.filter(item => isClothingItem(item.category));
            const categories = Array.from(new Set(clothingItems.map(item => item.category || 'Uncategorized'))).sort();
            rebuildSelectOptions(categoryFilter, 'All categories', categories);
            updateFilterResetState();
        }

        function updateColorFilter(itemsParam) {
            if (!colorFilter) return;
            const items = Array.isArray(itemsParam) ? itemsParam : getWardrobeItems();
            const colors = Array.from(new Set(items.map(item => item.color || 'Unknown'))).sort();
            rebuildSelectOptions(colorFilter, 'All colors', colors);
            updateFilterResetState();
        }

        // --------------------------
        //  FLAT-LAY CANVAS FUNCTIONS
        // --------------------------
        
        // Check if item is clothing (topwear or bottomwear) - ignore accessories
        function isClothingItem(category) {
            if (!category) return false;
            const cat = category.toLowerCase();
            // Topwear: Shirt, Top/T-Shirt, Jacket, Dress
            const isTopwear = cat.includes('shirt') || cat.includes('top') || cat.includes('t-shirt') || 
                              cat.includes('jacket') || cat.includes('dress') || cat.includes('blouse');
            // Bottomwear: Trouser, Jeans, Skirt, Pants
            const isBottomwear = cat.includes('trouser') || cat.includes('jeans') || cat.includes('pants') || 
                                cat.includes('skirt') || cat.includes('bottom');
            return isTopwear || isBottomwear;
        }
        
        // Determine item type for filtering
        // function getItemType(category) {
        //     if (!category) return null;
        //     const cat = category.toLowerCase();
        //     if (cat.includes('shirt') || cat.includes('top') || cat.includes('t-shirt') || 
        //         cat.includes('jacket') || cat.includes('dress') || cat.includes('blouse')) {
        //         return 'topwear';
        //     }
        //     if (cat.includes('trouser') || cat.includes('jeans') || cat.includes('pants') || 
        //         cat.includes('skirt') || cat.includes('bottom')) {
        //         return 'bottomwear';
        //     }
        //     return null;
        // }
        
        // Add item to canvas at position
        function addItemToCanvas(item, x, y) {
            if (!item || !isClothingItem(item.category)) {
                console.warn('Item is not a clothing item (topwear/bottomwear), ignoring:', item.category);
                return false;
            }
            
            // Remove item if it already exists on canvas
            currentOutfit.items = currentOutfit.items.filter(it => it.item.id !== item.id);
            

  const maxZ = Math.max(
  0,
  ...currentOutfit.items.map(i => i.zIndex || 0)
);

const canvasItem = {
  id: Date.now().toString() + '_' + item.id,
  item: item,
  x: x || 50,
  y: y || 50,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  zIndex: maxZ + 1
};



            
            currentOutfit.items.push(canvasItem);
            renderCanvas();
            return true;
        }
        
        // Remove item from canvas
        function removeItemFromCanvas(itemId) {
            currentOutfit.items = currentOutfit.items.filter(it => it.id !== itemId);
            renderCanvas();
        }
        
        // Render canvas with all items
        function renderCanvas() {
            if (!flatLayCanvas) return;
            
            // Clear canvas
            flatLayCanvas.innerHTML = '';
            
            // Show/hide empty state
            const existingEmptyState = flatLayCanvas.querySelector('.canvas-empty-state');
            if (currentOutfit.items.length === 0) {
                if (!existingEmptyState) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'canvas-empty-state';
                    emptyState.textContent = 'Drag clothing items from your wardrobe to create your outfit';
                    flatLayCanvas.appendChild(emptyState);
                }
            } else {
                if (existingEmptyState) {
                    existingEmptyState.remove();
                }
            }
            
            // Render each item
            currentOutfit.items.forEach(canvasItem => {
                const itemEl = document.createElement('div');
                itemEl.className = 'canvas-item';
                const scale = canvasItem.scale || 1;
                const rotation = canvasItem.rotation || 0;
                const scaleX = canvasItem.flipX ? -scale : scale;
                const scaleY = canvasItem.flipY ? -scale : scale;
                itemEl.style.left = canvasItem.x + 'px';
                itemEl.style.top = canvasItem.y + 'px';
                itemEl.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`;
                itemEl.style.transformOrigin = 'center center';
                itemEl.style.zIndex = canvasItem.zIndex || 1;
                itemEl.setAttribute('data-item-id', canvasItem.id);
                
                
                const img = document.createElement('img');
                img.src = canvasItem.item.dataURL;
                img.alt = canvasItem.item.name || 'Clothing item';
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'item-remove-btn';
                removeBtn.textContent = '×';
                removeBtn.setAttribute('aria-label', 'Remove item');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeItemFromCanvas(canvasItem.id);
                });
                
                itemEl.appendChild(img);
                itemEl.appendChild(removeBtn);

                


                const resizeHandle = document.createElement('div');
resizeHandle.className = 'resize-handle';
itemEl.appendChild(resizeHandle);

                
                // Make draggable
                setupItemDrag(itemEl, canvasItem);
                setupResize(itemEl, canvasItem);
                
               itemEl.addEventListener('click', (e) => {
  e.stopPropagation();
  selectCanvasItem(canvasItem, itemEl);
});

                flatLayCanvas.appendChild(itemEl);
            });
        }

        function selectCanvasItem(canvasItem, itemEl) {
  selectedCanvasItem = canvasItem;

  // Highlight selected item
  flatLayCanvas.querySelectorAll('.canvas-item').forEach(el => el.classList.remove('selected'));
  itemEl.classList.add('selected');

const rect = itemEl.getBoundingClientRect();

// Position toolbar slightly ABOVE and CENTERED on the item
floatingToolbar.style.left =
  rect.left + rect.width / 2 - floatingToolbar.offsetWidth / 2 + 'px';

floatingToolbar.style.top =
  rect.top - floatingToolbar.offsetHeight - 8 + 'px';


  floatingToolbar.classList.remove('hidden');
}

        
        // Setup drag for canvas items
        function setupItemDrag(itemEl, canvasItem) {

            let isDragging = false;
  let startX, startY, startLeft, startTop;

            itemEl.addEventListener('mousedown', (e) => {
  // Ignore right-click
  if (e.button !== 0) return;

  // Ignore resize & remove
  if (
    e.target.classList.contains('resize-handle') ||
    e.target.classList.contains('item-remove-btn')
  ) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  const rect = itemEl.getBoundingClientRect();
  const canvasRect = flatLayCanvas.getBoundingClientRect();
  startLeft = rect.left - canvasRect.left;
  startTop = rect.top - canvasRect.top;

  itemEl.classList.add('dragging');
});

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const newX = startLeft + (e.clientX - startX);
                const newY = startTop + (e.clientY - startY);

                // Allow free movement - only soft-constrain to keep at least part visible
                const minVisible = -itemEl.offsetWidth + 30;
                const maxX = flatLayCanvas.offsetWidth - 30;
                const minVisibleY = -itemEl.offsetHeight + 30;
                const maxY = flatLayCanvas.offsetHeight - 30;

                const constrainedX = Math.max(minVisible, Math.min(newX, maxX));
                const constrainedY = Math.max(minVisibleY, Math.min(newY, maxY));

                itemEl.style.left = constrainedX + 'px';
                itemEl.style.top = constrainedY + 'px';
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    itemEl.classList.remove('dragging');

                    // Update position directly from element style
                    canvasItem.x = parseFloat(itemEl.style.left) || 0;
                    canvasItem.y = parseFloat(itemEl.style.top) || 0;
                }
            });
        }
        function setupResize(itemEl, canvasItem) {
  const handle = itemEl.querySelector('.resize-handle');
  if (!handle) return;

  let resizing = false;
  let startX, startScale;

  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startScale = canvasItem.scale || 1;
    document.body.style.cursor = 'nwse-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const delta = (e.clientX - startX) / 200;
    canvasItem.scale = Math.max(0.2, Math.min(4, startScale + delta));
    const rot = canvasItem.rotation || 0;
    const sx = canvasItem.flipX ? -canvasItem.scale : canvasItem.scale;
    const sy = canvasItem.flipY ? -canvasItem.scale : canvasItem.scale;
    itemEl.style.transform = `scale(${sx}, ${sy}) rotate(${rot}deg)`;
  });

  document.addEventListener('mouseup', () => {
    resizing = false;
    document.body.style.cursor = 'default';
  });
}




        
        // Clear entire outfit
        function clearOutfit() {
            currentOutfit.items = [];
            renderCanvas();
        }
        
        // Save current outfit
        function saveOutfit() {
  if (currentOutfit.items.length === 0) {
    alert('Please add at least one item to save an outfit.');
    return;
  }

  const note = document.getElementById('outfitNote')?.value?.trim() || '';

  const outfitName =
    note.length > 0
      ? note
      : `Outfit ${new Date().toLocaleDateString()}`;

  const outfit = {
    id: Date.now().toString(),
    name: outfitName,          // ✅ description becomes name
    note: note,
    items: currentOutfit.items.map(ci => ({
      item: ci.item,
      x: ci.x,
      y: ci.y,
      scale: ci.scale,
      rotation: ci.rotation || 0,
      flipX: ci.flipX || false,
      flipY: ci.flipY || false,
      zIndex: ci.zIndex
    })),
    createdAt: new Date().toISOString()
  };

  const key = 'savedOutfits_' + currentUser;
  const outfits = JSON.parse(localStorage.getItem(key) || '[]');
  outfits.unshift(outfit);
  try {
    localStorage.setItem(key, JSON.stringify(outfits));
  } catch (e) {
    // localStorage quota exceeded — still saved to API below
    console.warn('localStorage quota exceeded for saved outfits:', e.message);
  }

  // Also sync to API backend if available
  if (window.ApiClient && typeof ApiClient.saveOutfit === 'function') {
    ApiClient.saveOutfit(currentUser, outfit.name, outfit.note, outfit.items).catch(() => {});
  }

  renderSavedOutfits();
  alert('Outfit saved successfully!');
}

        
        // Load saved outfits
        function loadSavedOutfits() {
            const key = 'savedOutfits_' + currentUser;
            return JSON.parse(localStorage.getItem(key) || '[]');
        }
        
        // Render saved outfits list
        function renderSavedOutfits() {
            if (!savedOutfitsList) return;
            
            const outfits = loadSavedOutfits();
            
            if (outfits.length === 0) {
                savedOutfitsList.innerHTML = '<p class="tiny muted">No saved outfits yet. Create an outfit and click "Save Outfit" to save it here.</p>';
                return;
            }
            
            savedOutfitsList.innerHTML = outfits.map(outfit => {
                // Handle both old format (topwear/bottomwear) and new format (items array)
                let previewImgs = '';
                if (outfit.items && Array.isArray(outfit.items)) {
                    previewImgs = outfit.items.slice(0, 4).map(ci => 
                        `<img src="${ci.item.dataURL}" alt="${ci.item.name || 'Item'}">`
                    ).join('');
                } else {
                    // Legacy format support
                    const topImg = outfit.topwear ? `<img src="${outfit.topwear.dataURL}" alt="Top">` : '';
                    const bottomImg = outfit.bottomwear ? `<img src="${outfit.bottomwear.dataURL}" alt="Bottom">` : '';
                    previewImgs = topImg + bottomImg;
                }
                
                return `
                    <div class="saved-outfit-item" data-outfit-id="${outfit.id}">
                        <div class="saved-outfit-preview">
                            ${previewImgs}
                        </div>
                        <div class="saved-outfit-info">
                            <h4>${outfit.name}</h4>
                            <p>${new Date(outfit.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="saved-outfit-actions">
                            <button class="btn-ghost tiny load-outfit-btn" data-outfit-id="${outfit.id}">Load</button>
                            <button class="btn-ghost tiny delete-outfit-btn" data-outfit-id="${outfit.id}">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add event listeners
            savedOutfitsList.querySelectorAll('.load-outfit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const outfitId = btn.getAttribute('data-outfit-id');
                    loadOutfit(outfitId);
                });
            });
            
            savedOutfitsList.querySelectorAll('.delete-outfit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const outfitId = btn.getAttribute('data-outfit-id');
                    deleteOutfit(outfitId);
                });
            });
        }
        
        // Load an outfit
        function loadOutfit(outfitId) {
            const outfits = loadSavedOutfits();
            const outfit = outfits.find(o => o.id === outfitId);
            if (!outfit) return;
            
            // Handle both formats
            if (outfit.items && Array.isArray(outfit.items)) {
                currentOutfit.items = outfit.items.map(ci => ({
    id: Date.now().toString() + '_' + ci.item.id,
    item: ci.item,
    x: ci.x || 50,
    y: ci.y || 50,
    scale: ci.scale || 1,
    rotation: ci.rotation || 0,
    flipX: ci.flipX || false,
    flipY: ci.flipY || false,
    zIndex: ci.zIndex || 1
}));

            } else {
                // Legacy format - convert to new format
                currentOutfit.items = [];
                if (outfit.topwear) {
                    addItemToCanvas(outfit.topwear, 50, 50);
                }
                if (outfit.bottomwear) {
                    addItemToCanvas(outfit.bottomwear, 50, 150);
                }
            }
            renderCanvas();

        const noteEl = document.getElementById('outfitNote');
if (noteEl) noteEl.value = outfit.note || '';

        }
        
        // Delete an outfit
        function deleteOutfit(outfitId) {
            if (!confirm('Are you sure you want to delete this outfit?')) return;
            
            const key = 'savedOutfits_' + currentUser;
            const outfits = loadSavedOutfits().filter(o => o.id !== outfitId);
            localStorage.setItem(key, JSON.stringify(outfits));
            renderSavedOutfits();
        }
        
        // Setup drag and drop from wardrobe to canvas
        function setupDragAndDrop() {
            if (!flatLayCanvas) return;
            
            // Setup canvas as drop zone
            flatLayCanvas.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                flatLayCanvas.classList.add('drag-over');
            });
            
            flatLayCanvas.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                flatLayCanvas.classList.remove('drag-over');
            });
            
            flatLayCanvas.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                flatLayCanvas.classList.remove('drag-over');
                
                const itemId = e.dataTransfer.getData('text/plain');
                if (!itemId) return;
                
                const item = wardrobeCache.find(it => it.id === itemId);
                if (!item) {
                    const allItems = getWardrobeItems();
                    const foundItem = allItems.find(it => it.id === itemId);
                    if (foundItem) {
                        const rect = flatLayCanvas.getBoundingClientRect();
                        const x = e.clientX - rect.left - 100; // Offset for center of item
                        const y = e.clientY - rect.top - 100;
                        addItemToCanvas(foundItem, Math.max(0, x), Math.max(0, y));
                    }
                    return;
                }
                
                const rect = flatLayCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left - 100;
                const y = e.clientY - rect.top - 100;
                addItemToCanvas(item, Math.max(0, x), Math.max(0, y));
            });
        }

        async function deleteWardrobeItem(itemId) {
            if (!itemId) return;
            try {
                // Always update localStorage key "wardrobe_<currentUser>"
                const key = 'wardrobe_' + currentUser;
                const items = JSON.parse(localStorage.getItem(key) || '[]').filter(item => item.id !== itemId);
                localStorage.setItem(key, JSON.stringify(items));
                
                // Also update DB if available
                if (window.DB && typeof DB.removeClothing === 'function') {
                    await DB.removeClothing(currentUser, itemId);
                }
            } catch (err) {
                console.error('Remove wardrobe item failed', err);
            }
            renderWardrobe();
            // Re-setup drag and drop after wardrobe is rendered
            setupDragAndDrop();
        }

        async function updateItemColor(itemId, newColor, newColorHex) {
            if (!itemId || !newColor) return;
            try {
                // Always update localStorage key "wardrobe_<currentUser>"
                const key = 'wardrobe_' + currentUser;
                const items = JSON.parse(localStorage.getItem(key) || '[]');
                const item = items.find(it => it.id === itemId);
                if (item) {
                    item.color = newColor;
                    item.colorHex = newColorHex || '';
                    localStorage.setItem(key, JSON.stringify(items));
                }
                
                // Also update DB if available
                if (window.DB && typeof DB.updateClothingColor === 'function') {
                    await DB.updateClothingColor(currentUser, itemId, newColor, newColorHex);
                }
            } catch (err) {
                console.error('Update item color failed', err);
            }
            renderWardrobe();
            // Re-setup drag and drop after wardrobe is rendered
            setupDragAndDrop();
        }

        async function updateItemCategory(itemId, newCategory) {
            if (!itemId || !newCategory) return;
            try {
                const key = 'wardrobe_' + currentUser;
                const items = JSON.parse(localStorage.getItem(key) || '[]');
                const item = items.find(it => it.id === itemId);
                if (item) {
                    item.category = newCategory;
                    localStorage.setItem(key, JSON.stringify(items));
                }

                if (window.DB && typeof DB.updateClothingCategory === 'function') {
                    await DB.updateClothingCategory(currentUser, itemId, newCategory);
                }
            } catch (err) {
                console.error('Update item category failed', err);
            }
            renderWardrobe();
            setupDragAndDrop();
        }

        async function redetectItemColor(itemId) {
            if (!itemId) return;
            const items = getWardrobeItems();
            const item = items.find(it => it.id === itemId);
            if (!item || !item.dataURL) {
                console.warn('Cannot redetect color: item not found or no image data');
                return;
            }

            console.log('Re-detecting color for item:', item.name);
            let color = 'Unknown';
            let colorHex = '';

            if (window.ColorClassifier && typeof ColorClassifier.getDominantColorFromDataURL === 'function') {
                try {
                    const res = await ColorClassifier.getDominantColorFromDataURL(item.dataURL);
                    console.log('Re-detection result:', res);
                    if (res && res.name && res.name !== 'Unknown') {
                        color = res.name;
                        colorHex = res.hex || '';
                        await updateItemColor(itemId, color, colorHex);
                    } else {
                        console.warn('Re-detection returned Unknown:', res);
                    }
                } catch (err) {
                    console.error('Re-detection error:', err);
                }
            } else {
                console.warn('ColorClassifier not available for re-detection');
            }
        }

        function renderWardrobe() {
            // Never silently fail - check for required elements
            if (!wardrobeEl) {
                console.error('renderWardrobe: Wardrobe container element not found. Looking for "wardrobeList" or "wardrobe"');
                return;
            }

            if (!currentUser) {
                console.error('renderWardrobe: No current user found');
                wardrobeEl.innerHTML = '<p class="muted">Error: Not logged in.</p>';
                return;
            }

            try {
                // Clear the wardrobe container
                wardrobeEl.innerHTML = '';
                
                // Always read from localStorage key "wardrobe_<currentUser>"
                const items = getWardrobeItems();
                
                // Log wardrobe items to console as required
                console.log('renderWardrobe: Wardrobe items loaded:', items);
                console.log(`renderWardrobe: Total items: ${items.length}`);
                
                // Update cache and profile card
                wardrobeCache = items;
                updateProfileCard(items.length);

                // Get filter values
                const selectedCategory = categoryFilter ? categoryFilter.value : '';
                const selectedColor = colorFilter ? colorFilter.value : '';

                // Filter items: only show clothing items (topwear/bottomwear), ignore accessories
                let filteredItems = items.filter(item => isClothingItem(item.category));
                
                // Apply category and color filters if selected
                if (selectedCategory && selectedCategory !== 'all') {
                    filteredItems = filteredItems.filter(item => (item.category || 'Uncategorized') === selectedCategory);
                }
                if (selectedColor && selectedColor !== 'all') {
                    filteredItems = filteredItems.filter(item => (item.color || 'Unknown') === selectedColor);
                }
                
                // Update filter dropdowns with available categories and colors
                if (categoryFilter) updateCategoryFilter(items);
                if (colorFilter) updateColorFilter(items);
                if (!categoryFilter && !colorFilter) updateFilterResetState();

                // Show empty state if no items match filters
                if (!filteredItems.length) {
                    wardrobeEl.innerHTML = `<p class="muted">${(selectedCategory || selectedColor) ? 'No clothes match this filter.' : 'No clothes yet.'}</p>`;
                    return;
                }

                // Get all available colors for the color picker
                const availableColors = Array.from(new Set(items.map(item => item.color || 'Unknown'))).sort();
                const standardColors = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Pink', 'Brown', 'Navy', 'Maroon', 'Beige', 'Cream', 'Gray', 'Black', 'White', 'Unknown'];
                const allColors = Array.from(new Set([...standardColors, ...availableColors])).sort();

                // Render each filtered item
                filteredItems.forEach(item => {
                    try {
                        // Ensure item has required properties
                        if (!item || !item.id || !item.dataURL) {
                            console.warn('renderWardrobe: Skipping invalid item:', item);
                            return;
                        }

                        const tile = document.createElement('div');
                        tile.className = 'tile';
                        
                        // Get display values with fallbacks
                        const displayCategory = item.category || 'Uncategorized';
                        const displayColor = item.color || 'Unknown';
                        const colorHex = item.colorHex || '';
                        const colorDot = `<span class="color-dot" style="background:${colorHex || '#808080'}"></span>`;
                        const sourceLink = item.sourceUrl ? `<a class="source-link" href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">View ↗</a>` : '';
                        
                        // Available clothing categories for the type editor
                        const clothingCategories = ['Shirt', 'Top/T-Shirt', 'Trouser/Jeans', 'Skirt', 'Jacket', 'Dress'];

                        // Build tile HTML with thumbnail, category, and color
                        tile.innerHTML = `
                            <button class="tile-delete" type="button" aria-label="Remove item" title="Remove">×</button>
                            <img src="${item.dataURL}" class="thumb" alt="${item.name || 'Clothing item'}" onerror="this.style.display='none';">
                            <div class="meta">
                                <strong class="tile-name">${item.name || 'Uploaded'}</strong>
                                <div class="tile-edit-row" data-field="category">
                                    <span class="tile-field-label">Type</span>
                                    <span class="category-editable" data-item-id="${item.id}">
                                        <span class="category-text">${displayCategory}</span>
                                        <span class="tile-edit-icon">&#9998;</span>
                                        <select class="category-edit-select tile-select">
                                            ${clothingCategories.map(cat => `<option value="${cat}" ${cat === displayCategory ? 'selected' : ''}>${cat}</option>`).join('')}
                                        </select>
                                    </span>
                                </div>
                                <div class="tile-edit-row" data-field="color">
                                    <span class="tile-field-label">Color</span>
                                    <span class="color-editable" data-item-id="${item.id}">
                                        ${colorDot}
                                        <span class="color-text">${displayColor}</span>
                                        <span class="tile-edit-icon">&#9998;</span>
                                        <select class="color-edit-select tile-select">
                                            ${allColors.map(color => `<option value="${color}" ${color === displayColor ? 'selected' : ''}>${color}</option>`).join('')}
                                        </select>
                                        ${displayColor === 'Unknown' ? `<button class="redetect-color-btn" data-item-id="${item.id}" title="Re-detect color">↻</button>` : ''}
                                    </span>
                                </div>
                                ${sourceLink ? `<div class="tile-source">${sourceLink}</div>` : ''}
                            </div>`;

                        // Make items draggable for 2D styling canvas
                        tile.draggable = true;
                        tile.style.cursor = 'grab';
                        tile.addEventListener('dragstart', (e) => {
                            if (!e.dataTransfer) {
                                console.warn('dragstart: dataTransfer not available');
                                return;
                            }
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'move';
                            tile.style.opacity = '0.5';
                            console.log('Drag started for item:', item.id, 'Category:', item.category);
                        });
                        
                        tile.addEventListener('dragend', (e) => {
                            tile.style.opacity = '1';
                        });
                        
                        // Click to add to canvas (optional convenience feature)
                        tile.addEventListener('click', (e) => {
                            // Don't trigger if clicking on delete button, category editor, or color editor
                            if (e.target.closest('.tile-delete') || e.target.closest('.category-editable') || e.target.closest('.color-editable') || e.target.closest('.source-link')) {
                                return;
                            }
                            
                            // Add item to canvas at center position
                            if (flatLayCanvas) {
                                const rect = flatLayCanvas.getBoundingClientRect();
                                const centerX = rect.width / 2 - 100;
                                const centerY = rect.height / 2 - 100;
                                addItemToCanvas(item, centerX, centerY);
                            }
                        });

                        // Delete button handler
                        const deleteBtn = tile.querySelector('.tile-delete');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', (event) => {
                                event.stopPropagation();
                                console.log('Deleting wardrobe item:', item.id);
                                deleteWardrobeItem(item.id);
                            });
                        }

                        // Category (type) editing functionality
                        const categoryEditable = tile.querySelector('.category-editable');
                        const categorySelect = tile.querySelector('.category-edit-select');
                        const categoryText = tile.querySelector('.category-text');

                        if (categoryEditable && categorySelect) {
                            let isCatEditing = false;

                            categoryEditable.addEventListener('click', (event) => {
                                event.stopPropagation();
                                if (!isCatEditing) {
                                    isCatEditing = true;
                                    if (categoryText) categoryText.style.display = 'none';
                                    const editIcon = categoryEditable.querySelector('.edit-icon');
                                    if (editIcon) editIcon.style.display = 'none';
                                    categorySelect.style.display = 'inline-block';
                                    categorySelect.style.minWidth = '100px';
                                    setTimeout(() => categorySelect.focus(), 10);
                                }
                            });

                            categorySelect.addEventListener('change', async (event) => {
                                event.stopPropagation();
                                const newCategory = event.target.value;
                                await updateItemCategory(item.id, newCategory);
                                isCatEditing = false;
                            });

                            categorySelect.addEventListener('blur', () => {
                                if (isCatEditing) {
                                    isCatEditing = false;
                                    categorySelect.style.display = 'none';
                                    if (categoryText) categoryText.style.display = 'inline';
                                    const editIcon = categoryEditable.querySelector('.edit-icon');
                                    if (editIcon) editIcon.style.display = '';
                                }
                            });

                            categoryEditable.addEventListener('mousedown', (e) => e.stopPropagation());
                        }

                        // Color editing functionality
                        const colorEditable = tile.querySelector('.color-editable');
                        const colorSelect = tile.querySelector('.color-edit-select');
                        const colorText = tile.querySelector('.color-text');
                        
                        if (colorEditable && colorSelect) {
                            let isEditing = false;
                            
                            // Show dropdown on click
                            colorEditable.addEventListener('click', (event) => {
                                event.stopPropagation();
                                if (!isEditing) {
                                    isEditing = true;
                                    if (colorText) colorText.style.display = 'none';
                                    colorSelect.style.display = 'inline-block';
                                    colorSelect.style.minWidth = '80px';
                                    setTimeout(() => colorSelect.focus(), 10);
                                }
                            });

                            // Handle color change
                            colorSelect.addEventListener('change', async (event) => {
                                event.stopPropagation();
                                const newColor = event.target.value;
                                // Generate a simple hex color based on color name
                                const colorMap = {
                                    'Red': '#E74C3C', 'Orange': '#E67E22', 'Yellow': '#F1C40F',
                                    'Green': '#27AE60', 'Cyan': '#1ABC9C', 'Blue': '#3498DB',
                                    'Purple': '#9B59B6', 'Pink': '#E91E90', 'Brown': '#8B4513',
                                    'Navy': '#1B2A4A', 'Maroon': '#800020', 'Beige': '#D4B896',
                                    'Cream': '#FFFDD0', 'Gray': '#808080',
                                    'Black': '#000000', 'White': '#FFFFFF', 'Unknown': '#808080'
                                };
                                const newColorHex = colorMap[newColor] || item.colorHex || '#808080';
                                
                                await updateItemColor(item.id, newColor, newColorHex);
                                isEditing = false;
                            });

                            // Hide dropdown when clicking outside or losing focus
                            colorSelect.addEventListener('blur', () => {
                                if (isEditing) {
                                    isEditing = false;
                                    colorSelect.style.display = 'none';
                                    if (colorText) colorText.style.display = 'inline';
                                }
                            });

                            // Prevent tile click when interacting with color editor
                            colorEditable.addEventListener('mousedown', (e) => e.stopPropagation());
                        }

                        // Re-detect color button for Unknown colors
                        const redetectBtn = tile.querySelector('.redetect-color-btn');
                        if (redetectBtn) {
                            redetectBtn.addEventListener('click', async (event) => {
                                event.stopPropagation();
                                redetectBtn.disabled = true;
                                redetectBtn.textContent = '...';
                                await redetectItemColor(item.id);
                            });
                        }

                        // Prevent source link click from applying the garment
                        const link = tile.querySelector('.source-link');
                        if (link) {
                            link.addEventListener('click', (e) => e.stopPropagation());
                        }

                        wardrobeEl.appendChild(tile);
                    } catch (itemErr) {
                        console.error('renderWardrobe: Error rendering item:', item, itemErr);
                    }
                });

                console.log(`renderWardrobe: Successfully rendered ${filteredItems.length} items`);
            } catch (err) {
                console.error('renderWardrobe: Fatal error', err);
                wardrobeEl.innerHTML = '<p class="muted">Error loading wardrobe. Please refresh the page.</p>';
            }
        }

    // --------------------------
    //  PRODUCT LINK IMPORT
    // --------------------------
    async function imageUrlToDataUrlBestEffort(imageUrl) {
        // Try direct load + canvas
        const tryLoad = (url) => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => reject(new Error('Image download blocked'));
            img.src = url;
        });

        try {
            return await tryLoad(imageUrl);
        } catch {
            // Fallback via image proxy to avoid CORS (best-effort).
            // NOTE: relies on a third-party proxy; if blocked/unavailable, user can upload manually.
            const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//i, ''))}`;
            return await tryLoad(proxy);
        }
    }

    async function importProductFromUrl(url) {
        if (!importMsgEl) return;
        importMsgEl.textContent = '';

        const cleanUrl = (url || '').trim();
        if (!cleanUrl) {
            importMsgEl.textContent = 'Please paste a product image URL.';
            return;
        }

        if (!window.ProductImporter || typeof ProductImporter.fetchProductMeta !== 'function') {
            importMsgEl.textContent ='Invalid image URL. Please open the image in a new tab and copy the image address.';

            return;
        }

        try {
            if (importProductBtn) importProductBtn.disabled = true;
            importMsgEl.textContent = 'Fetching product page…';

            const meta = await ProductImporter.fetchProductMeta(cleanUrl);
            const name = meta.name || 'Imported';
            const imageUrl = (meta.imageUrls && meta.imageUrls[0]) ? meta.imageUrls[0] : '';
            const categoryFromHint = ProductImporter.mapToWardrobeCategory(`${meta.categoryHint || ''} ${name}`);

            if (!imageUrl) {
                importMsgEl.textContent = 'Could not find a product image. Try another link or upload the product image manually.';
                if (importProductBtn) importProductBtn.disabled = false;
                return;
            }

            importMsgEl.textContent = 'Downloading product image…';
            let dataURL;
            try {
                // Primary path: try to get a base64 DataURL (enables background removal & color detection)
                dataURL = await imageUrlToDataUrlBestEffort(imageUrl);
            } catch (e) {
                console.warn('Image proxy / download blocked, falling back to direct URL:', e);
                // Fallback: keep the original image URL so at least the wardrobe can display it.
                // NOTE: Background removal, classifier, and color detection will be skipped for non-DataURL.
                dataURL = imageUrl;
            }

            // Remove background using cloth-extractor.
            // We now let extractClothing handle both data URLs and direct image URLs internally.
            if (typeof extractClothing === 'function') {
                try {
                    importMsgEl.textContent = 'Removing background…';
                    console.log('Removing background from imported product image...');
                    dataURL = await extractClothing(dataURL);
                    console.log('Background removed successfully');
                } catch (err) {
                    console.warn('Background removal failed, using original image:', err);
                    // Continue with original image if background removal fails
                }
            }

            // Optional: ML category classifier (if model present and we have a DataURL)
            let category = categoryFromHint || 'Uncategorized';
            if (dataURL.startsWith('data:') && window.Classifier && typeof Classifier.classifyBase64 === 'function') {
                try {
                    category = await Classifier.classifyBase64(dataURL);
                    console.log('Detected category:', category);
                } catch (e) {
                    console.warn('Classifier error, using hint category:', e);
                    // keep hint category
                }
            }

            // Ensure imported items always count as clothing so they appear in the wardrobe.
            // If the classifier/hint cannot confidently mark it as clothing, default to Topwear.
            if (!isClothingItem(category)) {
                console.warn('Import: category not recognized as clothing, defaulting to Topwear:', category);
                category = 'Topwear';
            }

            // Dominant color detection (only when we have a DataURL)
            let color = 'Unknown';
            let colorHex = '';
            if (dataURL.startsWith('data:') && window.ColorClassifier && typeof ColorClassifier.getDominantColorFromDataURL === 'function') {
                try {
                    console.log('Detecting color for imported product:', name);
                    const res = await ColorClassifier.getDominantColorFromDataURL(dataURL);
                    console.log('Color detection result:', res);
                    if (res && res.name && res.name !== 'Unknown') {
                        color = res.name;
                        colorHex = res.hex || '';
                        console.log('Color detected:', color, colorHex);
                    } else {
                        console.warn('Color classifier returned Unknown or invalid result:', res);
                    }
                } catch (e) {
                    console.error('Color classifier error during import:', e);
                }
            } else {
                console.warn('ColorClassifier not available for import');
            }

            const item = {
                id: Date.now() + '_import',
                name,
                dataURL,
                category,
                color,
                colorHex,
                sourceUrl: cleanUrl,
                productImageUrl: imageUrl,
                sizes: meta.sizes || [],
                bgRemoved: true
            };

            // Persist item:
            // - If DB is available, let DB.addClothesObjects handle writing to localStorage (single source of truth)
            // - Otherwise, write directly to localStorage.
            if (window.DB && typeof DB.addClothesObjects === 'function') {
                await DB.addClothesObjects(currentUser, [item]);
            } else {
                const key = 'wardrobe_' + currentUser;
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                arr.push(item);
                localStorage.setItem(key, JSON.stringify(arr));
            }

            importMsgEl.textContent = `Imported: ${name} (${category}, ${color})`;
            renderWardrobe();
            // Re-setup drag and drop after wardrobe is rendered
            setupDragAndDrop();
        } catch (err) {
            console.error('Product import failed', err);
            const msg = (err && err.message) ? err.message : '';
            importMsgEl.textContent = msg
                ? msg
                : 'Import failed (site may block access). Supported: Myntra, Flipkart, Savana, Amazon. If blocked, download the product image and upload it instead.';
        } finally {
            if (importProductBtn) importProductBtn.disabled = false;
        }
    }


    // --------------------------
    //  EVENTS
    // --------------------------
    fileInput.addEventListener('change', e => {
        handleFiles(e.target.files);
        e.target.value = '';
    });

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            renderWardrobe();
            updateFilterResetState();
        });
    }

    if (colorFilter) {
        colorFilter.addEventListener('change', () => {
            renderWardrobe();
            updateFilterResetState();
        });
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
            if (categoryFilter) categoryFilter.value = '';
            if (colorFilter) colorFilter.value = '';
            updateFilterResetState();
            renderWardrobe();
            // Re-setup drag and drop after wardrobe is rendered
            setupDragAndDrop();
        });
    }

    if (importProductBtn) {
        importProductBtn.addEventListener('click', () => {
            importProductFromUrl(productUrlInput ? productUrlInput.value : '');
        });
    }

    if (productUrlInput) {
        productUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                importProductFromUrl(productUrlInput.value);
            }
        });
    }


    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });


    // Initialize user info and populate UI
    fetchUserInfo();
    updateProfileCard();
    
    // Initialize flat-lay canvas
    renderCanvas();
    renderSavedOutfits();
    
    // Setup drag and drop from wardrobe to canvas
    setupDragAndDrop();
    
    // Event listeners for outfit management
    if (clearOutfitBtn) {
        clearOutfitBtn.addEventListener('click', () => {
            clearOutfit();
        });
    }
    
    if (saveOutfitBtn) {
        saveOutfitBtn.addEventListener('click', () => {
            saveOutfit();
        });
    }

    // Render wardrobe (this makes items draggable)
    renderWardrobe();
    // Re-setup drag and drop after wardrobe is rendered to ensure everything is connected
    setupDragAndDrop();

    // --------------------------
    //  MINI RECOMMENDATIONS (Right Sidebar)
    // --------------------------
    function renderMiniRecommendations() {
        const grid = document.getElementById('recoMiniGrid');
        if (!grid) return;
        const RE = window.RecommendationEngine;
        if (!RE) { grid.innerHTML = '<p class="tiny muted">Recommendation engine not loaded.</p>'; return; }

        const items = wardrobeCache;
        if (items.length < 2) {
            grid.innerHTML = '<p class="tiny muted">Upload a top and a bottom to get recommendations.</p>';
            return;
        }

        const outfits = RE.getDailyRecommendations(items, { count: 5 });
        if (outfits.length === 0) {
            grid.innerHTML = '<p class="tiny muted">Add more variety to unlock recommendations.</p>';
            return;
        }

        const COLOR_MAP = {
            Red: "#E74C3C", Orange: "#E67E22", Yellow: "#F1C40F", Green: "#27AE60",
            Cyan: "#1ABC9C", Blue: "#3498DB", Purple: "#9B59B6", Pink: "#E91E90",
            Gray: "#95A5A6", Black: "#2C3E50", White: "#ECF0F1", Unknown: "#7F8C8D"
        };

        let html = '';
        outfits.forEach(outfit => {
            const scoreClass = outfit.score >= 80 ? 'score-high' : outfit.score >= 60 ? 'score-mid' : 'score-low';
            html += '<div class="reco-mini-card" title="Click to load this outfit on canvas">';
            html += '<div class="reco-mini-items">';
            outfit.items.forEach(item => {
                html += `<img src="${item.dataURL}" alt="${item.name}" />`;
            });
            html += '</div>';
            html += '<div class="reco-mini-footer">';
            html += `<span class="reco-label">${outfit.occasion}</span>`;
            html += `<span class="reco-score ${scoreClass}">${outfit.score}%</span>`;
            html += '</div></div>';
        });
        grid.innerHTML = html;

        // Click to load outfit onto canvas with proper outfit layout
        const cards = grid.querySelectorAll('.reco-mini-card');
        cards.forEach((card, idx) => {
            card.addEventListener('click', () => {
                if (outfits[idx]) {
                    clearOutfit();
                    currentOutfit.items = layoutOutfitItems(outfits[idx].items);
                    renderCanvas();
                }
            });
        });
    }

    // Categorize item for layout positioning
    function getItemLayoutType(category) {
        if (!category) return 'top';
        const cat = category.toLowerCase();
        if (cat.includes('trouser') || cat.includes('jeans') || cat.includes('pants') || cat.includes('skirt') || cat.includes('bottom')) return 'bottom';
        if (cat.includes('jacket') || cat.includes('blazer') || cat.includes('coat')) return 'layer';
        if (cat.includes('dress')) return 'fullbody';
        return 'top';
    }

    // Layout outfit items like a real outfit - top on top, bottom below, etc.
    function layoutOutfitItems(items) {
        if (!flatLayCanvas || items.length === 0) return [];
        const canvasRect = flatLayCanvas.getBoundingClientRect();
        const cw = canvasRect.width;
        const ch = canvasRect.height;
        const centerX = cw / 2 - 100; // center horizontally (assuming ~200px item width)

        const tops = [];
        const bottoms = [];
        const layers = [];
        const fullbody = [];

        items.forEach(item => {
            const type = getItemLayoutType(item.category);
            if (type === 'bottom') bottoms.push(item);
            else if (type === 'layer') layers.push(item);
            else if (type === 'fullbody') fullbody.push(item);
            else tops.push(item);
        });

        const result = [];
        let zIdx = 1;

        if (fullbody.length > 0) {
            // Dress: center vertically
            fullbody.forEach((item, i) => {
                const xOff = fullbody.length > 1 ? (i - (fullbody.length - 1) / 2) * 160 : 0;
                result.push({
                    id: 'reco_' + Date.now() + '_fb_' + i,
                    item: item,
                    x: centerX + xOff,
                    y: ch * 0.08,
                    scale: Math.min(1, ch / 500),
                    zIndex: zIdx++
                });
            });
            // Layer on top of dress
            layers.forEach((item, i) => {
                result.push({
                    id: 'reco_' + Date.now() + '_l_' + i,
                    item: item,
                    x: centerX - 10,
                    y: ch * 0.05,
                    scale: Math.min(0.9, ch / 550),
                    zIndex: zIdx++
                });
            });
        } else {
            // Top at upper portion
            const topY = ch * 0.05;
            tops.forEach((item, i) => {
                const xOff = tops.length > 1 ? (i - (tops.length - 1) / 2) * 140 : 0;
                result.push({
                    id: 'reco_' + Date.now() + '_t_' + i,
                    item: item,
                    x: centerX + xOff,
                    y: topY,
                    scale: Math.min(0.85, ch / 600),
                    zIndex: zIdx++
                });
            });

            // Bottom below the top
            const bottomY = ch * 0.45;
            bottoms.forEach((item, i) => {
                const xOff = bottoms.length > 1 ? (i - (bottoms.length - 1) / 2) * 140 : 0;
                result.push({
                    id: 'reco_' + Date.now() + '_b_' + i,
                    item: item,
                    x: centerX + xOff,
                    y: bottomY,
                    scale: Math.min(0.85, ch / 600),
                    zIndex: zIdx++
                });
            });

            // Layer overlaid slightly offset on top
            layers.forEach((item, i) => {
                result.push({
                    id: 'reco_' + Date.now() + '_l_' + i,
                    item: item,
                    x: centerX + 20,
                    y: ch * 0.02,
                    scale: Math.min(0.9, ch / 550),
                    zIndex: zIdx++
                });
            });
        }

        return result;
    }

    // Auto-arrange current canvas items into outfit layout
    function autoArrangeOutfit() {
        if (currentOutfit.items.length === 0) return;
        const items = currentOutfit.items.map(ci => ci.item);
        const arranged = layoutOutfitItems(items);
        currentOutfit.items = arranged;
        renderCanvas();
    }

    // Load recommended outfit passed from dashboard
    function loadRecoOutfitFromDashboard() {
        const raw = localStorage.getItem('tempRecoOutfit');
        if (!raw) return;
        localStorage.removeItem('tempRecoOutfit');
        try {
            const outfit = JSON.parse(raw);
            if (outfit && outfit.items && outfit.items.length > 0) {
                clearOutfit();
                currentOutfit.items = layoutOutfitItems(outfit.items);
                renderCanvas();
            }
        } catch (e) { console.error('Failed to load reco outfit:', e); }
    }

    renderMiniRecommendations();
    loadRecoOutfitFromDashboard();



document.addEventListener('click', () => {
  hideFloatingToolbar();
});

floatingToolbar.addEventListener('click', (e) => {
  e.stopPropagation();

  const action = e.target.dataset.action;
  if (!action || !selectedCanvasItem) return;

  const items = currentOutfit.items;

  if (action === 'front') {
    const above = items
      .filter(i => i.zIndex > selectedCanvasItem.zIndex)
      .sort((a, b) => a.zIndex - b.zIndex)[0];
    if (above) {
      const temp = selectedCanvasItem.zIndex;
      selectedCanvasItem.zIndex = above.zIndex;
      above.zIndex = temp;
    }
  }

  if (action === 'back') {
    const below = items
      .filter(i => i.zIndex < selectedCanvasItem.zIndex)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    if (below) {
      const temp = selectedCanvasItem.zIndex;
      selectedCanvasItem.zIndex = below.zIndex;
      below.zIndex = temp;
    }
  }

  if (action === 'rotateLeft') {
    selectedCanvasItem.rotation = ((selectedCanvasItem.rotation || 0) - 15) % 360;
  }

  if (action === 'rotateRight') {
    selectedCanvasItem.rotation = ((selectedCanvasItem.rotation || 0) + 15) % 360;
  }

  if (action === 'flipH') {
    selectedCanvasItem.flipX = !selectedCanvasItem.flipX;
  }

  if (action === 'flipV') {
    selectedCanvasItem.flipY = !selectedCanvasItem.flipY;
  }

  if (action === 'duplicate') {
    const maxZ = Math.max(0, ...items.map(i => i.zIndex || 0));
    const dup = {
      id: Date.now().toString() + '_dup_' + selectedCanvasItem.item.id,
      item: selectedCanvasItem.item,
      x: (selectedCanvasItem.x || 0) + 30,
      y: (selectedCanvasItem.y || 0) + 30,
      scale: selectedCanvasItem.scale || 1,
      rotation: selectedCanvasItem.rotation || 0,
      flipX: selectedCanvasItem.flipX || false,
      flipY: selectedCanvasItem.flipY || false,
      zIndex: maxZ + 1
    };
    items.push(dup);
    hideFloatingToolbar();
  }

  if (action === 'remove') {
    removeItemFromCanvas(selectedCanvasItem.id);
    hideFloatingToolbar();
    return;
  }

  renderCanvas();
});


function hideFloatingToolbar() {
  selectedCanvasItem = null;
  floatingToolbar.classList.add('hidden');
}

// ---- ZOOM CONTROLS ----
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevelEl = document.getElementById('zoomLevel');

function updateCanvasZoom() {
    if (!flatLayCanvas) return;
    flatLayCanvas.style.transform = `scale(${canvasZoom})`;
    flatLayCanvas.style.transformOrigin = 'center center';
    if (zoomLevelEl) zoomLevelEl.textContent = Math.round(canvasZoom * 100) + '%';
}

if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    canvasZoom = Math.min(3, canvasZoom + 0.1);
    updateCanvasZoom();
});
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    canvasZoom = Math.max(0.3, canvasZoom - 0.1);
    updateCanvasZoom();
});
if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => {
    canvasZoom = 1;
    updateCanvasZoom();
});

// Mouse wheel zoom on canvas
if (flatLayCanvas) {
    flatLayCanvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            canvasZoom = Math.max(0.3, Math.min(3, canvasZoom + delta));
            updateCanvasZoom();
        }
    }, { passive: false });
}

// ---- AUTO-ARRANGE ----
const autoArrangeBtn = document.getElementById('autoArrangeBtn');
if (autoArrangeBtn) {
    autoArrangeBtn.addEventListener('click', () => {
        autoArrangeOutfit();
    });
}

// ---- CANVAS BACKGROUND ----
const canvasBgSelect = document.getElementById('canvasBgSelect');
if (canvasBgSelect) {
    canvasBgSelect.addEventListener('change', () => {
        if (!flatLayCanvas) return;
        flatLayCanvas.classList.remove('canvas-bg-light', 'canvas-bg-white', 'canvas-bg-grid');
        const val = canvasBgSelect.value;
        if (val === 'light') flatLayCanvas.classList.add('canvas-bg-light');
        else if (val === 'white') flatLayCanvas.classList.add('canvas-bg-white');
        else if (val === 'grid') flatLayCanvas.classList.add('canvas-bg-grid');
    });
}

// ---- EXPORT OUTFIT AS IMAGE ----
const exportOutfitBtn = document.getElementById('exportOutfitBtn');
if (exportOutfitBtn) {
    exportOutfitBtn.addEventListener('click', () => {
        if (currentOutfit.items.length === 0) {
            alert('Add items to the canvas before exporting.');
            return;
        }
        exportOutfitAsImage();
    });
}

function exportOutfitAsImage() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const canvasRect = flatLayCanvas.getBoundingClientRect();
    const exportW = 800;
    const exportH = Math.round(exportW * (canvasRect.height / canvasRect.width));
    canvas.width = exportW;
    canvas.height = exportH;

    // Background
    ctx.fillStyle = '#FAF5F2';
    ctx.fillRect(0, 0, exportW, exportH);

    const scaleFactorX = exportW / canvasRect.width;
    const scaleFactorY = exportH / canvasRect.height;

    // Sort items by z-index
    const sorted = currentOutfit.items.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    let loadedCount = 0;
    const total = sorted.length;

    sorted.forEach((ci) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const s = ci.scale || 1;
            const r = (ci.rotation || 0) * Math.PI / 180;
            const sx = ci.flipX ? -1 : 1;
            const sy = ci.flipY ? -1 : 1;
            const drawW = img.width * s;
            const drawH = img.height * s;
            const cx = (ci.x + drawW / 2) * scaleFactorX;
            const cy = (ci.y + drawH / 2) * scaleFactorY;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(r);
            ctx.scale(sx, sy);
            ctx.drawImage(img, -drawW * scaleFactorX / 2, -drawH * scaleFactorY / 2, drawW * scaleFactorX, drawH * scaleFactorY);
            ctx.restore();

            loadedCount++;
            if (loadedCount === total) {
                // All images drawn, trigger download
                const link = document.createElement('a');
                link.download = 'outfit_' + new Date().toISOString().slice(0, 10) + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        };
        img.onerror = () => {
            loadedCount++;
            if (loadedCount === total) {
                const link = document.createElement('a');
                link.download = 'outfit_' + new Date().toISOString().slice(0, 10) + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        };
        img.src = ci.item.dataURL;
    });
}

// ---- TOUCH SUPPORT FOR CANVAS ITEMS ----
if (flatLayCanvas) {
    flatLayCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    flatLayCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    flatLayCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

let touchDragItem = null;
let touchStartPos = { x: 0, y: 0 };
let touchItemStartPos = { x: 0, y: 0 };

function handleTouchStart(e) {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const canvasItemEl = target?.closest('.canvas-item');
    if (!canvasItemEl) return;

    e.preventDefault();
    const itemId = canvasItemEl.getAttribute('data-item-id');
    touchDragItem = currentOutfit.items.find(ci => ci.id === itemId);
    if (!touchDragItem) return;

    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchItemStartPos = { x: touchDragItem.x, y: touchDragItem.y };
    canvasItemEl.classList.add('dragging');
}

function handleTouchMove(e) {
    if (!touchDragItem) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;
    touchDragItem.x = touchItemStartPos.x + dx;
    touchDragItem.y = touchItemStartPos.y + dy;

    const el = flatLayCanvas.querySelector(`[data-item-id="${touchDragItem.id}"]`);
    if (el) {
        el.style.left = touchDragItem.x + 'px';
        el.style.top = touchDragItem.y + 'px';
    }
}

function handleTouchEnd(e) {
    if (touchDragItem) {
        const el = flatLayCanvas.querySelector(`[data-item-id="${touchDragItem.id}"]`);
        if (el) el.classList.remove('dragging');
        touchDragItem = null;
    }
}

// ---- KEYBOARD SHORTCUTS FOR CANVAS ----
document.addEventListener('keydown', (e) => {
    if (!selectedCanvasItem) return;
    // Don't interfere with text inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const step = e.shiftKey ? 10 : 1;
    let handled = false;

    switch (e.key) {
        case 'ArrowLeft':
            selectedCanvasItem.x -= step;
            handled = true;
            break;
        case 'ArrowRight':
            selectedCanvasItem.x += step;
            handled = true;
            break;
        case 'ArrowUp':
            selectedCanvasItem.y -= step;
            handled = true;
            break;
        case 'ArrowDown':
            selectedCanvasItem.y += step;
            handled = true;
            break;
        case 'Delete':
        case 'Backspace':
            removeItemFromCanvas(selectedCanvasItem.id);
            hideFloatingToolbar();
            handled = true;
            break;
        case 'r':
        case 'R':
            selectedCanvasItem.rotation = ((selectedCanvasItem.rotation || 0) + (e.shiftKey ? -15 : 15)) % 360;
            handled = true;
            break;
    }

    if (handled) {
        e.preventDefault();
        renderCanvas();
    }
});

})();