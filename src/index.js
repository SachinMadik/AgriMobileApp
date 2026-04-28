require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const { initDb } = require('./db/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/weather', require('./routes/weather'));
app.use('/risks', require('./routes/risks'));
app.use('/chat', require('./routes/chat'));
app.use('/alerts', require('./routes/alerts'));
app.use('/soil', require('./routes/soil'));
app.use('/disease-zones', require('./routes/disease-zones'));
app.use('/profile', require('./routes/profile'));
app.use('/notifications', require('./routes/notifications'));
app.use('/activity', require('./routes/activity'));
app.use('/reminders', require('./routes/reminders'));
app.use('/leaching-report', require('./routes/leaching'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 404 });
});

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '3000', 10);

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

async function startServer() {
  try {
    await initDb();
  } catch (err) {
    console.error('Database initialisation failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n  CropGuard Backend running`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${localIP}:${PORT}`);
    console.log(`  Env:     ${process.env.NODE_ENV || 'development'}\n`);
  });
}

startServer();

module.exports = app;
