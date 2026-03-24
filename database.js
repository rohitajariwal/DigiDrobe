// database.js — sql.js SQLite wrapper for DigiDrobe
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'digidrobe.db');

let db = null;
let dbReadyPromise = null;

function saveToDisk() {
    if (!db) return;
    try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
        console.error('saveToDisk error:', e.message);
    }
}

async function getDb() {
    if (db) return db;
    if (dbReadyPromise) return dbReadyPromise;

    dbReadyPromise = (async () => {
        const SQL = await initSqlJs();
        if (fs.existsSync(DB_PATH)) {
            db = new SQL.Database(fs.readFileSync(DB_PATH));
        } else {
            db = new SQL.Database();
        }
        db.run('PRAGMA foreign_keys = ON');
        initTables();
        saveToDisk();
        setInterval(saveToDisk, 30000);
        return db;
    })();

    return dbReadyPromise;
}

function initTables() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        measurements TEXT DEFAULT '',
        profile_photo TEXT DEFAULT '',
        email_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wardrobe (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        item_id TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT 'Uploaded',
        data_url TEXT NOT NULL,
        category TEXT DEFAULT 'Uncategorized',
        color TEXT DEFAULT 'Unknown',
        color_hex TEXT DEFAULT '',
        source_url TEXT DEFAULT '',
        product_image_url TEXT DEFAULT '',
        sizes TEXT DEFAULT '',
        bg_removed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT 'verify',
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        name TEXT DEFAULT 'Untitled Outfit',
        note TEXT DEFAULT '',
        items_json TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    try { db.run('CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe(user_email)'); } catch (e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email)'); } catch (e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_outfits_user ON outfits(user_email)'); } catch (e) {}
}

function queryAll(sql, params) {
    const stmt = db.prepare(sql);
    if (params && params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
}

function queryOne(sql, params) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params) {
    db.run(sql, params || []);
    saveToDisk();
}

// ---- User ----

async function createUser({ name, email, password, measurements }) {
    await getDb();
    try {
        runSql(
            'INSERT INTO users (name, email, password, measurements) VALUES (?, ?, ?, ?)',
            [name, email.toLowerCase().trim(), password, measurements || '']
        );
        return true;
    } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) return false;
        throw e;
    }
}

async function getUserByEmail(email) {
    await getDb();
    return queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
}

async function updatePassword(email, hashedPassword) {
    await getDb();
    runSql('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email.toLowerCase().trim()]);
}

async function updateMeasurements(email, measurements) {
    await getDb();
    runSql('UPDATE users SET measurements = ? WHERE email = ?', [measurements || '', email.toLowerCase().trim()]);
}

async function updateProfilePhoto(email, photoData) {
    await getDb();
    runSql('UPDATE users SET profile_photo = ? WHERE email = ?', [photoData || '', email.toLowerCase().trim()]);
}

async function markEmailVerified(email) {
    await getDb();
    runSql('UPDATE users SET email_verified = 1 WHERE email = ?', [email.toLowerCase().trim()]);
}

// ---- OTP ----

async function upsertOtp(email, code, expiresAt, purpose) {
    await getDb();
    // Invalidate any old OTPs for this email+purpose
    runSql(
        'UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0',
        [email.toLowerCase().trim(), purpose || 'verify']
    );
    runSql(
        'INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
        [email.toLowerCase().trim(), code, purpose || 'verify', expiresAt]
    );
}

async function getOtp(email, purpose) {
    await getDb();
    return queryOne(
        'SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1',
        [email.toLowerCase().trim(), purpose || 'verify']
    );
}

async function deleteOtp(email, purpose) {
    await getDb();
    runSql(
        'UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ?',
        [email.toLowerCase().trim(), purpose || 'verify']
    );
}

// ---- Wardrobe ----

async function getWardrobe(email) {
    await getDb();
    const rows = queryAll(
        'SELECT * FROM wardrobe WHERE user_email = ? ORDER BY created_at DESC',
        [email.toLowerCase().trim()]
    );
    // Map DB column names back to camelCase for frontend
    return rows.map((r) => ({
        id: r.item_id,
        name: r.name,
        dataURL: r.data_url,
        category: r.category,
        color: r.color,
        colorHex: r.color_hex,
        sourceUrl: r.source_url,
        productImageUrl: r.product_image_url,
        sizes: r.sizes,
        bgRemoved: !!r.bg_removed,
    }));
}

async function addWardrobeItem(email, item) {
    await getDb();
    try {
        runSql(
            `INSERT OR IGNORE INTO wardrobe
             (user_email, item_id, name, data_url, category, color, color_hex, source_url, product_image_url, sizes, bg_removed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                email.toLowerCase().trim(),
                item.id,
                item.name || 'Uploaded',
                item.dataURL || '',
                item.category || 'Uncategorized',
                item.color || 'Unknown',
                item.colorHex || '',
                item.sourceUrl || '',
                item.productImageUrl || '',
                Array.isArray(item.sizes) ? item.sizes.join(',') : (item.sizes || ''),
                item.bgRemoved ? 1 : 0,
            ]
        );
    } catch (e) {
        console.error('addWardrobeItem error:', e.message);
    }
}

async function updateWardrobeItem(email, itemId, updates) {
    await getDb();
    const fields = [];
    const values = [];
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
    if (updates.colorHex !== undefined) { fields.push('color_hex = ?'); values.push(updates.colorHex); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (!fields.length) return;
    values.push(email.toLowerCase().trim(), itemId);
    runSql(`UPDATE wardrobe SET ${fields.join(', ')} WHERE user_email = ? AND item_id = ?`, values);
}

async function removeWardrobeItem(email, itemId) {
    await getDb();
    runSql('DELETE FROM wardrobe WHERE user_email = ? AND item_id = ?', [email.toLowerCase().trim(), itemId]);
}

// ---- Outfits ----

async function getOutfits(email) {
    await getDb();
    const rows = queryAll(
        'SELECT * FROM outfits WHERE user_email = ? ORDER BY created_at DESC',
        [email.toLowerCase().trim()]
    );
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        note: r.note,
        items: (() => { try { return JSON.parse(r.items_json); } catch (e) { return []; } })(),
        createdAt: r.created_at,
    }));
}

async function saveOutfit(email, name, note, items) {
    await getDb();
    const itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
    runSql(
        'INSERT INTO outfits (user_email, name, note, items_json) VALUES (?, ?, ?, ?)',
        [email.toLowerCase().trim(), name || 'Untitled Outfit', note || '', itemsJson]
    );
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? { id: row.id } : null;
}

async function deleteOutfit(email, outfitId) {
    await getDb();
    runSql('DELETE FROM outfits WHERE user_email = ? AND id = ?', [email.toLowerCase().trim(), parseInt(outfitId)]);
}

module.exports = {
    getDb,
    createUser,
    getUserByEmail,
    updatePassword,
    updateMeasurements,
    updateProfilePhoto,
    markEmailVerified,
    upsertOtp,
    getOtp,
    deleteOtp,
    getWardrobe,
    addWardrobeItem,
    updateWardrobeItem,
    removeWardrobeItem,
    getOutfits,
    saveOutfit,
    deleteOutfit,
};
