const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'digidrobe.db');

let db = null;
let dbReady = null; // promise that resolves when DB is initialized

function saveToDisk() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 30 seconds
let saveInterval = null;

async function getDb() {
    if (db) return db;
    if (dbReady) return dbReady;

    dbReady = (async () => {
        const SQL = await initSqlJs();

        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
        } else {
            db = new SQL.Database();
        }

        db.run('PRAGMA foreign_keys = ON');
        initTables();
        saveToDisk();

        // Auto-save periodically
        if (!saveInterval) {
            saveInterval = setInterval(saveToDisk, 30000);
        }

        return db;
    })();

    return dbReady;
}

function initTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            measurements TEXT DEFAULT '',
            profile_photo TEXT DEFAULT '',
            email_verified INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
    db.run(`
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
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS outfits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            name TEXT DEFAULT 'Untitled Outfit',
            note TEXT DEFAULT '',
            items_json TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
        )
    `);

    // Create indexes (ignore if already exist)
    try { db.run('CREATE INDEX IF NOT EXISTS idx_wardrobe_user ON wardrobe(user_email)'); } catch (e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email)'); } catch (e) {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_outfits_user ON outfits(user_email)'); } catch (e) {}
}

// Helper to run a query and return all rows as objects
function queryAll(sql, params) {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Helper to get a single row
function queryOne(sql, params) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// Helper to run an insert/update/delete
function runSql(sql, params) {
    db.run(sql, params);
    saveToDisk();
}

// ---- User operations ----

function createUser(name, email, hashedPassword, measurements) {
    try {
        runSql(
            'INSERT INTO users (name, email, password, measurements) VALUES (?, ?, ?, ?)',
            [name, email.toLowerCase().trim(), hashedPassword, measurements || '']
        );
        return true;
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) return false;
        throw err;
    }
}

function getUserByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
}

function updateUserPassword(email, hashedPassword) {
    runSql('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email.toLowerCase().trim()]);
}

function updateUserMeasurements(email, measurements) {
    runSql('UPDATE users SET measurements = ? WHERE email = ?', [measurements, email.toLowerCase().trim()]);
}

function updateUserProfilePhoto(email, photoData) {
    runSql('UPDATE users SET profile_photo = ? WHERE email = ?', [photoData, email.toLowerCase().trim()]);
}

function markEmailVerified(email) {
    runSql('UPDATE users SET email_verified = 1 WHERE email = ?', [email.toLowerCase().trim()]);
}

// ---- OTP operations ----

function createOtp(email, code, purpose, expiresMinutes) {
    const expiresAt = new Date(Date.now() + expiresMinutes * 60000).toISOString();
    runSql('UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [email.toLowerCase().trim(), purpose]);
    runSql('INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)', [email.toLowerCase().trim(), code, purpose, expiresAt]);
}

function verifyOtp(email, code, purpose) {
    const row = queryOne(
        'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1',
        [email.toLowerCase().trim(), code, purpose]
    );
    if (!row) return false;
    if (new Date(row.expires_at) < new Date()) return false;
    runSql('UPDATE otp_codes SET used = 1 WHERE id = ?', [row.id]);
    return true;
}

// ---- Wardrobe operations ----

function getWardrobe(email) {
    return queryAll('SELECT * FROM wardrobe WHERE user_email = ? ORDER BY created_at DESC', [email.toLowerCase().trim()]);
}

function addWardrobeItem(email, item) {
    try {
        runSql(
            'INSERT OR IGNORE INTO wardrobe (user_email, item_id, name, data_url, category, color, color_hex, source_url, bg_removed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                email.toLowerCase().trim(),
                item.id,
                item.name || 'Uploaded',
                item.dataURL,
                item.category || 'Uncategorized',
                item.color || 'Unknown',
                item.colorHex || '',
                item.sourceUrl || '',
                item.bgRemoved ? 1 : 0,
            ]
        );
    } catch (e) {
        console.error('addWardrobeItem error:', e.message);
    }
}

function updateWardrobeItem(email, itemId, updates) {
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

function removeWardrobeItem(email, itemId) {
    runSql('DELETE FROM wardrobe WHERE user_email = ? AND item_id = ?', [email.toLowerCase().trim(), itemId]);
}

// ---- Outfit operations ----

function getOutfits(email) {
    return queryAll('SELECT * FROM outfits WHERE user_email = ? ORDER BY created_at DESC', [email.toLowerCase().trim()]);
}

function saveOutfit(email, name, note, itemsJson) {
    db.run('INSERT INTO outfits (user_email, name, note, items_json) VALUES (?, ?, ?, ?)', [email.toLowerCase().trim(), name, note || '', itemsJson]);
    const row = queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : null;
    saveToDisk();
    return id;
}

function deleteOutfit(email, outfitId) {
    runSql('DELETE FROM outfits WHERE user_email = ? AND id = ?', [email.toLowerCase().trim(), outfitId]);
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
