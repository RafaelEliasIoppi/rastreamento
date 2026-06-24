const express = require('express');
const path = require('path');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// --- API route handler ---
// Dynamically loads and executes the serverless function files so we can
// test locally without the Vercel CLI.

function wrapHandler(handlerPath) {
  return async (req, res) => {
    try {
      // Clear require cache so changes are picked up on refresh
      delete require.cache[require.resolve(handlerPath)];
      const handler = require(handlerPath);
      await handler(req, res);
    } catch (err) {
      console.error(`Error in ${handlerPath}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

app.all('/api/vehicles',  wrapHandler('./api/vehicles'));
app.all('/api/emergency', wrapHandler('./api/emergency'));
app.all('/api/init',      wrapHandler('./api/init'));
app.all('/api/health',    wrapHandler('./api/health'));

// Fallback: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  RASTREAMENTO DE EMERGENCIA v2.0`);
  console.log(`  Servidor local rodando na porta ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
