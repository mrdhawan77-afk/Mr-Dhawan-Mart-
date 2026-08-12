const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve index.html

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Telegram Bot Notification Function
async function sendTelegramNotification(orderDetails) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("Telegram Bot Token or Chat ID missing in environment variables.");
    return;
  }

  // Format Items List
  const itemsList = orderDetails.items
    .map(item => `• ${item.name} (${item.quantity}x) - ₹${item.price * item.quantity}`)
    .join('\n');

  // Format Telegram Message
  const message = `🛒 *NEW ORDER RECEIVED! - Dhawan Mart*\n\n` +
    `🆔 *Order ID:* \`${orderDetails.orderId}\` \n` +
    `👤 *Customer:* ${orderDetails.customer.name}\n` +
    `📞 *Phone:* ${orderDetails.customer.phone}\n` +
    `📍 *Address:* ${orderDetails.customer.address}\n` +
    `💳 *Payment Method:* ${orderDetails.customer.paymentMethod || 'Cash on Delivery'}\n\n` +
    `📦 *Items Ordered:*\n${itemsList}\n\n` +
    `💰 *Total Amount:* ₹${orderDetails.totalAmount}\n` +
    `⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    console.log("Telegram notification sent successfully!");
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
  }
}

// Order Route
app.post('/api/orders', async (req, res) => {
  try {
    const { items, customer, totalAmount } = req.body;
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    const newOrder = { orderId, items, customer, totalAmount };

    // Send instant Telegram Alert
    await sendTelegramNotification(newOrder);

    res.json({ success: true, orderId, message: "Order placed successfully!" });
  } catch (error) {
    console.error("Order processing error:", error);
    res.status(500).json({ success: false, message: "Failed to place order" });
  }
});

// AI Assistant Chat Route
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `User asks: "${query}". Provide a concise, helpful response about groceries, cooking tips, or product availability at Dhawan Mart. Keep it under 3 sentences.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (error) {
    console.error("AI Assistant Error:", error);
    res.status(500).json({ reply: "Sorry, I'm having trouble connecting to the mart assistant." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
