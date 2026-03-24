// server.js — DigiDrobe Express + sql.js SQLite backend
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs'); // uses bcryptjs (no native build required)
const nodemailer = require('nodemailer');
const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ---- Health / Ping ----
app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ---- Auth ----

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Missing fields' });
        const existing = await Database.getUserByEmail(email);
        if (existing)
            return res.status(409).json({ error: 'User already exists' });
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const ok = await Database.createUser({ name, email, password: hash });
        if (!ok) return res.status(409).json({ error: 'User already exists' });
        res.json({ success: true });
    } catch (e) {
        console.error('signup error', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Missing fields' });
        const user = await Database.getUserByEmail(email);
        if (!user)
            return res.status(401).json({ error: 'Invalid credentials' });
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ error: 'Invalid credentials' });
        // Set currentUser in localStorage via response so frontend can pick it up
        res.json({ success: true, email: user.email, name: user.name });
    } catch (e) {
        console.error('login error', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// OTP — send
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await Database.upsertOtp(email, code, expiresAt, purpose || 'verify');
        // Try email; fall back to console log
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
            await transporter.sendMail({
                from: process.env.SMTP_USER || 'noreply@digidrobe.com',
                to: email,
                subject: 'DigiDrobe Verification Code',
                text: `Your verification code is: ${code}\n\nExpires in 10 minutes.`,
            });
            console.log(`[OTP sent to ${email}]`);
        } catch (mailErr) {
            console.log(`[OTP for ${email}]: ${code}  (email send failed: ${mailErr.message})`);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('send-otp error', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// OTP — verify
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, code, purpose } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Missing fields' });
        const record = await Database.getOtp(email, purpose || 'verify');
        if (!record) return res.status(400).json({ error: 'No OTP found' });
        if (record.code !== code) return res.status(400).json({ error: 'Invalid OTP' });
        if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired' });
        await Database.markEmailVerified(email);
        await Database.deleteOtp(email, purpose || 'verify');
        res.json({ success: true });
    } catch (e) {
        console.error('verify-otp error', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword)
            return res.status(400).json({ error: 'Missing fields' });
        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await Database.updatePassword(email, hash);
        res.json({ success: true });
    } catch (e) {
        console.error('reset-password error', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---- User ----

app.get('/api/user/:email', async (req, res) => {
    try {
        const user = await Database.getUserByEmail(req.params.email);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { password, ...safe } = user;
        res.json(safe);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/user/:email/measurements', async (req, res) => {
    try {
        const { measurements } = req.body;
        await Database.updateMeasurements(req.params.email, measurements);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/user/:email/profile-photo', async (req, res) => {
    try {
        const { photoData } = req.body;
        await Database.updateProfilePhoto(req.params.email, photoData);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ---- Wardrobe ----

app.get('/api/wardrobe/:email', async (req, res) => {
    try {
        const items = await Database.getWardrobe(req.params.email);
        res.json(items || []);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/wardrobe/:email', async (req, res) => {
    try {
        const { item } = req.body;
        if (!item) return res.status(400).json({ error: 'Missing item' });
        await Database.addWardrobeItem(req.params.email, item);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/wardrobe/:email/:itemId', async (req, res) => {
    try {
        const { updates } = req.body;
        await Database.updateWardrobeItem(req.params.email, req.params.itemId, updates || {});
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/wardrobe/:email/:itemId', async (req, res) => {
    try {
        await Database.removeWardrobeItem(req.params.email, req.params.itemId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ---- Outfits ----

app.get('/api/outfits/:email', async (req, res) => {
    try {
        const outfits = await Database.getOutfits(req.params.email);
        res.json(outfits || []);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/outfits/:email', async (req, res) => {
    try {
        const { name, note, items } = req.body;
        const result = await Database.saveOutfit(req.params.email, name, note, items);
        res.json(result || { success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/outfits/:email/:outfitId', async (req, res) => {
    try {
        await Database.deleteOutfit(req.params.email, req.params.outfitId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ---- Start ----
Database.getDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n✅ DigiDrobe server running at http://localhost:${PORT}`);
            console.log(`   Open: http://localhost:${PORT}/login.html\n`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    });
