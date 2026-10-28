// Creates the appraisal tables (run on the server by the administrator):  node db-setup.js
// In the database file on this computer (UPLOADS/appraisal.sqlite) by default, or in the college MySQL when DB_HOST is set in .env.local
// (that database and its user are created first by the database administrator). Safe to run again: existing tables and data are kept.
// The site also creates the tables by itself when it starts.
//     node db-setup.js --sql > schema.sql      writes schema.sql: the same MySQL / MariaDB tables as SQL, for the database administrator
const db = require('./db.js');
const HEAD = `-- NSCET Appraisal (HoD / Vice Principal / Principal / Secretary / officers): the MySQL 5.7+ / MariaDB 10.2+ tables.
-- Made from db.js by  node db-setup.js --sql > schema.sql  (do not edit by hand: the test checks that they match).
-- Run once in the site's database (see README):   mysql -u appraisal -p nscet_appraisal < schema.sql
-- The site also creates these tables itself when it starts. Safe to run again: existing tables and data are kept.
--   accounts      the logins (HoD per department, VP, Principal, Secretary, Placement Officer / Co-ordinator, Librarian, Physical Director)
--   appraisals    one row per appraisal: the staff ones copied from the staff site's folder, and each role's own (form content as JSON text)
--   review_marks  the marks and remark of each reviewer level (hod / vp / principal / secretary) per section; 'overall' = overall remark
--   review_notes  the reviewer's verification checks, review controls and approval items
--   audit_log     who did what and when (logins, marks changed, Proceed, Finalise, submissions)
`;
if (process.argv[2] === '--sql') process.stdout.write(HEAD + db.MYSQL_SCHEMA.map(s => `\n${s.replace(/\n\s+/g, '\n  ')};\n`).join(''));
else (async () => {
  try { await db.setup(); console.log(`The tables are ready in the ${db.where()}.`); }
  catch (e) { console.error('Could not set up the database:', e.message); process.exitCode = 1; }
  finally { await db.close(); }
})();
