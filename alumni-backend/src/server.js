const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const meRoutes = require('./routes/me');
app.use('/api', meRoutes);

const alumniRoutes = require('./routes/alumni');
app.use('/api', alumniRoutes);

const eventsRoutes = require('./routes/events');
app.use('/api/events', eventsRoutes);

const jobsRoutes = require('./routes/jobs');
app.use('/api/jobs', jobsRoutes);

const announcementsRoutes = require('./routes/announcements');
app.use('/api/announcements', announcementsRoutes);

const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);

const groupsRoutes = require('./routes/groups');
app.use('/api/groups', groupsRoutes);

const notificationsRoutes = require('./routes/notifications');
app.use('/api', notificationsRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const statsRoutes = require('./routes/stats');
app.use('/api', statsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || err.statusCode || 500).json({ error: 'Internal server error' });
});

const http = require('http');
const { initSocket } = require('./lib/socket');
const { pool } = require('./db');

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  pool.query('SELECT 1 FROM users LIMIT 1').catch((err) => {
    console.error('Database not migrated or unreachable. Run: npm run migrate');
    console.error(err.message);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`alumni-backend listening on port ${PORT}`);
  });
}

module.exports = { app, server };
