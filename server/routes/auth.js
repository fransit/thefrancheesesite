const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const util = require('util');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'all fields are required' });
    }

    // Check if user exists
    const existingUser = await db`
      SELECT * FROM users WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'user already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user and get the inserted ID
    const result = await db`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashedPassword})
      RETURNING id
    `;

    const userId = result[0].id;

    // Generate token
    const token = jwt.sign({ id: userId, username, email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Registration successful',
      token,
      user: { id: userId, username, email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'all fields are required' });
    }

    // Find user
    const users = await db`
      SELECT * FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await db`
      SELECT id, username, email, created_at FROM users WHERE id = ${decoded.id}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    res.status(401).json({ error: 'invalid token' });
  }
});

module.exports = router;
