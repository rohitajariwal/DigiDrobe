const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// ---- Email transporter ----
// Configure with your SMTP credentials via environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// For Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS=app-password
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.');
        console.warn('OTP emails will be logged to console instead of sent.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
    return transporter;
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email, otp, purpose) {
    const subject = purpose === 'signup'
        ? 'DigiDrobe — Verify your email'
        : 'DigiDrobe — Password reset code';
    const body = purpose === 'signup'
        ? `Your DigiDrobe verification code is: <b>${otp}</b><br><br>This code expires in 10 minutes.`
        : `Your DigiDrobe password reset code is: <b>${otp}</b><br><br>This code expires in 10 minutes.`;

    const transport = getTransporter();
    if (transport) {
        await transport.sendMail({
            from: `"DigiDrobe" <${process.env.SMTP_USER}>`,
            to: email,
            subject,
            html: body,
        });
        console.log(`OTP email sent to ${email}`);
    } else {
        // Fallback: log to console for development
        console.log(`\n========== OTP for ${email} (${purpose}) ==========`);
        console.log(`Code: ${otp}`);
        console.log(`=================================================\n`);
    }
}

// ---- Auth Routes ----

// POST /api/auth/signup — Step 1: Send OTP to email
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, measurements } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = db.getUserByEmail(normalizedEmail);
        if (existing && existing.email_verified) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);

        // Create or update user (unverified)
        if (!existing) {
            const ok = db.createUser(name, normalizedEmail, hashedPassword, measurements || '');
            if (!ok) return res.status(409).json({ error: 'An account with this email already exists.' });
        } else {
            // Update existing unverified user
            db.updateUserPassword(normalizedEmail, hashedPassword);
        }

        // Generate and send OTP
        const otp = generateOtp();
        db.createOtp(normalizedEmail, otp, 'signup', 10);
        await sendOtpEmail(normalizedEmail, otp, 'signup');

        res.json({ message: 'Verification code sent to your email.', email: normalizedEmail });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// POST /api/auth/verify-signup — Step 2: Verify OTP and activate account
app.post('/api/auth/verify-signup', (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and verification code are required.' });

        const normalizedEmail = email.toLowerCase().trim();
        const valid = db.verifyOtp(normalizedEmail, code, 'signup');
        if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code.' });

        db.markEmailVerified(normalizedEmail);
        const user = db.getUserByEmail(normalizedEmail);

        res.json({
            message: 'Account verified successfully!',
            user: { name: user.name, email: user.email, measurements: user.measurements, createdAt: user.created_at }
        });
    } catch (err) {
        console.error('Verify signup error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        const normalizedEmail = email.toLowerCase().trim();
        const user = db.getUserByEmail(normalizedEmail);
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
        if (!user.email_verified) return res.status(401).json({ error: 'Please verify your email first.' });

        const match = bcrypt.compareSync(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

        res.json({
            message: 'Login successful.',
            user: { name: user.name, email: user.email, measurements: user.measurements, profilePhoto: user.profile_photo, createdAt: user.created_at }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/forgot-password — Send OTP for password reset
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const normalizedEmail = email.toLowerCase().trim();
        const user = db.getUserByEmail(normalizedEmail);
        if (!user) {
            // Don't reveal whether account exists
            return res.json({ message: 'If an account exists, a reset code has been sent.' });
        }

        const otp = generateOtp();
        db.createOtp(normalizedEmail, otp, 'reset', 10);
        await sendOtpEmail(normalizedEmail, otp, 'reset');

        res.json({ message: 'If an account exists, a reset code has been sent.', email: normalizedEmail });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/reset-password — Verify OTP and set new password
app.post('/api/auth/reset-password', (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code, and new password are required.' });

        const normalizedEmail = email.toLowerCase().trim();
        const valid = db.verifyOtp(normalizedEmail, code, 'reset');
        if (!valid) return res.status(400).json({ error: 'Invalid or expired reset code.' });

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        db.updateUserPassword(normalizedEmail, hashedPassword);

        res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---- User Routes ----

app.get('/api/user/:email', (req, res) => {
    const user = db.getUserByEmail(req.params.email);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ name: user.name, email: user.email, measurements: user.measurements, profilePhoto: user.profile_photo, createdAt: user.created_at });
});

app.put('/api/user/:email/measurements', (req, res) => {
    const { measurements } = req.body;
    db.updateUserMeasurements(req.params.email, measurements || '');
    res.json({ message: 'Measurements updated.' });
});

app.put('/api/user/:email/profile-photo', (req, res) => {
    const { photoData } = req.body;
    db.updateUserProfilePhoto(req.params.email, photoData || '');
    res.json({ message: 'Profile photo updated.' });
});

// ---- Wardrobe Routes ----

app.get('/api/wardrobe/:email', (req, res) => {
    const items = db.getWardrobe(req.params.email);
    // Map DB columns to frontend format
    const mapped = items.map(row => ({
        id: row.item_id,
        name: row.name,
        dataURL: row.data_url,
        category: row.category,
        color: row.color,
        colorHex: row.color_hex,
        sourceUrl: row.source_url,
        bgRemoved: !!row.bg_removed,
    }));
    res.json(mapped);
});

app.post('/api/wardrobe/:email', (req, res) => {
    const { item } = req.body;
    if (!item || !item.id || !item.dataURL) return res.status(400).json({ error: 'Invalid item.' });
    db.addWardrobeItem(req.params.email, item);
    res.json({ message: 'Item added.' });
});

app.put('/api/wardrobe/:email/:itemId', (req, res) => {
    const { updates } = req.body;
    db.updateWardrobeItem(req.params.email, req.params.itemId, updates || {});
    res.json({ message: 'Item updated.' });
});

app.delete('/api/wardrobe/:email/:itemId', (req, res) => {
    db.removeWardrobeItem(req.params.email, req.params.itemId);
    res.json({ message: 'Item removed.' });
});

// ---- Outfit Routes ----

app.get('/api/outfits/:email', (req, res) => {
    const outfits = db.getOutfits(req.params.email);
    res.json(outfits.map(o => ({ id: o.id, name: o.name, note: o.note, items: JSON.parse(o.items_json || '[]'), createdAt: o.created_at })));
});

app.post('/api/outfits/:email', (req, res) => {
    const { name, note, items } = req.body;
    const id = db.saveOutfit(req.params.email, name || 'Untitled', note || '', JSON.stringify(items || []));
    res.json({ id, message: 'Outfit saved.' });
});

app.delete('/api/outfits/:email/:outfitId', (req, res) => {
    db.deleteOutfit(req.params.email, req.params.outfitId);
    res.json({ message: 'Outfit deleted.' });
});

// ---- Start Server ----

(async () => {
    await db.getDb(); // Initialize SQLite database
    app.listen(PORT, () => {
        console.log(`DigiDrobe server running on http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/login.html to get started`);
        if (!process.env.SMTP_HOST) {
            console.log('\nNote: SMTP not configured. OTP codes will be printed to console.');
            console.log('To enable email, set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
        }
    });
})();
