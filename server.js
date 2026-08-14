const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const TELEGRAM_BOT_TOKEN = "8735436494:AAGWN69EV9j2b89kielRj5PSOPsh0JY4uxY";
const TELEGRAM_CHAT_ID = "8024913770";

// API 1: Fetch Products from JSON
app.get('/api/products', (req, res) => {
    fs.readFile(path.join(__dirname, 'products.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error loading products' });
        }
        res.json(JSON.parse(data));
    });
});

// API 2: Place Order Endpoint
app.post('/api/order', async (req, res) => {
    const { name, phone, address, payMode, cart, total } = req.body;

    if (!name || !phone || !address || !cart) {
        return res.status(400).json({ success: false, message: 'All details required' });
    }

    const itemsList = cart.map((i, idx) => `${idx + 1}. *${i.name}* x ${i.qty} = ₹${i.price * i.qty}`).join('\n');
    const msg = `🛍️ *NEW ORDER - DHAWAN MART*\n---\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n📍 *Address:* ${address}\n💳 *Payment:* ${payMode}\n\n🛒 *ITEMS:*\n${itemsList}\n\n💰 *TOTAL:* ₹${total}\n🚚 *Delivery:* 2 Days`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' })
        });
        const data = await response.json();
        if (data.ok) res.json({ success: true, message: 'Order Placed Successfully' });
        else res.status(500).json({ success: false, message: 'Telegram Notification Failed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Network Error' });
    }
});

// API 3: App Partner Endpoint
app.post('/api/partner', async (req, res) => {
    const { name, phone, age, gender } = req.body;

    if (!name || !phone || !age) {
        return res.status(400).json({ success: false, message: 'All details required' });
    }

    const msg = `🤝 *NEW APP PARTNER REQUEST*\n---\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n🎂 *Age:* ${age}\n🚻 *Gender:* ${gender}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' })
        });
        const data = await response.json();
        if (data.ok) res.json({ success: true, message: 'Application Sent' });
        else res.status(500).json({ success: false, message: 'Failed to send' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
