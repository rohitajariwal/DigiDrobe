// api-client.js — Frontend API helper for DigiDrobe backend
// All pages include this to interact with the SQL backend.
// Falls back to localStorage when the server is unreachable.

(function (global) {
    'use strict';

    const API_BASE = window.location.origin + '/api';
    let serverAvailable = null; // null = unknown, true/false

    async function checkServer() {
        if (serverAvailable !== null) return serverAvailable;
        try {
            const resp = await fetch(API_BASE + '/user/ping-test', { method: 'GET' });
            // Even a 404 means server is up
            serverAvailable = true;
        } catch (e) {
            serverAvailable = false;
        }
        return serverAvailable;
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
