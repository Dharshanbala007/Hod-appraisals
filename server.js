// NSCET Appraisal – the site of the HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian and
// Physical Director: a web of its own, beside the staff site (facultysa). Logins, each role's own appraisal and the review are kept in the
// database (db.js); their proofs in UPLOADS/_leaders/. The staff appraisals are read from the staff site's UPLOADS folder (STAFF_UPLOADS),
// which this site never writes to.
const express = require('express'), multer = require('multer'), fs = require('fs'), path = require('path');
const fsp = fs.promises;
const { PDFDocument } = require('pdf-lib');
const C = require('./public/config.js');
const store = require('./db.js');
const Auth = require('./auth.js');

const ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'UPLOADS'));
fs.mkdirSync(ROOT, { recursive: true });
// the staff site's UPLOADS folder on this server: <Staff Name> (<faculty code>)/2025-26/form.json + proofs (read only)
const STAFF = path.resolve(process.env.STAFF_UPLOADS || path.join(__dirname, '..', 'appraisal-web', 'UPLOADS'));
const MIME_EXT = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: C.MAX_MB_ANY() * 1048576 + 1 }, fileFilter: (req, f, cb) => cb(null, f.mimetype in MIME_EXT) });

const str = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const safeName = s => str(s, 60).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').replace(/^\.+|\.+$/g, '').trim() || 'Unnamed';
const under = (base, p) => { const r = path.resolve(base, p); if (!r.startsWith(base + path.sep)) throw new Error('bad path'); return r; };
const within = p => under(ROOT, p);
const exists = p => fsp.access(p).then(() => true, () => false);
const isReport = n => /^Appraisal_.+\.pdf$/.test(n);
const filesIn = async dir => (await fsp.readdir(dir)).filter(n => !n.startsWith('form.json') && !isReport(n)); // proofs only

// One typed value, checked against its field definition in config.js.
function cleanValue(f, raw) {
  const s = str(raw, 300);
  if (f.type === 'select') return f.options.some(o => o.l === s) ? s : '';
  if (f.type === 'period') return C.isPeriod(s) ? C.normPeriod(s) : (/^[0-9\- to]*$/i.test(s) ? s.slice(0, 30) : '');   // typed dates: valid periods are normalised, half-typed text is kept so nothing is lost
  if (f.type === 'number') { const n = parseFloat(s); return isNaN(n) ? '' : String(Math.min(Math.max(n, f.min ?? 0), f.max ?? 100000)); }
  if (f.type === 'date') { const d = C.parseDate(s); return d ? `${C.pad(d.d)}-${C.pad(d.mo)}-${d.y}` : (/^[0-9-]*$/.test(s) ? s.slice(0, 10) : ''); }   // dd-mm-yyyy (half-typed kept)
  return s;
}

// One scored section of any form: only the rows, fields and choices it defines; files must already be in the appraisal's folder.
function cleanInd(ind, d, have) {
  let rows = (Array.isArray(d.rows) ? d.rows : []).slice(0, 60).map(r => {
    const g = ind.groups.find(x => x.id === r.g) || ind.groups[0], v = {};
    for (const f of g.fields) v[f.k] = cleanValue(f, (r.v || {})[f.k]);
    const f = r.file, ok = f && have.has(f.stored);
    return { g: g.id, v, ...(ok ? { file: { stored: f.stored, name: str(f.name, 200), mime: path.extname(f.stored) === '.pdf' ? 'application/pdf' : path.extname(f.stored) === '.png' ? 'image/png' : 'image/jpeg', pages: Math.max(1, parseInt(f.pages) || 1) } } : {}) };
  }).filter(C.started);                                      // blank rows are not stored
  rows = rows.filter((r, i) => !(ind.groups.find(g => g.id === r.g) || {}).single || rows.findIndex(x => x.g === r.g) === i);   // a one-row group keeps one row
  return { ...(d.removed === true ? { removed: true } : {}),                                 // "Remove section": nothing to claim, 0 marks (the entries stay saved, hidden, so it can be added back)
    ...(ind.gate ? { gate: d.gate === 'Yes' || d.gate === 'No' ? d.gate : '' } : {}),
    ...(ind.pick ? { pick: ind.pick.options.some(o => o.l === d.pick) ? d.pick : '' } : {}), rows };
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
// While the forms are being validated, the Render copy shows only the seven forms (preview.html, nothing saved). Remove after validation.
if (process.env.RENDER || process.env.FORMS_PREVIEW) app.get(['/', '/index.html'], (req, res) => res.redirect('/preview.html'));
app.use(express.static(path.join(__dirname, 'public')));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => { console.error(e); res.status(500).json({ error: 'Could not save or read the appraisal. Please try again.' }); });

// remove uploads no longer claimed (only if older than 10 min, so a file just uploaded is never lost to a racing save); best effort: the form is already saved
async function dropUnused(dir, data) {
  const used = new Set(Object.values(data.ind).flatMap(d => d.rows.filter(r => r.file).map(r => r.file.stored)));
  for (const n of await filesIn(dir)) if (!used.has(n)) await fsp.stat(path.join(dir, n)).then(s => Date.now() - s.mtimeMs > 600000 && fsp.unlink(path.join(dir, n))).catch(() => {});
}
// one proof file into an appraisal's folder (any form): the size limit of its section, PDFs must be readable, names never clash
async function storeUpload(req, res, dir, inds) {
  if (!req.file) return res.status(400).json({ error: 'Only PDF, JPG or PNG files can be attached' });
  const sec = inds.find(i => i.code === req.body.code), limit = C.maxMB(sec);   // the size limit depends on the section
  if (req.file.size > limit * 1048576) return res.status(413).json({ error: `This file is ${(req.file.size / 1048576).toFixed(1)} MB. Files in ${sec ? sec.code : 'this section'} can be at most ${limit} MB.` });
  req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); // multipart names arrive as latin1; restore UTF-8 (en dash, Tamil, accents)
  const ext = MIME_EXT[req.file.mimetype], base = safeName(path.basename(req.file.originalname, path.extname(req.file.originalname))).slice(0, 80);
  // Every PDF must be readable, so reject protected or unreadable ones now (the owner can fix it on the spot).
  let pages = 1;
  if (ext === '.pdf') try { pages = (await PDFDocument.load(req.file.buffer)).getPageCount(); } catch (e) {
    return res.status(400).json({ error: /encrypt/i.test(e.message)
      ? 'This PDF is password-protected or locked, so it cannot be added to the report. Open it, choose Print → Save as PDF to make an unprotected copy, and upload that.'
      : 'This PDF could not be read. Open it, choose Print → Save as PDF to re-save it, and upload that.' });
  }
  const b = isReport(base + ext) ? 'proof ' + base : base; // never clash with a report's name
  let stored = b + ext, n = 1;
  while (await exists(path.join(dir, stored))) stored = `${b} (${++n})${ext}`;
  await fsp.mkdir(dir, { recursive: true });   // (a database restored on a new server may not have the folder yet)
  await fsp.writeFile(path.join(dir, stored), req.file.buffer);
  res.json({ stored, name: str(req.file.originalname, 200), mime: req.file.mimetype, pages });
}
// a proof of an appraisal: only a file its form refers to
const sendProof = (res, dir, data, stored) => {
  const name = path.basename(stored), ok = Object.values(data.ind || {}).some(d => (d.rows || []).some(r => r.file && r.file.stored === name));
  ok ? res.sendFile(path.join(dir, name)) : res.status(404).end();
};

// ---- logins: HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian, Physical Director (accounts)
const sess = Auth.sessions(ROOT);
const person = a => ({ username: a.username, name: a.name, role: a.role, roleName: C.ROLES[a.role], dept: a.dept || '', mustChange: !!a.must_change });
// who is logged in: the signed cookie, checked against the database every time (a disabled or changed login stops working at once)
async function userOf(req) {
  const s = sess.read(req), a = s && await store.findAccount(s.username);
  return a && a.active && a.role === s.role ? person(a) : null;
}
app.post('/api/login', wrap(async (req, res) => {
  const username = str(req.body.username, 40), password = String(req.body.password ?? '');
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' });
  if (Auth.locked(username)) return res.status(429).json({ error: 'Too many wrong attempts. Please wait 10 minutes, then try again.' });
  const a = await store.findAccount(username);
  if (!a || !a.active || !(await Auth.check(password, a.password_hash))) { Auth.failed(username); return res.status(401).json({ error: 'Username or password is wrong.' }); }
  Auth.forgive(username); sess.start(req, res, a); await store.audit(a.username, 'login', null);
  res.json(person(a));
}));
// choose a new password: required after logging in with a one-time password (nothing else opens until then); otherwise the current one is asked again
app.post('/api/password', wrap(async (req, res) => {
  const u = await userOf(req); if (!u) return res.status(401).json({ error: 'Please log in.', login: true });
  const a = await store.findAccount(u.username), pw = String(req.body.password ?? '');
  if (!u.mustChange) {
    if (Auth.locked(u.username)) return res.status(429).json({ error: 'Too many wrong attempts. Please wait 10 minutes, then try again.' });
    if (!(await Auth.check(String(req.body.current ?? ''), a.password_hash))) { Auth.failed(u.username); return res.status(400).json({ error: 'Your current password is wrong.' }); }
  }
  if (pw.length < 8 || pw.length > 100) return res.status(400).json({ error: 'The new password must have 8 to 100 characters.' });
  if (await Auth.check(pw, a.password_hash)) return res.status(400).json({ error: 'Choose a password different from the one you have now.' });
  await store.setPassword(a.username, await Auth.hash(pw), false); await store.audit(a.username, 'password changed', null);
  res.json({ ...u, mustChange: false });
}));
app.post('/api/logout', (req, res) => { sess.end(req, res); res.json({ ok: true }); });
app.get('/api/me', wrap(async (req, res) => { const u = await userOf(req); u ? res.json(u) : res.status(401).json({ error: 'Please log in.', login: true }); }));

// the install steps and the tests wait for this: it answers only when the database can be reached; it also says whether the staff folder is found
app.get('/healthz', async (req, res) => {
  try { await store.ping(); res.json({ ok: true, storage: store.MYSQL ? 'mysql' : 'sqlite', uploads: ROOT, staffUploads: STAFF, staffFound: await exists(STAFF) }); }
  catch (e) { res.status(503).json({ ok: false, error: 'The database cannot be reached: ' + e.message }); }
});

// the pages behind the logins: each role's own appraisal, and the review (roles.js)
require('./roles.js')(app, { store, userOf, wrap, ROOT, STAFF, under, within, safeName, str, cleanValue, cleanInd, filesIn, dropUnused, storeUpload, sendProof, upload });

app.use((err, req, res, next) => { // body-parse and upload-limit errors: friendly JSON instead of an HTML error page
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File too large (the largest allowed is ${C.MAX_MB_ANY()} MB)` });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: 'Bad request' });
  console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (require.main === module) store.setup().then(() => Auth.seedLogins(store)).then(   // the tables and the first logins are made on the first start (safe on every start)
  made => {
    if (made.length) console.log('Logins added with one-time passwords: ' + made.join(', '));
    app.listen(process.env.PORT || 3001, () => console.log(`http://localhost:${process.env.PORT || 3001}  (files in ${ROOT}; staff appraisals read from ${STAFF}; ${store.where()})`));
  },
  e => { console.error('Could not open the database:', e.message); process.exit(1); });
module.exports = { app };
