// Logins for the HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian and Physical Director
// (staff do not log in here; their appraisals come from the staff site): password hashing (scrypt), the signed session cookie,
// the lock after wrong passwords, the logins made on the first start, and can() – who may see or edit which appraisal.
const crypto = require('crypto'), fs = require('fs'), path = require('path'), util = require('util');
const C = require('./public/config.js');
const scrypt = util.promisify(crypto.scrypt);

const ROLES = Object.keys(C.ROLES), ROLE_NAME = C.ROLES;
const BY_VP = ['hod', 'po', 'pc', 'librarian', 'pd'];   // appraisals the Vice Principal and the Principal review once submitted

const hash = async pw => { const salt = crypto.randomBytes(16); return `scrypt$${salt.toString('base64')}$${(await scrypt(pw, salt, 64)).toString('base64')}`; };
async function check(pw, stored) {
  const [t, s, h] = String(stored || '').split('$'); if (t !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64'); return crypto.timingSafeEqual(await scrypt(String(pw), Buffer.from(s, 'base64'), want.length), want);
}

// can(user, action, appraisal): user = { role, dept, username }; appraisal = { kind, dept, status, owner }; action = 'view' | 'edit' | 'proceed' | 'finalise'.
// Edit includes writing remarks. A draft is private to its owner; reviewers see an appraisal once it is submitted.
//   HoD                   own department's staff: view; edit and Proceed until proceeded
//   Vice Principal        staff (after the HoD proceeded), HoD, Placement Officer, Placement Co-ordinator, Librarian, Physical Director: view, edit, Finalise
//   Principal             the same, and also the Vice Principal's appraisal
//   Secretary             everyone, including the Principal: view and edit at any time (master control)
//   Placement Officer, Placement Co-ordinator, Librarian, Physical Director: their own appraisal only
//   Super Admin           every appraisal, drafts too: view; staff and HoD appraisals (once submitted): edit at any time, at the top level
//                         (their mark is final); also manages the logins and reopens forms
function can(user, action, a) {
  if (user && a && user.role === 'admin') return !!a.status && (action === 'view' || (action === 'edit' && (a.kind === 'staff' || a.kind === 'hod') && a.status !== 'draft'));
  if (!user || !a || !a.status || a.status === 'draft') return false;
  const { role } = user, k = a.kind, st = a.status, view = action === 'view', change = action === 'edit' || action === 'finalise';
  if (role === 'secretary') return view || action === 'edit';
  if (role === 'hod') {
    if (k !== 'staff' || !user.dept || user.dept !== a.dept) return false;
    return view || ((action === 'edit' || action === 'proceed') && st === 'submitted');
  }
  if (role === 'vp' || role === 'principal') {
    if (k === 'staff') return view || (change && st === 'proceeded');
    if (BY_VP.includes(k) || (k === 'vp' && role === 'principal')) return view || (change && st === 'submitted');
  }
  return false;
}
// which review level a role writes its marks into (null = cannot edit marks)
const levelOf = role => (C.LEVELS.includes(role) ? role : null);

// The session: a signed cookie { username, role, dept, expiry }; the server still checks the account is active on every request.
function sessions(ROOT) {
  const KEYFILE = path.join(ROOT, '.session-key'), HOURS = 12;
  const key = process.env.SESSION_SECRET || (() => { try { return fs.readFileSync(KEYFILE, 'utf8').trim(); } catch { const k = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(KEYFILE, k, { mode: 0o600 }); return k; } })();
  const sign = s => crypto.createHmac('sha256', key).update(s).digest('base64url');
  const make = acc => { const p = Buffer.from(JSON.stringify({ u: acc.username, r: acc.role, d: acc.dept || '', e: Date.now() + HOURS * 3600e3 })).toString('base64url'); return p + '.' + sign(p); };
  const read = req => {
    const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || ''); if (!m) return null;
    const [p, s] = m[1].split('.'), want = p && sign(p); if (!s || s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
    try { const j = JSON.parse(Buffer.from(p, 'base64url').toString()); return j.e > Date.now() ? { username: j.u, role: j.r, dept: j.d } : null; } catch { return null; }
  };
  const secure = req => req.secure || req.headers['x-forwarded-proto'] === 'https';
  const start = (req, res, acc) => res.append('Set-Cookie', `sid=${make(acc)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${HOURS * 3600}${secure(req) ? '; Secure' : ''}`);
  const end = (req, res) => res.append('Set-Cookie', `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure(req) ? '; Secure' : ''}`);
  return { read, start, end };
}

// 5 wrong passwords for one username lock it for 10 minutes (stops guessing)
const tries = new Map();
const locked = u => { const t = tries.get(String(u).toLowerCase()); return !!t && t.until > Date.now(); };
const failed = u => { const k = String(u).toLowerCase(), t = tries.get(k) || { n: 0, until: 0 }; if (t.until && t.until <= Date.now()) { t.n = 0; t.until = 0; } if (++t.n >= 5) t.until = Date.now() + 10 * 60e3; tries.set(k, t); };
const forgive = u => tries.delete(String(u).toLowerCase());

// The logins made on the first start, each with a one-time password that must be changed at the first login:
//   hodcse, hodaids, hodit, hodeee, hodece, hodmech, hodcivil, hodsh  (one-time password hod@nscet)
//   vp, principal, secretary, po, pc, librarian, pd                   (one-time password <username>@nscet, e.g. principal@nscet)
//   pc2, pc3: the college's two more Placement Co-ordinators, the same form as pc    (pc2@nscet, pc3@nscet)
//   admin: the Super Admin (sees everything, manages the logins, reopens forms)   (admin@nscet)
// A login is made only while that role (for a HoD: that department's HoD) has none, so a login the administrator replaced is not made again;
// the extra Placement Co-ordinators while their username is free.
const DEFAULT_LOGINS = [
  ...C.DEPARTMENTS.map(d => ({ username: 'hod' + d.toLowerCase().replace(/[^a-z0-9]/g, ''), name: 'HoD ' + d, role: 'hod', dept: d, otp: 'hod@nscet' })),
  ...['vp', 'principal', 'secretary', 'po', 'pc', 'librarian', 'pd'].map(r => ({ username: r, name: C.ROLES[r], role: r, dept: null, otp: r + '@nscet' })),
  ...['pc2', 'pc3'].map((u, i) => ({ username: u, name: `${C.ROLES.pc} ${i + 2}`, role: 'pc', dept: null, otp: u + '@nscet', extra: true })),
  { username: 'admin', name: C.ROLES.admin, role: 'admin', dept: null, otp: 'admin@nscet' },
];
async function seedLogins(store) {
  const made = [];
  for (const a of DEFAULT_LOGINS) {
    if ((await store.findAccount(a.username)) || (!a.extra && (await store.hasRole(a.role, a.dept)))) continue;
    await store.addAccount({ ...a, passwordHash: await hash(a.otp) }); made.push(a.username);
  }
  if (made.length) await store.audit('system', 'accounts added', null, made.join(', ') + ' (one-time passwords)');
  return made;
}

module.exports = { ROLES, ROLE_NAME, DEFAULT_LOGINS, hash, check, can, levelOf, sessions, seedLogins, locked, failed, forgive };
