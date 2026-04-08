const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'sport_secret_2024';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Sin autorización' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireCoach(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'coach') return res.status(403).json({ error: 'Solo para coaches' });
    next();
  });
}

module.exports = { requireAuth, requireCoach };
