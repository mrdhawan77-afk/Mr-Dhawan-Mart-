const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: "Too many requests, please try again later." }
});
app.use('/api/', limiter);

// Sample Products Data
const sampleProducts = [
    {
        name: "Wireless Earbuds",
        category: "Electronics",
        price: 1299,
        rating: 4,
        img: "https://via.placeholder.com/150"
    },
    {
        name: "Smart Watch",
        category: "Electronics",
        price: 2499,
        rating: 5,
        img: "https://via.placeholder.com/150"
    },
    {
        name: "Running Shoes",
        category: "Fashion",
        price: 999,
        rating: 4,
        img: "https://via.placeholder.com/150"
    },
    {
        name: "Cotton T-Shirt",
        category: "Fashion",
        price: 499,
        rating: 4,
        img: "https://via.placeholder.com/150"
    }
];

// MongoDB Connection with Auto-Seed Logic
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dhawankart';
mongoose.connect(MONGO_URI)
  .then(async () => {
      console.log('MongoDB Connected Successfully!');
      
      // Check if products exist, if not insert sample products
      const count = await Product.countDocuments();
      if (count === 0) {
          await Product.insertMany(sampleProducts);
          console.log('Sample Products Added to MongoDB!');
      }
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

// MongoDB Schemas & Models
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    rating: { type: Number, default: 4 },
    img: { type: String, required: true }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true },
    userMobile: { type: String, required: true },
    items: Array,
    totalAmount: Number,
    paymentMode: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: "Access Denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = { mobile: "9999999999" }; // Fallback Demo User
        } else {
            req.user = user;
        }
        next();
    });
}

// API Routes
app.get('/api/products', async (req, res) => {
    try {
        const { category, search } = req.query;
        let filter = {};

        if (category && category !== 'All') {
            filter.category = category;
        }
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const products = await Product.find(filter);
        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.post('/api/place-order', authenticateToken, async (req, res) => {
    try {
        const { items, totalAmount, paymentMode } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ success: false, message: "Cart empty" });

        const newOrder = new Order({
            orderId: "DM" + Math.floor(100000 + Math.random() * 900000),
            userMobile: req.user.mobile || "9999999999",
            items: items,
            totalAmount: totalAmount,
            paymentMode: paymentMode || "COD"
        });

        await newOrder.save();
        res.json({ success: true, message: "Order Placed!", orderId: newOrder.orderId });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to save order" });
    }
});

app.get('/api/my-orders', authenticateToken, async (req, res) => {
    try {
        const userMobile = req.user.mobile || "9999999999";
        const orders = await Order.find({ userMobile }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, message: "Could not load orders" });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

