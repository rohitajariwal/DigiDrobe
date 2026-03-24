const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'digidrobe.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initTables();
    }
    return db;
}

function initTables() {
    const d = getDb();

    d.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            measurements TEXT DEFAULT '',
            profile_photo TEXT DEFAULT '',
            email_verified INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS wardrobe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            item_id TEXT UNIQUE NOT NULL,
            name TEXT DEFAULT 'Uploaded',
            data_url TEXT NOT NULL,
            category TEXT DEFAULT 'Uncategorized',
            color TEXT DEFAULT 'Unknown',
            color_hex TEXT DEFAULT '',
            source_url TEXT DEFAULT '',
            bg_removed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS outfits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            name TEXT DEFAULT 'Untitled Outfit',
            note TEXT DEFAULT '',
            items_json TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe(user_email);
        CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
        CREATE INDEX IF NOT EXISTS idx_outfits_user ON outfits(user_email);
    `);
}

// ---- User operations ----

function createUser(name, email, hashedPassword, measurements) {
    const d = getDb();
    const stmt = d.prepare(
        'INSERT INTO users (name, email, password, measurements) VALUES (?, ?, ?, ?)'
    );
    try {
        stmt.run(name, email.toLowerCase().trim(), hashedPassword, measurements || '');
        return true;
    } catch (err) {
        if (err.message.includes('UNIQUE constraint')) return false;
        throw err;
    }
}

function getUserByEmail(email) {
    const d = getDb();
    return d.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) || null;
}

function updateUserPassword(email, hashedPassword) {
    const d = getDb();
    d.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, email.toLowerCase().trim());
}

function updateUserMeasurements(email, measurements) {
    const d = getDb();
    d.prepare('UPDATE users SET measurements = ? WHERE email = ?').run(measurements, email.toLowerCase().trim());
}

function updateUserProfilePhoto(email, photoData) {
    const d = getDb();
    d.prepare('UPDATE users SET profile_photo = ? WHERE email = ?').run(photoData, email.toLowerCase().trim());
}

function markEmailVerified(email) {
    const d = getDb();
    d.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run(email.toLowerCase().trim());
}

// ---- OTP operations ----

function createOtp(email, code, purpose, expiresMinutes) {
    const d = getDb();
    const expiresAt = new Date(Date.now() + expiresMinutes * 60000).toISOString();
    // Invalidate previous unused OTPs for the same email+purpose
    d.prepare('UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0').run(email.toLowerCase().trim(), purpose);
    d.prepare('INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)').run(email.toLowerCase().trim(), code, purpose, expiresAt);
}

function verifyOtp(email, code, purpose) {
    const d = getDb();
    const row = d.prepare(
        'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(email.toLowerCase().trim(), code, purpose);
    if (!row) return false;
    if (new Date(row.expires_at) < new Date()) return false;
    d.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
    return true;
}

// ---- Wardrobe operations ----

function getWardrobe(email) {
    const d = getDb();
    return d.prepare('SELECT * FROM wardrobe WHERE user_email = ? ORDER BY created_at DESC').all(email.toLowerCase().trim());
}

function addWardrobeItem(email, item) {
    const d = getDb();
    const stmt = d.prepare(`
        INSERT OR IGNORE INTO wardrobe (user_email, item_id, name, data_url, category, color, color_hex, source_url, bg_removed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        email.toLowerCase().trim(),
        item.id,
        item.name || 'Uploaded',
        item.dataURL,
        item.category || 'Uncategorized',
        item.color || 'Unknown',
        item.colorHex || '',
        item.sourceUrl || '',
        item.bgRemoved ? 1 : 0
    );
}

function updateWardrobeItem(email, itemId, updates) {
    const d = getDb();
    const fields = [];
    const values = [];
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
    if (updates.colorHex !== undefined) { fields.push('color_hex = ?'); values.push(updates.colorHex); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (!fields.length) return;
    values.push(email.toLowerCase().trim(), itemId);
    d.prepare(`UPDATE wardrobe SET ${fields.join(', ')} WHERE user_email = ? AND item_id = ?`).run(...values);
}

function removeWardrobeItem(email, itemId) {
    const d = getDb();
    d.prepare('DELETE FROM wardrobe WHERE user_email = ? AND item_id = ?').run(email.toLowerCase().trim(), itemId);
}

// ---- Outfit operations ----

function getOutfits(email) {
    const d = getDb();
    return d.prepare('SELECT * FROM outfits WHERE user_email = ? ORDER BY created_at DESC').all(email.toLowerCase().trim());
}

function saveOutfit(email, name, note, itemsJson) {
    const d = getDb();
    const info = d.prepare('INSERT INTO outfits (user_email, name, note, items_json) VALUES (?, ?, ?, ?)').run(email.toLowerCase().trim(), name, note || '', itemsJson);
    return info.lastInsertRowid;
}

function deleteOutfit(email, outfitId) {
    const d = getDb();
    d.prepare('DELETE FROM outfits WHERE user_email = ? AND id = ?').run(email.toLowerCase().trim(), outfitId);
}

module.exports = {
    getDb,
    initTables,
    createUser,
    getUserByEmail,
    updateUserPassword,
    updateUserMeasurements,
    updateUserProfilePhoto,
    markEmailVerified,
    createOtp,
    verifyOtp,
    getWardrobe,
    addWardrobeItem,
    updateWardrobeItem,
    removeWardrobeItem,
    getOutfits,
    saveOutfit,
    deleteOutfit,
};
