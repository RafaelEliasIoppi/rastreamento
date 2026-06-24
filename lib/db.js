const { neon } = require('@neondatabase/serverless');

// O banco Neon e OPCIONAL. Sem DATABASE_URL, a aplicacao roda em modo
// simulacao (veiculos + emergencias em memoria) sem quebrar nem poluir o log.
const url = process.env.DATABASE_URL;
const isConfigured = Boolean(url);
const sql = isConfigured ? neon(url) : null;

module.exports = { sql, isConfigured };
