// Every database query of the site, in one place. Two kinds of database, the same tables and functions:
//   - without settings: a database file (SQLite, built into Node 22.13+): UPLOADS/appraisal.sqlite (or DB_FILE). No setup.
//   - on the server: MySQL / MariaDB, when DB_HOST is set in .env.local (with DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
// The form content is kept as JSON text in appraisals.data (the same shape the form.json files had); a few columns repeat what lists need.
// Proof files and PDFs stay in UPLOADS; appraisals.folder says where.
require('./env.js');
const path = require('path'), fs = require('fs');
const C = require('./public/config.js'), { FORMS } = require('./public/forms.js');

const MYSQL = !!process.env.DB_HOST;
const FILE = process.env.DB_FILE || path.join(path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'UPLOADS')), 'appraisal.sqlite');

let pool, lite;
function mysql() {
  return pool || (pool = require('mysql2/promise').createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'nscet_appraisal', charset: 'utf8mb4', timezone: 'Z', connectionLimit: 10 }));
}
function sqlite() {
  if (lite) return lite;
  const warn = process.emitWarning;   // Node marks its SQLite as "experimental": keep that one notice out of the logs
  process.emitWarning = (w, ...a) => (/SQLite/.test(String(w)) ? undefined : warn.call(process, w, ...a));
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  lite = new DatabaseSync(FILE);
  lite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return lite;
}
// one query, prepared statements only (no SQL is ever built from typed text); SELECT -> rows, anything else -> { affectedRows }
async function q(sql, params = []) {
  if (MYSQL) return (await mysql().execute(sql, params))[0];
  const st = sqlite().prepare(sql);
  return /^\s*SELECT/i.test(sql) ? st.all(...params) : { affectedRows: st.run(...params).changes };
}
const stamp = d => new Date(d).toISOString().slice(0, 19).replace('T', ' ');           // 'YYYY-MM-DD HH:MM:SS' (UTC), the same in both
const list = a => a.map(x => `'${x}'`).join(', ');
const ROLES = Object.keys(C.ROLES);

// ---- tables (MySQL 5.7+ / MariaDB 10.2+, or SQLite). JSON is stored as text so every database behaves the same.
const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(40) NOT NULL, name VARCHAR(100) NOT NULL,
    role ENUM(${list(ROLES)}) NOT NULL, dept VARCHAR(10) NULL, password_hash VARCHAR(255) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, must_change TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY username (username)) ${T}`,
  `CREATE TABLE IF NOT EXISTS appraisals (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, kind ENUM(${list(C.KINDS)}) NOT NULL, owner VARCHAR(40) NOT NULL,
    year CHAR(7) NOT NULL, term VARCHAR(2) NOT NULL DEFAULT '', name VARCHAR(100) NOT NULL DEFAULT '', designation VARCHAR(100) NOT NULL DEFAULT '', dept VARCHAR(10) NOT NULL DEFAULT '',
    folder VARCHAR(255) NOT NULL, data LONGTEXT NOT NULL, status ENUM('draft','submitted','proceeded','finalised') NOT NULL DEFAULT 'draft',
    self_total DECIMAL(5,1) NULL, final_total DECIMAL(5,1) NULL, submitted_at DATETIME NULL, proceeded_at DATETIME NULL, proceeded_by VARCHAR(40) NULL,
    finalised_at DATETIME NULL, finalised_by VARCHAR(40) NULL, recorded TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY one_per_period (kind, owner, year, term), KEY by_dept (dept, kind)) ${T}`,
  `CREATE TABLE IF NOT EXISTS review_marks (appraisal_id INT UNSIGNED NOT NULL, stage ENUM(${list(C.LEVELS)}) NOT NULL, section VARCHAR(10) NOT NULL,
    marks DECIMAL(5,1) NULL, remark TEXT NULL, updated_by VARCHAR(40) NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (appraisal_id, stage, section), CONSTRAINT fk_marks_appraisal FOREIGN KEY (appraisal_id) REFERENCES appraisals (id) ON DELETE CASCADE) ${T}`,
  `CREATE TABLE IF NOT EXISTS review_notes (appraisal_id INT UNSIGNED NOT NULL, note_key VARCHAR(40) NOT NULL, answer ENUM('Yes','No') NULL, text TEXT NULL,
    updated_by VARCHAR(40) NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (appraisal_id, note_key),
    CONSTRAINT fk_notes_appraisal FOREIGN KEY (appraisal_id) REFERENCES appraisals (id) ON DELETE CASCADE) ${T}`,
  `CREATE TABLE IF NOT EXISTS audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, who VARCHAR(40) NOT NULL,
    action VARCHAR(40) NOT NULL, appraisal_id INT UNSIGNED NULL, detail TEXT NULL, KEY by_appraisal (appraisal_id)) ${T}`,
], SQLITE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (${list(ROLES)})), dept TEXT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS appraisals (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN (${list(C.KINDS)})), owner TEXT NOT NULL COLLATE NOCASE,
    year TEXT NOT NULL, term TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', designation TEXT NOT NULL DEFAULT '', dept TEXT NOT NULL DEFAULT '', folder TEXT NOT NULL, data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','proceeded','finalised')), self_total REAL NULL, final_total REAL NULL,
    submitted_at TEXT NULL, proceeded_at TEXT NULL, proceeded_by TEXT NULL, finalised_at TEXT NULL, finalised_by TEXT NULL, recorded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (kind, owner, year, term))`,
  'CREATE INDEX IF NOT EXISTS by_dept ON appraisals (dept, kind)',
  `CREATE TABLE IF NOT EXISTS review_marks (appraisal_id INTEGER NOT NULL REFERENCES appraisals (id) ON DELETE CASCADE, stage TEXT NOT NULL CHECK (stage IN (${list(C.LEVELS)})),
    section TEXT NOT NULL, marks REAL NULL, remark TEXT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (appraisal_id, stage, section))`,
  `CREATE TABLE IF NOT EXISTS review_notes (appraisal_id INTEGER NOT NULL REFERENCES appraisals (id) ON DELETE CASCADE, note_key TEXT NOT NULL,
    answer TEXT NULL CHECK (answer IN ('Yes','No')), text TEXT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (appraisal_id, note_key))`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, who TEXT NOT NULL,
    action TEXT NOT NULL, appraisal_id INTEGER NULL, detail TEXT NULL)`,
  'CREATE INDEX IF NOT EXISTS by_appraisal ON audit_log (appraisal_id)',
];
const SCHEMA = MYSQL ? MYSQL_SCHEMA : SQLITE_SCHEMA;
const run = s => (MYSQL ? mysql().query(s) : sqlite().exec(s));
const setup = async () => {   // safe to run again
  for (const s of SCHEMA) await run(s);
  try { await run(`ALTER TABLE accounts ADD COLUMN must_change ${MYSQL ? 'TINYINT(1)' : 'INTEGER'} NOT NULL DEFAULT 0`); } catch { /* already there (tables made before the one-time passwords) */ }
  // a role added since the accounts table was made (the Super Admin): MySQL widens its list; SQLite cannot change a CHECK, so the table is
  // rebuilt with every login kept
  if (MYSQL) await run(`ALTER TABLE accounts MODIFY role ENUM(${list(ROLES)}) NOT NULL`);
  else {
    const [t] = await q("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'accounts'");
    if (t && !ROLES.every(r => t.sql.includes(`'${r}'`))) sqlite().exec(`BEGIN; ALTER TABLE accounts RENAME TO accounts_old; ${SQLITE_SCHEMA[0]};
      INSERT INTO accounts (id, username, name, role, dept, password_hash, active, must_change, created_at)
        SELECT id, username, name, role, dept, password_hash, active, must_change, created_at FROM accounts_old;
      DROP TABLE accounts_old; COMMIT;`);
  }
};

// ---- appraisals
const toRow = r => r && { id: Number(r.id), kind: r.kind, owner: r.owner, year: r.year, term: r.term || '', folder: r.folder, status: r.status, dept: r.dept, name: r.name, data: JSON.parse(r.data) };
// one appraisal (owner = faculty code or username; matching ignores upper / lower case, like the folders did); term = '' (whole year) or S1 / S2
async function find(kind, owner, year, term = '') { const [r] = await q('SELECT * FROM appraisals WHERE kind = ? AND owner = ? AND year = ? AND term = ?', [kind, owner, year, term]); return toRow(r); }
const all = async kind => (await q('SELECT * FROM appraisals WHERE kind = ? ORDER BY dept, owner, term', [kind])).map(toRow);

// save the form content and the columns the lists use (row = { id, kind }; folder only when it moved); a reviewed status (proceeded / finalised)
// is never lowered by a save
async function save(row, data, folder = null) {
  const p1 = data.p1 || {}, sub = data.submitted ? 1 : 0, self = C.totals(data, row.kind === 'staff' ? C.IND : FORMS[row.kind].ind).self;
  await q(`UPDATE appraisals SET data = ?, name = ?, designation = ?, dept = ?, self_total = ?, recorded = ?, submitted_at = ?, updated_at = ?, folder = COALESCE(?, folder),
      status = CASE WHEN ? = 0 THEN 'draft' WHEN status IN ('proceeded', 'finalised') THEN status ELSE 'submitted' END
    WHERE id = ?`,
  [JSON.stringify(data), String(p1.name || '').slice(0, 100), String(p1.designation || '').slice(0, 100), String(p1.dept || '').slice(0, 10),
    self, data.recorded ? 1 : 0, sub ? stamp(data.submitted.at) : null, stamp(Date.now()), folder, sub, row.id]);
}
// a new appraisal (if two requests race for the same one, the second simply gets the first)
async function create({ kind, owner, year, term = '', folder, data }) {
  const r = await q(`INSERT INTO appraisals (kind, owner, year, term, folder, data) VALUES (?, ?, ?, ?, ?, ?) ${MYSQL ? 'ON DUPLICATE KEY UPDATE id = id' : 'ON CONFLICT DO NOTHING'}`,
    [kind, owner, year, term, folder, JSON.stringify(data)]);
  const row = await find(kind, owner, year, term);
  if (r.affectedRows === 1) await save(row, data);
  return row;
}

const byId = async id => toRow((await q('SELECT * FROM appraisals WHERE id = ?', [id]))[0]);
// the lists of the review screens (no form content, just what a list shows)
const listOf = (kinds, dept) => q(`SELECT id, kind, owner, name, designation, dept, term, status, self_total, final_total FROM appraisals
  WHERE kind IN (${kinds.map(() => '?').join(', ')})${dept ? ' AND dept = ?' : ''} ORDER BY kind, dept, name, term`, dept ? [...kinds, dept] : kinds);
const setStatus = (id, status, by) => q(`UPDATE appraisals SET status = ?, ${status === 'proceeded' ? 'proceeded_at = ?, proceeded_by = ?' : 'finalised_at = ?, finalised_by = ?'}, updated_at = ? WHERE id = ?`,
  [status, stamp(Date.now()), by, stamp(Date.now()), id]);
const setFinal = (id, total) => q('UPDATE appraisals SET final_total = ? WHERE id = ?', [total, id]);

// ---- review: marks and remarks of each level (hod / vp / principal / secretary) per section ('overall' = the overall remark), and notes
// (verification checks, review controls, approval items) as key -> Yes/No + text
const marksOf = id => q('SELECT stage, section, marks, remark, updated_by, updated_at FROM review_marks WHERE appraisal_id = ?', [id]);
const setMark = (id, stage, section, marks, remark, by) => q(`INSERT INTO review_marks (appraisal_id, stage, section, marks, remark, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  ${MYSQL ? 'ON DUPLICATE KEY UPDATE' : 'ON CONFLICT (appraisal_id, stage, section) DO UPDATE SET'} marks = ?, remark = ?, updated_by = ?, updated_at = ?`,
  [id, stage, section, marks, remark, by, stamp(Date.now()), marks, remark, by, stamp(Date.now())]);
const clearMark = (id, stage, section) => q('DELETE FROM review_marks WHERE appraisal_id = ? AND stage = ? AND section = ?', [id, stage, section]);
const notesOf = id => q('SELECT note_key, answer, text, updated_by, updated_at FROM review_notes WHERE appraisal_id = ?', [id]);
const setNote = (id, key, answer, text, by) => q(`INSERT INTO review_notes (appraisal_id, note_key, answer, text, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
  ${MYSQL ? 'ON DUPLICATE KEY UPDATE' : 'ON CONFLICT (appraisal_id, note_key) DO UPDATE SET'} answer = ?, text = ?, updated_by = ?, updated_at = ?`,
  [id, key, answer, text, by, stamp(Date.now()), answer, text, by, stamp(Date.now())]);
const auditOf = id => q('SELECT at, who, action, detail FROM audit_log WHERE appraisal_id = ? ORDER BY id', [id]);

// ---- accounts (HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian, Physical Director)
// A password set by the administrator (or made on the first start) is a one-time password: must_change = 1 until the owner chooses their own.
const findAccount = async username => (await q('SELECT * FROM accounts WHERE username = ?', [username]))[0] || null;
const listAccounts = () => q('SELECT username, name, role, dept, active, must_change FROM accounts ORDER BY role, dept, username');
const addAccount = ({ username, name, role, dept, passwordHash }) => q('INSERT INTO accounts (username, name, role, dept, password_hash, must_change) VALUES (?, ?, ?, ?, ?, 1)', [username, name, role, dept || null, passwordHash]);
const setPassword = (username, passwordHash, mustChange) => q('UPDATE accounts SET password_hash = ?, must_change = ? WHERE username = ?', [passwordHash, mustChange ? 1 : 0, username]);
const hasRole = async (role, dept) => (await q(dept ? 'SELECT username FROM accounts WHERE role = ? AND dept = ?' : 'SELECT username FROM accounts WHERE role = ?', dept ? [role, dept] : [role])).length > 0;
const setActive = (username, active) => q('UPDATE accounts SET active = ? WHERE username = ?', [active ? 1 : 0, username]);
const activeHod = async dept => (await q("SELECT username FROM accounts WHERE role = 'hod' AND dept = ? AND active = 1", [dept]))[0] || null;

const audit = (who, action, appraisalId, detail = '') => q('INSERT INTO audit_log (who, action, appraisal_id, detail) VALUES (?, ?, ?, ?)', [who, action, appraisalId ?? null, detail]);
const ping = () => q('SELECT 1 AS ok');
const close = async () => { if (pool) { const p = pool; pool = null; await p.end(); } if (lite) { lite.close(); lite = null; } };
const where = () => (MYSQL ? `MySQL database "${process.env.DB_NAME || 'nscet_appraisal'}" on ${process.env.DB_HOST}` : `database file ${FILE}`);

module.exports = { MYSQL, MYSQL_SCHEMA, setup, find, all, save, create, byId, listOf, setStatus, setFinal, marksOf, setMark, clearMark, notesOf, setNote, auditOf, findAccount, listAccounts, addAccount, setPassword, hasRole, setActive, activeHod, audit, ping, close, where };
