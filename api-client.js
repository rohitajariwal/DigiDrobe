// api-client.js — Frontend API helper for DigiDrobe backend
// All pages include this to interact with the SQL backend.
// Falls back to localStorage when the server is unreachable.

(function (global) {
    'use strict';

    const API_BASE = window.location.origin + '/api';
    // FIX: Use explicit three-state: null=unknown, true=confirmed up, false=confirmed down
    let serverAvailable = null;
    // FIX: Add a dedicated /ping endpoint check (not /user/ping-test which may 404
    // and incorrectly set serverAvailable=true even when backend isn't serving /api routes)
    const PING_URL = API_BASE + '/ping';

    async function checkServer() {
        if (serverAvailable !== null) return serverAvailable;
        try {
            const resp = await fetch(PING_URL, { method: 'GET' });
            // FIX: Only treat as available if we get a real 200 OK from /api/ping
            // A 404 means server is up but the route doesn't exist — not good enough
            serverAvailable = resp.ok;  // true only on 2xx
        } catch (e) {
            serverAvailable = false;
        }
        return serverAvailable;
    }

    // FIX: Expose server status so local-db-plain.js can check it reliably
    function isServerConfirmedAvailable() {
        return serverAvailable === true;
    }

    // FIX: Allow resetting the cache so server status can be re-checked
    // (useful after network changes or app restarts)
    function resetServerCache() {
        serverAvailable = null;
    }

    // ---- Wardrobe API ----

    async function getWardrobe(email) {
        if (!(await checkServer())) return null;
        try {
            const resp = await fetch(`${API_BASE}/wardrobe/${encodeURIComponent(email)}`);
            if (resp.ok) return await resp.json();
        } catch (e) { /* fallback */ }
        return null;
    }

    async function addWardrobeItem(email, item) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/wardrobe/${encodeURIComponent(email)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item }),
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    async function updateWardrobeItem(email, itemId, updates) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/wardrobe/${encodeURIComponent(email)}/${encodeURIComponent(itemId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    async function removeWardrobeItem(email, itemId) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/wardrobe/${encodeURIComponent(email)}/${encodeURIComponent(itemId)}`, {
                method: 'DELETE',
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    // ---- User API ----

    async function getUser(email) {
        if (!(await checkServer())) return null;
        try {
            const resp = await fetch(`${API_BASE}/user/${encodeURIComponent(email)}`);
            if (resp.ok) return await resp.json();
        } catch (e) { /* fallback */ }
        return null;
    }

    async function updateMeasurements(email, measurements) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/user/${encodeURIComponent(email)}/measurements`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ measurements }),
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    async function updateProfilePhoto(email, photoData) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/user/${encodeURIComponent(email)}/profile-photo`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoData }),
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    // ---- Outfits API ----

    async function getOutfits(email) {
        if (!(await checkServer())) return null;
        try {
            const resp = await fetch(`${API_BASE}/outfits/${encodeURIComponent(email)}`);
            if (resp.ok) return await resp.json();
        } catch (e) { /* fallback */ }
        return null;
    }

    async function saveOutfit(email, name, note, items) {
        if (!(await checkServer())) return null;
        try {
            const resp = await fetch(`${API_BASE}/outfits/${encodeURIComponent(email)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, note, items }),
            });
            if (resp.ok) return await resp.json();
        } catch (e) { /* fallback */ }
        return null;
    }

    async function deleteOutfit(email, outfitId) {
        if (!(await checkServer())) return false;
        try {
            const resp = await fetch(`${API_BASE}/outfits/${encodeURIComponent(email)}/${outfitId}`, {
                method: 'DELETE',
            });
            return resp.ok;
        } catch (e) { return false; }
    }

    global.ApiClient = {
        checkServer,
        isServerConfirmedAvailable,
        resetServerCache,
        getWardrobe,
        addWardrobeItem,
        updateWardrobeItem,
        removeWardrobeItem,
        getUser,
        updateMeasurements,
        updateProfilePhoto,
        getOutfits,
        saveOutfit,
        deleteOutfit,
    };
})(window);
