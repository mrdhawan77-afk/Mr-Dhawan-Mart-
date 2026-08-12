/**
 * Dhawan Mart - Backend Server
 * Production-ready Express Server
 * 
 * To run locally:
 * 1. Install dependencies: npm install express @google/genai dotenv
 * 2. Set environment variable: GEMINI_API_KEY="your_api_key_here"
 * 3. Start server: node server.js
 */

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

// Load .env configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parse middleware
app.use(express.json());

// Initialize the official Google Gen AI SDK
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("[Dhawan Mart Server] GoogleGenAI SDK initialized successfully.");
} else {
  console.warn("[Dhawan Mart Server] WARNING: GEMINI_API_KEY is not defined in environment variables. Chat API will be unavailable.");
}

// In-memory array to persist orders
const orders = [];

// Serve the standalone static frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "standalone-index.html"));
});

/**
 * POST /api/orders
 * Receives grocery checkout payloads, validates inputs, generates unique Order IDs,
 * and saves the order details in memory.
 */
app.post("/api/orders", (req, res) => {
  const { customerName, mobileNumber, address, paymentMethod, items, totalAmount } = req.body;

  // 1. Mandatory Fields Validation
  if (!customerName || !mobileNumber || !address || !paymentMethod) {
    return res.status(400).json({
      success: false,
      error: "Validation Error: Full Name, Mobile Number, Delivery Address, and Payment Method are all required.",
    });
  }

  // 2. Validate Cart Items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Validation Error: Cannot place an order with an empty shopping cart.",
    });
  }

  // 3. Generate Unique Order ID (Format: ORD-XXXXXX)
  const randomSixDigitNumber = Math.floor(100000 + Math.random() * 900000);
  const orderId = `ORD-${randomSixDigitNumber}`;

  // 4. Create and persist Order
  const orderReceipt = {
    orderId,
    customerName,
    mobileNumber,
    address,
    paymentMethod,
    items,
    totalAmount: Number(totalAmount),
    status: "Preparing for Delivery",
    createdAt: new Date(),
  };

  orders.push(orderReceipt);

  console.log(`[Order Success] Placed: ${orderId} for ${customerName} | Invoice: $${totalAmount}`);

  // 5. Send Success response
  res.status(201).json({
    success: true,
    orderId,
    message: "Your Dhawan Mart grocery order has been successfully placed!",
    order: orderReceipt,
  });
});

/**
 * POST /api/chat
 * Integrates Gemini 3.6 Flash model to provide real-time grocery customer support
 */
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message field is required." });
  }

  if (!ai) {
    return res.status(503).json({
      error: "AI chatbot helper is currently offline. Please configure your GEMINI_API_KEY.",
    });
  }

  try {
    // Inject custom Dhawan Mart personality and stock catalog context
    const systemInstruction = 
      "You are Dhawan AI, the friendly, helpful shopping assistant for 'Dhawan Mart' online grocery store. " +
      "Dhawan Mart sells high-quality vegetables (Tomatoes, Spinach, Carrots), " +
      "fruits (Apples, Bananas, Strawberries), " +
      "bakery fresh items (Sourdough bread, Croissants), " +
      "dairy (Whole Milk, Aged Cheddar Cheese, Farm Eggs), " +
      "and pantry essentials (Olive Oil, Basmati Rice, Forest Honey). " +
      "Your goal is to answer shopping queries politely, suggest recipes with items in our stock, " +
      "explain our city-wide delivery guidelines (Free delivery on orders of $30 or more, else $4.99; delivered in 2 hours), " +
      "and keep answers highly concise, structured, and friendly.";

    const contents = [];

    // Append conversation history if provided to maintain context
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      });
    }

    // Append current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Request Gemini completion
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "I apologize, I didn't get that. Please try again.";
    res.json({ reply });
  } catch (error) {
    console.error("[Chat Error] Failed to generate Gemini content:", error);
    res.status(500).json({
      error: "An error occurred while generating AI response.",
      details: error.message,
    });
  }
});

// Start listening
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`Dhawan Mart Production Server running successfully!`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
