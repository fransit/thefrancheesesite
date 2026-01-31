const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const whitelistRoutes = require('./routes/whitelist');
const trackingRoutes = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/tracking', trackingRoutes);

// Serve frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Routes for panel pages
app.get('/overview', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/panel.html'));
});

app.get('/products', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/panel.html'));
});

app.get('/devlogs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/panel.html'));
});

// Static files middleware (after routes to avoid conflicts)
app.use(express.static(path.join(__dirname, '../public')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Cheese Secure - Roblox Licensing Platform 🧀    ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║                                                           ║
║   Routes:                                                 ║
║   • /           - Login Page                              ║
║   • /register   - Register Page                           ║
║   • /overview   - Dashboard Overview                     ║
║   • /products   - Products Management                     ║
║   • /devlogs    - Activity Logs                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
