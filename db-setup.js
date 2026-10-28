// Creates the appraisal tables (run on the server by the administrator):  node db-setup.js
// In the database file on this computer (UPLOADS/appraisal.sqlite) by default, or in the college MySQL when DB_HOST is set in .env.local
// (that database and its user are created first by the database administrator). Safe to run again: existing tables and data are kept.
// The site also creates the tables by itself when it starts.
const db = require('./db.js');
(async () => {
  try { await db.setup(); console.log(`The tables are ready in the ${db.where()}.`); }
  catch (e) { console.error('Could not set up the database:', e.message); process.exitCode = 1; }
  finally { await db.close(); }
})();
