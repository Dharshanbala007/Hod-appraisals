// The pages behind the logins:
//   /api/my/...      each role's own appraisal (HoD, Vice Principal, Principal, Placement Officer, Placement Co-ordinator, Librarian, Physical Director)
//   /api/review/...  the review of appraisals by the HoD, Vice Principal, Principal and Secretary (who may do what: auth.can)
// Reviewers' marks and remarks are kept per level (review_marks); the appraisee never sees them. Every change is written to the audit log.
const path = require('path'), fsp = require('fs').promises;
const C = require('./public/config.js'), { FORMS } = require('./public/forms.js'), Auth = require('./auth.js'), { buildReport } = require('./report.js'), Dash = require('./dashboard.js'), { buildDashboard } = require('./dashpdf.js');

module.exports = function roles(app, h) {
  const { store, userOf, wrap, ROOT, STAFF, under, within, safeName, str, cleanValue, cleanInd, filesIn, dropUnused, storeUpload, sendProof, upload } = h;
  const LOCKED = { error: 'This appraisal has already been submitted. It is locked and cannot be changed.' };
  const formOf = kind => (kind === 'staff' ? { kind: 'staff', ind: C.IND } : FORMS[kind]);
  const dirOf = row => (row.kind === 'staff' ? under(STAFF, row.folder) : within(path.join(ROOT, row.folder)));   // staff proofs stay in the staff site's folder

  // The staff appraisals as the staff site saved them (STAFF/<Name> (<code>)/2025-26/form.json), copied into the database so the review can
  // keep its marks beside them. Only read here, never written. A form.json that cannot be read right now (being saved, broken) is left as it was.
  // ponytail: every list re-reads all form.json files (a few hundred small files); compare their modified times if it ever gets slow
  async function syncStaff() {
    const have = new Map((await store.all('staff')).map(r => [r.owner.toLowerCase(), r]));
    for (const d of await fsp.readdir(STAFF, { withFileTypes: true }).catch(() => [])) {
      const code = d.isDirectory() && (/ \(([A-Za-z0-9._-]{1,10})\)$/.exec(d.name) || [])[1]; if (!code) continue;
      const folder = `${d.name}/${C.YEAR}`; let data;
      try { data = JSON.parse(await fsp.readFile(path.join(STAFF, folder, 'form.json'), 'utf8')); } catch { continue; }
      const row = have.get(code.toLowerCase());
      if (!row) await store.create({ kind: 'staff', owner: code, year: C.YEAR, folder, data });
      else if (!row.removed && (row.folder !== folder || JSON.stringify(row.data) !== JSON.stringify(data))) await store.save(row, data, folder);   // a deleted one stays deleted
    }
  }
  const who = wrap(async (req, res, next) => {
    const u = await userOf(req); if (!u) return res.status(401).json({ error: 'Please log in.', login: true });
    if (u.mustChange) return res.status(403).json({ error: 'Choose your own password first (you logged in with a one-time password).', change: true });
    req.user = u; next();
  });

  // ================= own appraisal
  const terms = form => (form.period === 'semester' ? ['S1', 'S2'] : ['']);
  const termOf = p => (p === 'S1' || p === 'S2' ? p : p === 'year' ? '' : null);
  const mine = wrap(async (req, res, next) => {
    const form = FORMS[req.user.role], term = termOf(req.params.term);
    if (!form) return res.status(403).json({ error: 'This login has no appraisal form of its own.' });
    if (term === null || !terms(form).includes(term)) return res.status(404).json({ error: 'No such appraisal period.' });
    req.form = form; req.term = term; req.row = await store.find(form.kind, req.user.username, C.YEAR, term);
    if (req.row) req.dir = within(path.join(ROOT, req.row.folder));
    next();
  });
  // Keep only what the form defines (Part I, scored sections, annexure tables, self-review, declaration).
  async function cleanFor(form, b, dir) {
    b = b || {}; const p = b.p1 || {}, have = new Set(await filesIn(dir)), out = { p1: {}, ind: {}, tables: {}, self: {}, declared: !!b.declared };
    for (const f of form.p1) out.p1[f.k] = f.value ? f.value : f.type === 'select' ? (f.options.includes(str(p[f.k])) ? str(p[f.k]) : '') : f.type ? cleanValue(f, p[f.k]) : str(p[f.k], f.long ? 1000 : 200);
    for (const ind of form.ind) out.ind[ind.code] = cleanInd(ind, (b.ind || {})[ind.code] || {}, have);
    for (const t of form.tables || []) out.tables[t.id] = (Array.isArray((b.tables || {})[t.id]) ? b.tables[t.id] : []).slice(0, 60)
      .map(r => Object.fromEntries(t.columns.map(([k]) => [k, str((r || {})[k], 300)]))).filter(r => Object.values(r).some(Boolean));
    for (const [k] of form.selfReview || []) out.self[k] = str((b.self || {})[k], 2000);
    return out;
  }
  app.get('/api/my', who, wrap(async (req, res) => {
    const form = FORMS[req.user.role];
    if (!form) return res.json({ user: req.user, form: null, items: [] });
    const items = [];
    for (const t of terms(form)) { const r = await store.find(form.kind, req.user.username, C.YEAR, t); items.push({ term: t || 'year', status: r ? r.status : 'not started', self: r ? C.totals(r.data, form.ind).self : null }); }
    res.json({ user: req.user, form: { kind: form.kind, title: form.title, period: form.period }, items });
  }));
  app.post('/api/my/:term/open', who, mine, wrap(async (req, res) => {
    if (!req.row) {
      const u = req.user, folder = `_leaders/${safeName(u.name)} (${u.username})/${C.YEAR}${req.term ? '/' + req.term : ''}`, dir = within(path.join(ROOT, folder));
      await fsp.mkdir(dir, { recursive: true });
      const p1 = { name: u.name, ...(u.dept ? { dept: u.dept } : {}), ...(req.form.kind === 'hod' ? { designation: 'Head of the Department' } : {}) };
      req.row = await store.create({ kind: req.form.kind, owner: u.username, year: C.YEAR, term: req.term, folder, data: await cleanFor(req.form, { p1 }, dir) });
    }
    res.json({ ok: true, term: req.params.term });
  }));
  app.get('/api/my/:term', who, mine, (req, res) => (req.row ? res.json({ kind: req.row.kind, term: req.params.term, status: req.row.status, data: req.row.data }) : res.status(404).json({ error: 'Not started yet.' })));
  app.put('/api/my/:term', who, mine, wrap(async (req, res) => {
    if (!req.row) return res.status(404).json({ error: 'Not started yet.' });
    if (req.row.data.submitted) return res.status(409).json(LOCKED);
    await fsp.mkdir(req.dir, { recursive: true });
    const data = await cleanFor(req.form, req.body, req.dir);
    await store.save(req.row, data); await dropUnused(req.dir, data);
    res.json({ ok: true });
  }));
  app.post('/api/my/:term/upload', who, mine, upload.single('file'), wrap(async (req, res) => {
    if (!req.row) return res.status(404).json({ error: 'Not started yet.' });
    if (req.row.data.submitted) return res.status(409).json(LOCKED);
    await storeUpload(req, res, req.dir, req.form.ind);
  }));
  app.get('/api/my/:term/file/:stored', who, mine, wrap(async (req, res) => (req.row ? sendProof(res, req.dir, req.row.data, req.params.stored) : res.status(404).end())));
  // Edit again: a form whose owner may take it back after submitting (the HoD's) becomes editable with everything saved, until it is
  // finalised; the reviewers' marks stay, and it is reviewed again once submitted. Other forms are reopened by the Super Admin.
  app.post('/api/my/:term/reopen', who, mine, wrap(async (req, res) => {
    if (!req.row) return res.status(404).json({ error: 'Not started yet.' });
    if (!req.form.reopen) return res.status(403).json({ error: 'Ask the Super Admin to reopen this form.' });
    if (!req.row.data.submitted) return res.status(409).json({ error: 'This form is not submitted: you can still edit it.' });
    if (req.row.status === 'finalised') return res.status(409).json({ error: 'It has been finalised by the reviewer. Ask the Super Admin to reopen it.' });
    const { submitted, ...data } = req.row.data;
    await store.save(req.row, data); await store.audit(req.user.username, 'edit again', req.row.id, `${C.ROLES[req.form.kind]} took the submitted form back to edit`);
    res.json({ ok: true });
  }));
  app.post('/api/my/:term/submit', who, mine, wrap(async (req, res) => {
    if (!req.row) return res.status(404).json({ error: 'Not started yet.' });
    if (req.row.data.submitted) return res.status(409).json(LOCKED);
    const missing = C.problemsFor(req.form, req.row.data);
    if (missing.length) return res.status(409).json({ error: 'Everything marked * is compulsory. Still to fill: ' + missing.slice(0, 5).map(m => m.text).join('; ') + (missing.length > 5 ? ' …and ' + (missing.length - 5) + ' more' : ''), missing: missing.map(m => m.text) });
    req.row.data.submitted = { at: new Date().toISOString() };
    await store.save(req.row, req.row.data); await store.audit(req.user.username, 'submitted', req.row.id, `${C.ROLES[req.form.kind]} ${req.term || C.YEAR}`);
    res.json({ ok: true, at: req.row.data.submitted.at });
  }));

  // ================= review
  // what each reviewer's lists contain (opening one still needs can(view): drafts stay closed)
  const LIST = { hod: ['staff'], vp: ['staff', 'hod', 'po', 'pc', 'librarian', 'pd'], principal: ['staff', 'hod', 'vp', 'po', 'pc', 'librarian', 'pd'], secretary: C.KINDS, admin: C.KINDS };
  // the reviewer's notes of a form: verification checks (Yes / No + comment), review controls and approval items (text)
  const notesFor = kind => (kind === 'staff' ? C.CHECKS.map((c, i) => ({ key: 'check:' + (i + 1), label: c, yesno: true }))
    : FORMS[kind].checks ? FORMS[kind].checks.map((c, i) => ({ key: 'check:' + (i + 1), label: c, yesno: true }))
    : [...FORMS[kind].controls.map((c, i) => ({ key: 'control:' + (i + 1), label: c })), ...FORMS[kind].approval.map(([k, l]) => ({ key: 'approval:' + k, label: l, approval: true }))]);
  // the reviewers' marks and remarks of an appraisal, by level: { hod: { ind: { A1: { marks, remark, by, at } }, overall } ... }
  async function levelsOf(id) {
    const levels = {};
    for (const m of await store.marksOf(id)) {
      const L = levels[m.stage] = levels[m.stage] || { ind: {}, overall: null };
      if (m.section === 'overall') L.overall = { remark: m.remark || '', by: m.updated_by, at: m.updated_at };
      else L.ind[m.section] = { marks: m.marks == null ? null : Number(m.marks), remark: m.remark || '', by: m.updated_by, at: m.updated_at };
    }
    return levels;
  }
  async function review(row, u) {
    const form = formOf(row.kind), levels = await levelsOf(row.id);
    const full = { ...row.data, ...levels }, notes = {};
    for (const n of await store.notesOf(row.id)) notes[n.note_key] = { answer: n.answer || '', text: n.text || '', by: n.updated_by, at: n.updated_at };
    return { id: row.id, kind: row.kind, kindName: row.kind === 'staff' ? 'Staff' : C.ROLES[row.kind], owner: row.owner, name: row.name, dept: row.dept, term: row.term, status: row.status,
      data: row.data, levels, notes, noteList: notesFor(row.kind), totals: C.totals(full, form.ind), deviation: C.deviation(full, form.ind),
      level: Auth.levelOf(u.role), can: { edit: Auth.can(u, 'edit', row), proceed: Auth.can(u, 'proceed', row), finalise: Auth.can(u, 'finalise', row) } };
  }
  const target = wrap(async (req, res, next) => {
    const row = await store.byId(Number(req.params.aid) || 0);
    if (!row || row.removed || !Auth.can(req.user, 'view', row)) return res.status(404).json({ error: 'Appraisal not found, or not yours to see.' });
    req.row = row; next();
  });
  app.get('/api/review/list', who, wrap(async (req, res) => {
    const kinds = LIST[req.user.role]; if (!kinds) return res.status(403).json({ error: 'This login does not review appraisals.' });
    if (kinds.includes('staff')) await syncStaff();
    const rows = await store.listOf(kinds, req.user.role === 'hod' ? req.user.dept : null);
    res.json(rows.map(r => ({ id: Number(r.id), kind: r.kind, owner: r.owner, name: r.name, designation: r.designation, dept: r.dept, term: r.term, status: r.status,
      self: r.self_total == null ? null : Number(r.self_total), final: r.final_total == null ? (r.self_total == null ? null : Number(r.self_total)) : Number(r.final_total), canOpen: Auth.can(req.user, 'view', r) })));
  }));
  // the report of one list as a PDF (?kind=staff&d=CSE): the same appraisals the reviewer's list shows; drafts only as "not submitted yet"
  const STATUS = { draft: 'Being filled', submitted: 'Submitted', proceeded: 'Proceeded by HoD', finalised: 'Finalised' };
  // the analytics dashboards (dashboard.js), from the staff appraisals this login may open: a HoD gets their own department only (whatever is
  // asked); the Vice Principal, Principal, Secretary and Super Admin get any department (?d=CSE) or the whole college, with the leaders' own appraisals
  const DASH_ROLES = ['hod', 'vp', 'principal', 'secretary', 'admin'];
  async function dashboardOf(u, d) {
    const dept = u.role === 'hod' ? u.dept : C.DEPARTMENTS.includes(d) ? d : '';
    await syncStaff();
    const items = [];
    for (const r of await store.all('staff')) if ((!dept || r.dept === dept) && r.status !== 'draft' && !r.removed && Auth.can(u, 'view', r))   // submitted ones only (the Super Admin can open drafts too)
      items.push({ code: r.owner, name: r.name, designation: (r.data.p1 || {}).designation || '', dept: r.dept, data: r.data, levels: await levelsOf(r.id) });
    if (dept) return { scope: 'dept', dept, ...Dash.department(items) };
    const kinds = LIST[u.role].filter(k => k !== 'staff'), rows = await store.listOf(kinds, null), leaders = [];
    for (const a of (await store.listAccounts()).filter(a => a.active && kinds.includes(a.role)).sort((x, y) => C.KINDS.indexOf(x.role) - C.KINDS.indexOf(y.role))) {
      const mine = rows.filter(r => r.kind === a.role && String(r.owner).toLowerCase() === a.username.toLowerCase());
      for (const r of mine.length ? mine : [null]) { const open = !!r && r.status !== 'draft' && Auth.can(u, 'view', r);
        leaders.push({ role: C.ROLES[a.role], name: a.name, username: a.username, dept: a.dept || '', term: r ? r.term : '', status: r ? r.status : 'not started',
          self: open ? Number(r.self_total) : null, final: open ? Number(r.final_total ?? r.self_total) : null }); }
    }
    return { scope: 'college', ...Dash.college(items, leaders) };
  }
  app.get('/api/dashboard', who, wrap(async (req, res) => {
    if (!DASH_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'This login has no dashboard.' });
    res.json(await dashboardOf(req.user, req.query.d));
  }));
  // the same dashboard as a PDF on A4 (dashpdf.js): as many pages as it needs, no chart cut between pages
  app.get('/api/dashboard.pdf', who, wrap(async (req, res) => {
    const u = req.user; if (!DASH_ROLES.includes(u.role)) return res.status(403).json({ error: 'This login has no dashboard.' });
    const D = await dashboardOf(u, req.query.d), what = D.scope === 'dept' ? D.dept : 'Whole college';
    const pdf = await buildDashboard(D, { year: C.YEAR_LABEL, title: 'Analytics Dashboard – ' + what,
      subtitle: `Academic year ${C.YEAR_FULL}  ·  generated ${C.when(new Date().toISOString())} by ${u.name} (${C.ROLES[u.role]})  ·  final marks (after review)` });
    res.type('pdf').set('Content-Disposition', `attachment; filename="Appraisal-Dashboard-${what.replace(/[^A-Za-z0-9]+/g, '-')}-${C.YEAR}.pdf"`).send(pdf);
  }));
  // the report of one list as a PDF (?kind=staff&d=CSE&sort=final-desc): the same appraisals the reviewer's list shows; drafts only as "not submitted yet"
  app.get('/api/review/report.pdf', who, wrap(async (req, res) => {
    const u = req.user, kind = String(req.query.kind || ''), dept = str(req.query.d, 10);
    if (!(LIST[u.role] || []).includes(kind)) return res.status(403).json({ error: 'This report is not available to your login.' });
    if (kind === 'staff') await syncStaff();
    const form = formOf(kind), list = [];
    for (const r of (await store.listOf([kind], u.role === 'hod' ? u.dept : null)).filter(r => !dept || r.dept === dept)) {
      const t = r.status !== 'draft' && Auth.can(u, 'view', r) ? (await review(await store.byId(r.id), u)).totals : null, sw = t ? C.strengths(t.rows, form.ind) : { weak: [], strong: [] };
      list.push({ code: r.owner, name: r.name || '-', designation: r.designation, status: C.reportStatus(kind, r.status, STATUS), self: t && t.self, final: t && t.final, weak: sw.weak, strong: sw.strong });
    }
    const rows = C.sortReport(list, req.query.sort), done = rows.filter(x => x.self != null), avg = f => (done.length ? String(Math.round(done.reduce((s, x) => s + f(x), 0) / done.length * 10) / 10) : '-');
    const what = (kind === 'staff' ? 'Staff' : C.ROLES[kind]) + (dept || u.dept ? ' – ' + (dept || u.dept) : '');
    const pdf = await buildReport({ year: C.YEAR_LABEL, title: 'Appraisal Report – ' + what, by: `${u.name} (${C.ROLES[u.role]})`,
      subtitle: `Academic year ${C.YEAR_FULL}  ·  generated ${C.when(new Date().toISOString())} by ${u.name} (${C.ROLES[u.role]})${C.REPORT_SORTS[req.query.sort] && req.query.sort !== 'list' ? '  ·  sorted by ' + C.REPORT_SORTS[req.query.sort].toLowerCase() : ''}`,
      summary: [['Total Faculty Members', String(rows.length)], ['Submitted Faculty records', String(done.length)],
        ['Average Self Assessment Score', avg(x => x.self)], ['Average Final Assessment Score', avg(x => x.final)]],
      note: 'Self = the marks calculated from the entries; Final = after the review (HoD, Vice Principal, Principal, Secretary); Change = Final - Self. Weaker / stronger section = the section(s) with the lowest / highest share of their maximum marks in the final marks.',
      rows });
    res.type('pdf').set('Content-Disposition', `attachment; filename="Appraisal-Report-${what.replace(/[^A-Za-z0-9]+/g, '-')}-${C.YEAR}.pdf"`).send(pdf);
  }));
  app.get('/api/review/:aid', who, target, wrap(async (req, res) => res.json(await review(req.row, req.user))));
  app.get('/api/review/:aid/file/:stored', who, target, wrap(async (req, res) => sendProof(res, dirOf(req.row), req.row.data, req.params.stored)));
  // the reviewer's marks (0 … max of the section, one decimal; empty = no change at this level), remarks (why), overall remark and notes
  app.put('/api/review/:aid', who, target, wrap(async (req, res) => {
    const u = req.user, row = req.row, lv = Auth.levelOf(u.role), form = formOf(row.kind), b = req.body || {};
    if (!lv || !Auth.can(u, 'edit', row)) return res.status(403).json({ error: 'You can view this appraisal but not change it now.' });
    const prev = await review(row, u), before = prev.levels[lv] || { ind: {}, overall: null }, log = [];
    for (const ind of form.ind) {
      const x = (b.marks || {})[ind.code]; if (!x) continue;
      const raw = String(x.marks ?? '').trim(), m = raw === '' ? null : Math.round(parseFloat(raw) * 10) / 10, remark = str(x.remark, 1000);
      if (m !== null && (!isFinite(m) || m < 0 || m > ind.max)) return res.status(400).json({ error: `${ind.code}: marks must be between 0 and ${ind.max}.` });
      const old = before.ind[ind.code] || { marks: null, remark: '' };
      if (old.marks === m && old.remark === remark) continue;
      if (m === null && !remark) await store.clearMark(row.id, lv, ind.code); else await store.setMark(row.id, lv, ind.code, m, remark || null, u.username);
      log.push(`${ind.code}: ${old.marks ?? prev.totals.rows[ind.code].final} -> ${m ?? '-'}${remark !== old.remark ? ' (remark: ' + (remark || 'removed') + ')' : ''}`);
    }
    if (b.overall !== undefined) {
      const o = str(b.overall, 2000), old = (before.overall || {}).remark || '';
      if (o !== old) { if (o) await store.setMark(row.id, lv, 'overall', null, o, u.username); else await store.clearMark(row.id, lv, 'overall'); log.push('overall remark ' + (o ? 'saved' : 'removed')); }
    }
    for (const n of notesFor(row.kind)) {
      const x = (b.notes || {})[n.key]; if (!x) continue;
      const answer = n.yesno && (x.answer === 'Yes' || x.answer === 'No') ? x.answer : null, text = str(x.text, 2000);
      await store.setNote(row.id, n.key, answer, text || null, u.username);
    }
    const now = await review(row, u);
    await store.setFinal(row.id, now.totals.final);
    if (log.length) await store.audit(u.username, `marks (${C.ROLES[lv]})`, row.id, log.join('; '));
    res.json(now);
  }));
  for (const [act, status, label] of [['proceed', 'proceeded', 'Proceeded to the Vice Principal / Principal'], ['finalise', 'finalised', 'Finalised']]) {
    app.post(`/api/review/:aid/${act}`, who, target, wrap(async (req, res) => {
      if (!Auth.can(req.user, act, req.row)) return res.status(403).json({ error: `You cannot ${act} this appraisal now.` });
      await store.setStatus(req.row.id, status, req.user.username); await store.audit(req.user.username, act, req.row.id, label);
      res.json(await review(await store.byId(req.row.id), req.user));
    }));
  }
  app.get('/api/review/:aid/log', who, target, wrap(async (req, res) => res.json(await store.auditOf(req.row.id))));
  // the Super Admin reopens a submitted form of a HoD, Vice Principal, Principal or officer so that its owner can correct it (the review marks
  // stay; it is reviewed again once submitted). Staff forms belong to the staff site and are reopened there.
  app.post('/api/review/:aid/reopen', who, target, wrap(async (req, res) => {
    const row = req.row;
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only the Super Admin can reopen a form.' });
    if (row.kind === 'staff') return res.status(400).json({ error: 'Staff forms are reopened on the staff site (node unlock.js <faculty code> there).' });
    if (row.status === 'draft') return res.status(409).json({ error: 'This form is not submitted.' });
    const { submitted, ...data } = row.data;
    await store.save(row, data); await store.audit(req.user.username, 'reopen', row.id, 'Reopened for the owner to correct');
    res.json(await review(await store.byId(row.id), req.user));
  }));

  // the Super Admin deletes an appraisal (a duplicate, a test entry): it is gone from every list, report and dashboard of every login.
  // A staff appraisal is only marked deleted here (the staff site's folder is never touched) and can be restored; any other appraisal is taken
  // out with its marks, its content and files put aside in UPLOADS/_removed, and its owner can start a new one.
  app.post('/api/review/:aid/delete', who, target, wrap(async (req, res) => {
    const row = req.row, u = req.user, what = `${row.kind === 'staff' ? 'Staff' : C.ROLES[row.kind]} ${row.owner}${row.name ? ' (' + row.name + ')' : ''}`;
    if (u.role !== 'admin') return res.status(403).json({ error: 'Only the Super Admin can delete an appraisal.' });
    if (row.kind === 'staff') await store.setRemoved(row.id, u.username);
    else {
      const dest = path.join(ROOT, '_removed', new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'), `${row.kind} ${safeName(row.owner)} deleted`), dir = within(path.join(ROOT, row.folder));
      await fsp.mkdir(dest, { recursive: true }); await fsp.writeFile(path.join(dest, 'form.json'), JSON.stringify(row.data, null, 2));
      if (await fsp.access(dir).then(() => true, () => false)) for (const f of await filesIn(dir)) await fsp.rename(path.join(dir, f), path.join(dest, f));
      await store.drop(row.id);
    }
    await store.audit(u.username, 'deleted', row.id, what);
    res.json({ ok: true });
  }));
  const onlyAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only the Super Admin can do this.' }));
  app.get('/api/admin/deleted', who, onlyAdmin, wrap(async (req, res) => res.json(await store.removedList())));
  app.post('/api/admin/deleted/:aid/restore', who, onlyAdmin, wrap(async (req, res) => {
    const row = await store.byId(Number(req.params.aid) || 0); if (!row || !row.removed) return res.status(404).json({ error: 'No such deleted appraisal.' });
    await store.setRemoved(row.id, null); await store.audit(req.user.username, 'restored', row.id, `Staff ${row.owner}`);
    res.json({ ok: true });
  }));

  // ================= logins, managed by the Super Admin on the site (the same rules as accounts.js)
  const admin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only the Super Admin manages the logins.' }));
  const USER_RE = /^[A-Za-z0-9._-]{3,40}$/, pwOk = p => typeof p === 'string' && p.length >= 8 && p.length <= 100;
  const PW_RULE = 'The one-time password must have 8 to 100 characters.';
  app.get('/api/admin/logins', who, admin, wrap(async (req, res) => res.json((await store.listAccounts()).map(a => ({ username: a.username, name: a.name, role: a.role,
    roleName: C.ROLES[a.role], dept: a.dept || '', active: !!a.active, oneTime: !!a.must_change })))));
  // a new login with a one-time password: its owner chooses their own at the first login
  app.post('/api/admin/logins', who, admin, wrap(async (req, res) => {
    const b = req.body || {}, role = String(b.role || ''), dept = role === 'hod' ? C.deptOf(b.dept) : null, username = str(b.username, 40), name = str(b.name, 100);
    if (!C.ROLES[role]) return res.status(400).json({ error: 'Choose the role.' });
    if (role === 'hod' && !dept) return res.status(400).json({ error: 'Choose the department of the HoD.' });
    if (!USER_RE.test(username)) return res.status(400).json({ error: 'The username must have 3 to 40 letters, numbers, dots, dashes or underscores.' });
    if (!name) return res.status(400).json({ error: 'Type the full name.' });
    if (!pwOk(b.password)) return res.status(400).json({ error: PW_RULE });
    if (await store.findAccount(username)) return res.status(409).json({ error: `The username "${username}" already exists.` });
    const other = role === 'hod' && await store.activeHod(dept);
    if (other) return res.status(409).json({ error: `${dept} already has an active HoD login (${other.username}). Disable it first.` });
    await store.addAccount({ username, name, role, dept, passwordHash: await Auth.hash(b.password) });
    await store.audit(req.user.username, 'account added', null, `${username}: ${C.ROLES[role]}${dept ? ' ' + dept : ''}`);
    res.json({ ok: true });
  }));
  // a forgotten password: a new one-time password (and the lock after wrong passwords is lifted)
  app.post('/api/admin/logins/:username/password', who, admin, wrap(async (req, res) => {
    const a = await store.findAccount(req.params.username); if (!a) return res.status(404).json({ error: 'No such login.' });
    if (!pwOk((req.body || {}).password)) return res.status(400).json({ error: PW_RULE });
    await store.setPassword(a.username, await Auth.hash(req.body.password), true); Auth.forgive(a.username);
    await store.audit(req.user.username, 'account reset', null, a.username);
    res.json({ ok: true });
  }));
  app.post('/api/admin/logins/:username/active', who, admin, wrap(async (req, res) => {
    const a = await store.findAccount(req.params.username), on = (req.body || {}).active === true; if (!a) return res.status(404).json({ error: 'No such login.' });
    if (!on && a.username.toLowerCase() === req.user.username.toLowerCase()) return res.status(400).json({ error: 'You cannot disable your own login.' });
    const other = on && a.role === 'hod' && await store.activeHod(a.dept);
    if (other && other.username !== a.username) return res.status(409).json({ error: `${a.dept} already has an active HoD login (${other.username}). Disable it first.` });
    await store.setActive(a.username, on); await store.audit(req.user.username, on ? 'account enabled' : 'account disabled', null, a.username);
    res.json({ ok: true });
  }));
};
