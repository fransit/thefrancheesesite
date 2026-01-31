const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'francheese-secret-key-change-in-production';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'no token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid token' });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
