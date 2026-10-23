const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Process probe: no database access. A shrinking uptime between calls means
// the process was restarted.
app.get('/api/health/info', (req, res) => {
  res.json({
    uptimeSeconds: Math.round(process.uptime()),
    rssMB: Math.round(process.memoryUsage().rss / 1048576),
    node: process.version,
  });
});

// Connectivity probe: reports whether each pool can reach the database.
// Only error codes/messages are returned, never connection strings.
app.get('/api/health/db', async (req, res) => {
  const { pool, appPool, platformPool } = require('./db');
  const result = {};
  for (const [name, p] of [['pool', pool], ['appPool', appPool], ['platformPool', platformPool]]) {
    try {
      await p.query('SELECT 1');
      result[name] = 'ok';
    } catch (err) {
      result[name] = `${err.code || ''} ${err.message || ''}`.trim() || String(err);
    }
  }
  res.json(result);
});

const platformRoutes = require('./routes/platform');
app.use('/api/platform', platformRoutes);

const platformAdminRoutes = require('./routes/platformAdmin');
app.use('/api/platform/admin', platformAdminRoutes);

const paymentsWebhookRoutes = require('./routes/paymentsWebhook');
app.use('/api/payments', paymentsWebhookRoutes);

const { resolveTenant } = require('./middleware/tenant');
app.use(resolveTenant);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const schoolRoutes = require('./routes/school');
app.use('/api', schoolRoutes);

const registrationRoutes = require('./routes/registration');
app.use('/api/registration', registrationRoutes);

const chatRoutes = require('./routes/chat');
app.use('/api', chatRoutes);

const meRoutes = require('./routes/me');
app.use('/api', meRoutes);

const alumniRoutes = require('./routes/alumni');
app.use('/api', alumniRoutes);

const eventPhotosRoutes = require('./routes/eventPhotos');
app.use('/api/events', eventPhotosRoutes);

const eventsRoutes = require('./routes/events');
app.use('/api/events', eventsRoutes);

const jobsRoutes = require('./routes/jobs');
app.use('/api/jobs', jobsRoutes);

const announcementsRoutes = require('./routes/announcements');
app.use('/api/announcements', announcementsRoutes);

const partnersRoutes = require('./routes/partners');
app.use('/api/partners', partnersRoutes);

const batchGalleryRoutes = require('./routes/batchGallery');
app.use('/api/batch-gallery', batchGalleryRoutes);

app.use('/api/sponsor', require('./routes/sponsor'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/alumni-stories', require('./routes/alumniStories'));

const officersRoutes = require('./routes/officers');
app.use('/api/officers', officersRoutes);

const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);

const batchesRoutes = require('./routes/batches');
app.use('/api/batches', batchesRoutes);

const publicStatsRoutes = require('./routes/publicStats');
app.use('/api/public-stats', publicStatsRoutes);

const directoryRoutes = require('./routes/directory');
app.use('/api/directory', directoryRoutes);

const groupsRoutes = require('./routes/groups');
app.use('/api/groups', groupsRoutes);

const notificationsRoutes = require('./routes/notifications');
app.use('/api', notificationsRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const statsRoutes = require('./routes/stats');
app.use('/api', statsRoutes);

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

// Log (rather than silently die on) anything that escapes request handling.
process.on('unhandledRejection', (reason) => console.error('unhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

// Hosts like Hostinger load the entry file through a wrapper, so
// require.main !== module there; only skip listening under tests.
if (require.main === module || process.env.NODE_ENV !== 'test') {
  pool.query('SELECT 1 FROM users LIMIT 1').catch((err) => {
    console.error('Database not migrated or unreachable. Run: npm run migrate');
    // AggregateError (multi-address connect failures) has an empty message,
    // so surface the code and each underlying error too.
    console.error(err.code || '', err.message || '');
    for (const e of err.errors || []) console.error(' -', e.code, e.address, e.port, e.message);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`alumni-backend listening on port ${PORT}`);
  });
}

module.exports = { app, server };
