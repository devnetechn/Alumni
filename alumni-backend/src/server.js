const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  const http = require('http');
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`alumni-backend listening on port ${PORT}`);
  });
}

module.exports = { app };
