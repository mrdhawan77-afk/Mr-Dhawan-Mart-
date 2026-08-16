require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rate Limiter setup
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: "बहुत ज़्यादा प्रयास! कृपया 15 मिनट बाद कोशिश करें।" }
});

const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

// JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "लॉगिन आवश्यक है।" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "अमान्य सेशन Token।" });
        req.user = user;
        next();
    });
}

// Telegram Message Sender
async function sendTelegramNotification(orderData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    let itemsList = orderData.items.map(item => `• ${item.name} (₹${item.price})`).join('\n');
    
    const message = `🛍️ *नया ऑर्डर प्राप्त हुआ!* 🛍️\n\n` +
                    `🆔 *Order ID:* ${orderData.orderId}\n` +
                    `📱 *Customer:* ${orderData.userMobile}\n` +
                    `💰 *Total:* ₹${orderData.totalAmount}\n` +
                    `💳 *Mode:* ${orderData.paymentMode}\n` +
                    `📅 *Date:* ${orderData.date}\n\n` +
                    `📦 *Items:*\n${itemsList}`;

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
    } catch (err) {
        console.error("Telegram Notification Fail:", err);
    }
}

// OTP Route
app.post('/api/send-otp', otpLimiter, async (req, res) => {
    const { mobile } = req.body;
    if (!mobile || mobile.length !== 10) {
        return res.status(400).json({ success: false, message: "सही मोबाइल नंबर दर्ज करें" });
    }

    const generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({ mobile: mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: "OTP वेरीफाई हो गया!", token: token, otp: generatedOTP });
});

// Products Route
app.get('/api/products', (req, res) => {
    fs.readFile(path.join(__dirname, 'products.json'), 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false, message: "डेटा लोड नहीं हो पाया" });
        let products = JSON.parse(data);
        const { category, search } = req.query;

        if (category && category !== 'All') {
            products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        if (search) {
            products = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        }

        res.json({ success: true, products });
    });
});

// Place Order Route
app.post('/api/place-order', authenticateToken, (req, res) => {
    const { items, totalAmount, paymentMode } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "कार्ट खाली है!" });
    }

    const newOrder = {
        orderId: "COMBO" + Math.floor(100000 + Math.random() * 900000),
        userMobile: req.user.mobile,
        items: items,
        totalAmount: totalAmount,
        paymentMode: paymentMode || "COD",
        date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    };

    // Save to orders.json
    const ordersFilePath = path.join(__dirname, 'orders.json');
    let existingOrders = [];
    if (fs.existsSync(ordersFilePath)) {
        const rawData = fs.readFileSync(ordersFilePath, 'utf8');
        existingOrders = rawData ? JSON.parse(rawData) : [];
    }

    existingOrders.push(newOrder);
    fs.writeFileSync(ordersFilePath, JSON.stringify(existingOrders, null, 2));

    // Send Telegram Notification
    sendTelegramNotification(newOrder);

    res.json({ success: true, message: "ऑर्डर सफलतापूर्वक सबमिट हो गया!", orderId: newOrder.orderId });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

