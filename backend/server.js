const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // init DB + seed

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/wellness',  require('./routes/wellness'));
app.use('/api/rpe',       require('./routes/rpe'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
