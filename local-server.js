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
      // Hot-reload: limpa o cache de TODO modulo local do projeto (api/ e lib/),
      // nunca de node_modules. Sem isso, mudancas em lib/ (db, simulation) ficavam
      // presas em cache e o servidor servia codigo antigo.
      for (const key of Object.keys(require.cache)) {
        if (key.startsWith(__dirname) && !key.includes('node_modules')) {
          delete require.cache[key];
        }
      }
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
app.all('/api/sectors',   wrapHandler('./api/sectors'));
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
