// The logins: HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian, Physical Director.
// Pages (in the address after #): home with tabs (#t=depts&d=CSE), own appraisal (#m=S1 | S2 | year), review of an appraisal (#r=12).
// Staff have no login: they use index.html with their faculty code.
const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = t => esc(t).split('\n').join('<br>');
const C = CFG, FM = FORMS.FORMS, r1 = x => Math.round(x * 10) / 10;
const PREVIEW = !!window.PREVIEW;   // preview.html: the seven forms for validation, nothing saved (remove after validation)
const TERM = { S1: 'Semester 1', S2: 'Semester 2', year: C.YEAR_FULL, '': C.YEAR_FULL };
const STATUS = { 'not started': 'Not started', draft: 'Being filled', submitted: 'Submitted', proceeded: 'Proceeded by HoD', finalised: 'Finalised' };
const LV = { self: 'Self (calculated)', ...Object.fromEntries(C.LEVELS.map(l => [l, C.ROLES[l]])) };
const REVIEWER = { hod: 'Vice Principal / Principal', vp: 'Principal', principal: 'Secretary', po: 'Vice Principal / Principal', pc: 'Vice Principal / Principal', librarian: 'Vice Principal / Principal', pd: 'Vice Principal / Principal' };
const SUPPORT = ['po', 'pc', 'librarian', 'pd'], NO_SUM = /pct|highest|average/;
const STAFF_P1 = [['name', 'Name'], ['designation', 'Designation'], ['dept', 'Department'], ['workload', 'Workload (hrs/week)'], ['courses', 'Courses handled'], ['duties', 'Other approved duties']].map(([k, label]) => ({ k, label }));
const formOf = kind => (kind === 'staff' ? { kind, ind: C.IND, domains: C.DOMAINS, p1: STAFF_P1 } : FM[kind]);
const chg = n => (n > 0 ? '+' + r1(n) : n < 0 ? '−' + r1(-n) : '0');
const cls = n => (n > 0 ? 'up' : n < 0 ? 'down' : '');
const at = s => (s ? C.when(/T|Z$/.test(s) ? s : s.replace(' ', 'T') + 'Z') : '');   // database times are UTC
const badge = st => `<span class="badge st-${esc(st.replace(' ', '-'))}">${esc(STATUS[st] || st)}</span>`;
const card = (title, html, id = '') => `<div class="card"${id ? ` id="${id}"` : ''}><h3>${esc(title)}</h3><div style="margin-top:12px">${html}</div></div>`;
const fail = e => { if (!e.quiet) alert(e.message); };
let ME, LAST = '#', DIRTY = false, pending = false, timer;   // DIRTY = review marks typed but not saved; pending = own form not saved yet

async function api(url, opt = {}) {
  if (opt.body && !(opt.body instanceof FormData)) { opt.body = JSON.stringify(opt.body); opt.headers = { 'Content-Type': 'application/json' }; }
  const r = await fetch(url, opt), j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.login) { ME = null; DIRTY = pending = false; loginPage(url === '/api/me' ? '' : 'Your session has ended. Please log in again.'); throw Object.assign(new Error(j.error), { quiet: true }); }
  if (r.status === 403 && j.change) { ME.mustChange = true; passwordPage(true); throw Object.assign(new Error(j.error), { quiet: true }); }
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error ' + r.status), j);
  return j;
}
const go = h => (location.hash === h || (h === '#' && !location.hash) ? route() : (location.hash = h));
const userline = () => `<div class="userline"><span><b>${esc(ME.name)}</b> <span class="mute">${esc(ME.roleName)}${ME.dept ? ' · ' + esc(ME.dept) : ''}</span></span>
  <span class="actions"><button class="alt" data-go="#pw">Change password</button><button class="alt" data-logout>Log out</button></span></div>`;

/* ---------- login ---------- */
function loginPage(err = '') {
  app.onclick = app.oninput = app.onchange = null;
  app.innerHTML = `<div class="login"><h3>Login</h3>
    <p class="sub">For the HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian and Physical Director. Staff fill their appraisal on the <a href="https://facultysa.nscet.org/">faculty appraisal site</a> with their faculty code.</p>
    <p class="sub">First time? Log in with the one-time password given by the college; you will then choose your own password.</p>
    <form><div class="grid" style="margin-top:24px">
      <div><label for="u">Username</label><input id="u" autocomplete="username" required maxlength="40"></div>
      <div><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div></div>
      <p class="warn" id="err" style="margin-top:12px">${esc(err)}</p><hr class="sep"><div class="actions"><button>Log in</button></div></form></div>`;
  $('form').onsubmit = async e => {
    e.preventDefault();
    try { ME = await api('/api/login', { method: 'POST', body: { username: $('#u').value.trim(), password: $('#pw').value } }); route(); }
    catch (x) { $('#err').textContent = x.message; }
  };
}

/* ---------- password: chosen after logging in with a one-time password (forced), or changed later ---------- */
function passwordPage(forced) {
  app.onclick = app.oninput = app.onchange = null;
  app.innerHTML = (forced ? '' : userline()) + `<div class="login"><h3>${forced ? 'Choose your password' : 'Change password'}</h3>
    <p class="sub">${forced ? `Welcome, ${esc(ME.name)}. You logged in with a one-time password. Choose your own password to continue, and use it from now on.` : 'Type your current password, then the new one.'}</p>
    <form><div class="grid" style="margin-top:24px">
      ${forced ? '' : '<div><label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password" required></div>'}
      <div><label for="np">New password</label><input id="np" type="password" autocomplete="new-password" minlength="8" maxlength="100" required></div>
      <div><label for="np2">New password again</label><input id="np2" type="password" autocomplete="new-password" required></div></div>
      <p class="mute" style="margin-top:12px">At least 8 characters. Keep it to yourself.</p>
      <p class="warn" id="err" style="margin-top:12px"></p><hr class="sep">
      <div class="actions">${forced ? '<button type="button" class="alt" data-logout>Log out</button>' : '<button type="button" class="alt" data-go="#">Cancel</button>'}<button>Save password</button></div></form></div>`;
  $('form').onsubmit = async e => {
    e.preventDefault();
    if ($('#np').value !== $('#np2').value) { $('#err').textContent = 'The two new passwords do not match.'; return; }
    try { ME = await api('/api/password', { method: 'POST', body: { current: forced ? '' : $('#cur').value, password: $('#np').value } }); alert('Your password is saved. Use it from now on.'); go('#'); }
    catch (x) { $('#err').textContent = x.message; }
  };
}

/* ---------- home: tabs by role ---------- */
const TABS = () => [
  FM[ME.role] && ['my', 'My appraisal'],
  ME.role === 'hod' && ['dept', 'My department'],
  ['vp', 'principal', 'secretary', 'admin'].includes(ME.role) && ['depts', 'Departments'],
  ['vp', 'principal', 'secretary', 'admin'].includes(ME.role) && ['support', 'Placement, Library & Sports'],
  ['principal', 'secretary', 'admin'].includes(ME.role) && ['vpf', 'Vice Principal'],
  ['secretary', 'admin'].includes(ME.role) && ['prf', 'Principal'],
  ['hod', 'vp', 'principal', 'secretary', 'admin'].includes(ME.role) && ['dash', 'Dashboard'],
  ME.role === 'admin' && ['logins', 'Logins'],
].filter(Boolean);
async function home(tab, dept) {
  const tabs = TABS(); if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
  const body = tab === 'my' ? await myTab() : tab === 'dash' ? await dashTab(dept) : tab === 'logins' ? await loginsTab() : listTab(tab, await api('/api/review/list'), dept);
  LAST = location.hash || '#';
  app.onclick = app.oninput = app.onchange = null;
  app.innerHTML = userline() + `<nav class="tabs">${tabs.map(([id, l]) => `<a href="#t=${id}" class="${id === tab ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav>` + body;
  if (tab === 'logins') loginsWire();
  else if (ME.role === 'admin' && !['my', 'dash'].includes(tab)) app.onclick = e => { const b = e.target.closest('[data-del]'); if (b) deleteAppraisal(b).then(ok => ok && route()).catch(fail); };
  if (tab === 'dash') app.onchange = e => { if (e.target.matches('[data-dash]')) go('#t=dash' + (e.target.value ? '&d=' + encodeURIComponent(e.target.value) : '')); };
}
async function myTab() {
  const my = await api('/api/my');
  return card(my.form.title, `<p class="sub">Academic year ${C.YEAR_FULL}. ${my.form.period === 'semester' ? 'One form per semester; the annual score is the average of the two verified semesters.' : 'One form for the academic year.'}
    After you submit, it goes to the ${REVIEWER[my.form.kind]} for review.</p>
    <table style="margin-top:12px"><tr><th>Form</th><th>Status</th><th>Self total</th><th></th></tr>${my.items.map(x => `<tr><td>${esc(x.term === 'year' ? `Academic year ${C.YEAR_FULL} appraisal form` : TERM[x.term])}</td><td>${badge(x.status)}</td><td>${x.self ?? '–'}</td>
      <td><button class="alt" data-go="#m=${x.term}">${x.status === 'not started' ? 'Start' : x.status === 'draft' ? 'Continue' : 'View'}</button></td></tr>`).join('')}</table>`);
}
// the Super Admin's Delete (a duplicate or test entry): gone from every list, report and dashboard of every login
const delBtn = x => `<button class="alt danger" data-del="${x.id}" data-kind="${esc(x.kind)}" data-what="${esc(x.owner + (x.name ? ' – ' + x.name : ''))}">Delete</button>`;
async function deleteAppraisal(b) {
  const staff = b.dataset.kind === 'staff', what = b.dataset.what;
  if (!confirm(staff ? `Delete the staff appraisal of ${what}?\n\nIt disappears from every list, report and dashboard, for every login. The staff site's files are not touched, and you can restore it from Logins → Deleted staff forms.`
    : `Delete the appraisal of ${what}?\n\nIt is removed with its review marks from every list, report and dashboard. Its content and files are kept on the server in UPLOADS/_removed, and its owner can start a new form.`)) return false;
  await api(`/api/review/${b.dataset.del}/delete`, { method: 'POST' });
  return true;
}
const listTable = rows => (rows.length ? `<div class="scroll"><table><tr><th>Code</th><th>Name</th><th>Period</th><th>Status</th><th>Self</th><th>Final</th><th>Change</th><th></th></tr>${rows.map(r => {
  const open = r.status !== 'draft';
  return `<tr><td>${esc(r.owner)}</td><td>${esc(r.name || '–')}${r.designation ? `<div class="mute">${esc(r.designation)}</div>` : ''}</td><td>${esc(TERM[r.term])}</td><td>${badge(r.status)}</td>
    <td>${open ? r.self ?? '–' : '–'}</td><td>${open ? r.final ?? '–' : '–'}</td><td class="${open ? cls(r.final - r.self) : ''}">${open && r.self != null ? chg(r.final - r.self) : ''}</td>
    <td><span class="actions">${r.canOpen ? `<button class="alt" data-go="#r=${r.id}">Open</button>` : '<span class="mute">Not submitted yet</span>'}${ME.role === 'admin' ? delBtn(r) : ''}</span></td></tr>`;
}).join('')}</table></div>` : '<p class="mute">No appraisals here yet.</p>');
// a list with its Report button (the report covers the same appraisals: one kind, one department or all)
const listCard = (title, rows, kind, dept = '') => `<div class="card"><div class="sechead"><h3>${esc(title)}</h3>${rows.length
  ? `<button class="alt" data-go="#rep=${kind}${dept ? '&d=' + encodeURIComponent(dept) : ''}">Report</button>` : ''}</div><div style="margin-top:12px">${listTable(rows)}</div></div>`;
function listTab(tab, list, dept) {
  const of = k => list.filter(r => r.kind === k);
  if (tab === 'dept') return listCard('Staff of ' + ME.dept, of('staff'), 'staff', ME.dept);
  if (tab === 'support') return SUPPORT.map(k => listCard(C.ROLES[k], of(k), k)).join('');
  if (tab === 'vpf') return listCard('Vice Principal', of('vp'), 'vp');
  if (tab === 'prf') return listCard('Principal', of('principal'), 'principal');
  const ds = C.DEPARTMENTS, inDept = d => list.filter(r => r.dept === d && (r.kind === 'staff' || r.kind === 'hod'));
  if (!ds.includes(dept)) dept = ds.find(d => inDept(d).length) || ds[0];
  return `<div class="chips">${ds.map(d => `<a class="chip ${d === dept ? 'on' : ''}" href="#t=depts&d=${encodeURIComponent(d)}">${esc(d)} <span class="mute">${inDept(d).length}</span></a>`).join('')}</div>`
    + listCard('HoD – ' + dept, inDept(dept).filter(r => r.kind === 'hod'), 'hod', dept) + listCard('Staff – ' + dept, inDept(dept).filter(r => r.kind === 'staff'), 'staff', dept);
}

/* ---------- report of a list: each appraisal's self, final and change, and its weaker and stronger sections (final marks); printable ---------- */
async function reportPage(kind, dept, sort) {
  if (!C.KINDS.includes(kind)) throw new Error('No such report.');
  if (!C.REPORT_SORTS[sort]) sort = 'list';
  const list = (await api('/api/review/list')).filter(r => r.kind === kind && (!dept || r.dept === dept)), form = formOf(kind);
  const full = await Promise.all(list.map(r => (r.canOpen && r.status !== 'draft' ? api('/api/review/' + r.id) : null)));   // drafts: not submitted yet
  const rows = C.sortReport(list.map((r, k) => ({ r, d: full[k], name: r.name || '', self: full[k] ? full[k].totals.self : null, final: full[k] ? full[k].totals.final : null })), sort);
  const secs = xs => (xs.length ? xs.map(x => `<div><b>${x.code}</b> ${esc(x.title)} <span class="mute">${r1(x.marks)}/${x.max}</span></div>`).join('') : '<span class="mute">–</span>');
  const done = rows.filter(x => x.d), avg = k => (done.length ? r1(done.reduce((s, x) => s + x[k], 0) / done.length) : '–');
  const title = (kind === 'staff' ? 'Staff' : C.ROLES[kind]) + (dept ? ' – ' + dept : ''), q = `kind=${kind}${dept ? '&d=' + encodeURIComponent(dept) : ''}`;
  const status = st => { const w = C.reportStatus(kind, st, STATUS); return w === 'Proceed' ? '<span class="badge st-finalised">Proceed</span>' : w === 'Not proceed' ? '<span class="badge st-draft">Not proceed</span>' : badge(st); };
  app.onclick = app.oninput = null;
  app.onchange = e => { if (e.target.matches('[data-rsort]')) go(`#rep=${kind}${dept ? '&d=' + encodeURIComponent(dept) : ''}&s=${e.target.value}`); };
  app.innerHTML = userline() + `<div class="bar noprint"><button class="alt" data-go="${esc(LAST)}">← Back</button><b>Report</b><span class="mute">${esc(title)}</span>
      <span class="sp"><label class="dsel" style="margin:0">Sort by <select data-rsort>${Object.entries(C.REPORT_SORTS).map(([k, l]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <button onclick="location.href = '/api/review/report.pdf?${q}&sort=${sort}'">Download PDF</button></span></div>
    <div class="card report"><h3>Appraisal report – ${esc(title)}</h3>
      <p class="sub">Academic year ${C.YEAR_FULL} · made ${esc(C.when(new Date().toISOString()))} by ${esc(ME.name)} (${esc(ME.roleName)})${sort !== 'list' ? ' · sorted by ' + esc(C.REPORT_SORTS[sort].toLowerCase()) : ''}</p>
      <div class="kpis" style="margin:12px 0">${kpi(list.length, 'Total Faculty Members')}${kpi(done.length, 'Submitted Faculty records')}${kpi(avg('self'), 'Average Self Assessment Score', done.length ? avg('self') : null)}${kpi(avg('final'), 'Average Final Assessment Score', done.length ? avg('final') : null)}</div>
      <p class="mute" style="margin:8px 0 12px">Weaker / stronger section: the section(s) with the lowest / highest share of their maximum marks, using the final marks (after review).</p>
      <div class="scroll"><table class="rep"><tr><th>Code</th><th>Name</th><th>Status</th><th>Self</th><th>Final</th><th>Change</th><th>Weaker section</th><th>Stronger section</th></tr>
      ${rows.map(({ r, d }) => { const who = `<td>${esc(r.owner)}</td><td>${esc(r.name || '–')}${r.designation ? `<div class="mute">${esc(r.designation)}</div>` : ''}</td><td>${status(r.status)}</td>`;
        if (!d) return `<tr>${who}<td colspan="5" class="mute">Not submitted yet</td></tr>`;
        const t = d.totals, sw = C.strengths(t.rows, form.ind), c = t.final - t.self;
        return `<tr>${who}<td>${r1(t.self)}</td><td>${r1(t.final)}</td><td class="${cls(c)}">${chg(c)}</td><td>${secs(sw.weak)}</td><td>${secs(sw.strong)}</td></tr>`; }).join('')}</table></div></div>`;
}

/* ---------- analytics dashboard: a department (a HoD: their own only) or the whole college (Vice Principal, Principal, Secretary) ---------- */
// Charts drawn here, no chart library: marks in one blue; the grid in one colour per band (C.HEAT: red very weak ... green strong) with the
// numbers in it; above / below the college average in blue / orange;
// appraisal stages in their status colours, always with their names and counts beside them.
const BLUE = '#2a78d6', ORANGE = '#eb6834';
const STAGES = [['not started', 'Not started', '#c7c6c0'], ['draft', 'Being filled', '#fab219'], ['submitted', 'Submitted', BLUE], ['proceeded', 'Proceeded by HoD', '#6250d6'], ['finalised', 'Finalised', '#0ca30c']];
const pctOf = v => (v == null ? '–' : r1(v) + '%'), clamp = v => Math.max(0, Math.min(100, v || 0));
const hbar = (label, share, text, tip = '') => `<div class="hrow" title="${esc(tip)}"><span class="hl">${label}</span><span class="hb"><i style="width:${clamp(share)}%"></i></span><span class="hv">${text}</span></div>`;
const heat = (v, tip) => { if (v == null) return '<td class="heat na">–</td>'; const b = C.heatOf(v); return `<td class="heat" style="background:${b.color};color:${b.ink}" title="${esc(tip)}: ${r1(v)}% of the maximum (${b.label.toLowerCase()})">${Math.round(v)}</td>`; };
const kpi = (value, label, share) => `<div class="kpi"><div class="kv">${value ?? '–'}</div><div class="kl">${esc(label)}</div>${share == null ? '' : `<div class="kb"><i style="width:${clamp(share)}%"></i></div>`}</div>`;
const keyList = xs => `<p class="ckey">${xs.map(([k, t]) => `<span><b>${esc(k)}</b> ${esc(t)}</span>`).join('')}</p>`;
// a column chart that scales with its box: items [{ label, value, text, tip }] on 0..max, with an optional dashed reference line
function columns(items, { max = 100, ref = null, refText = '' } = {}) {
  const W = Math.max(320, items.length * 56), H = 230, T = 28, B = 32, slot = W / items.length, bw = Math.min(60, slot * 0.56), base = H - B, y = v => T + (base - T) * (1 - Math.min(v || 0, max) / max);
  const grid = [0.25, 0.5, 0.75, 1].map(f => `<line x1="0" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" class="cg"/>`).join('');
  const bars = items.map((it, i) => {
    const x = slot * i + (slot - bw) / 2, top = y(it.value), r = Math.min(4, base - top, bw / 2);   // rounded at the data end only
    return `<g><title>${esc(it.tip || it.text)}</title><path d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z" fill="${BLUE}"/>
      <text x="${x + bw / 2}" y="${top - 7}" class="cv">${esc(it.text)}</text><text x="${x + bw / 2}" y="${base + 20}" class="cl">${esc(it.label)}</text></g>`;
  }).join('');
  const line = ref == null ? '' : `<line x1="0" x2="${W}" y1="${y(ref)}" y2="${y(ref)}" class="cr"/>`;   // its name goes in the key below, clear of the bars
  return `<svg class="cols" viewBox="0 0 ${W} ${H}" role="img" aria-label="column chart">${grid}<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="cb"/>${bars}${line}</svg>` + (ref == null ? '' : `<p class="ckey"><span><span class="refkey"></span>${esc(refText)}</span></p>`);
}
// the stages of a list of appraisals as one bar, with each stage's name and count
function stages(list) {
  const parts = STAGES.map(([k, l, c]) => [l, c, list.filter(x => x.status === k).length]).filter(p => p[2]);
  return `<div class="stack">${parts.map(([l, c, n]) => `<i style="width:${n / list.length * 100}%;background:${c}" title="${l}: ${n}"></i>`).join('')}</div>
    <div class="legend">${parts.map(([l, c, n]) => `<span><span class="swatch" style="background:${c}"></span>${l} <b>${n}</b></span>`).join('')}</div>`;
}
const highlight = (strong, xs) => `<div class="hlc ${strong ? 'strong' : 'weak'}"><div class="hlh">${strong ? '▲ Strongest' : '▼ Weakest'}</div>${xs.length
  ? xs.map(s => `<div class="hls"><span class="hlp">${Math.round(s.share)}%</span><span><b>${s.code}</b> ${esc(s.title)}<br><span class="mute">${s.avg} of ${s.max} marks on average</span></span></div>`).join('')
  : '<p class="mute">All sections are level.</p>'}</div>`;
const domainChart = ds => columns(ds.map(d => ({ label: d.key, value: d.share, text: Math.round(d.share) + '%', tip: `${d.key}. ${d.title}: ${d.avg} of ${d.max} marks (${pctOf(d.share)})` })))
  + keyList(ds.map(d => [d.key, `${d.title} (${d.avg} / ${d.max})`]));
async function dashTab(dept) {
  const D = await api('/api/dashboard' + (dept ? '?d=' + encodeURIComponent(dept) : ''));
  const head = ME.role === 'hod' ? `<p class="sub dsel">Department dashboard · <b>${esc(D.dept)}</b></p>`
    : `<label class="dsel">Dashboard for <select data-dash><option value="">Whole college</option>${C.DEPARTMENTS.map(d => `<option ${d === D.dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>`;
  const pdf = `<button class="alt" onclick="location.href = '/api/dashboard.pdf${D.scope === 'dept' && ME.role !== 'hod' ? '?d=' + encodeURIComponent(D.dept) : ''}'">Download PDF</button>`;
  return `<div class="dhead">${head}${pdf}</div>` + (D.scope === 'dept' ? deptDash(D) : collegeDash(D));
}
function deptDash(D) {
  if (!D.count) return card(D.dept, '<p class="mute">No submitted appraisals in this department yet.</p>');
  const removed = D.sections.filter(s => s.removed), desigMax = Math.max(...D.designations.map(x => x.count));
  const days = (D.work.find(w => w.label === 'FDP / STTP days') || {}).value || 0, work = D.work.filter(w => w.label !== 'FDP / STTP days').sort((a, b) => b.value - a.value), workMax = Math.max(1, ...work.map(w => w.value));
  return `<div class="kpis dk">${kpi(D.count, `submitted appraisal${D.count > 1 ? 's' : ''} in ${D.dept}`)}${kpi(D.self, 'average self score (out of 100)', D.self)}${kpi(D.final, 'average final score after review', D.final)}</div>
    <div class="dgrid">${card('Domain-wise average (% of the maximum)', domainChart(D.domains))}
      ${card('Strongest and weakest sections', highlight(true, D.strongest) + highlight(false, D.weakest))}</div>
    ${card('Section-wise average (% of the maximum)', columns(D.sections.map(s => ({ label: s.code, value: s.share, text: Math.round(s.share) + '%', tip: `${s.code} ${s.title}: ${s.avg} of ${s.max} marks (${pctOf(s.share)})` })))
      + keyList(D.sections.map(s => [s.code, s.title])))}
    <div class="dgrid">${card('Sections removed (nothing to claim)', removed.length ? removed.map(s => hbar(`<b>${s.code}</b> ${esc(s.title)}`, s.removed / D.count * 100, `${s.removed} of ${D.count} staff`, s.title)).join('')
        : '<p class="mute">No staff member removed a section: every section was claimed.</p>')}
      ${card('Designation-wise', D.designations.map(x => hbar(esc(x.name), x.count / desigMax * 100, `${x.count} staff · avg ${x.final}`, `${x.name}: ${x.count} staff, average self ${x.self}, average final ${x.final}`)).join(''))}</div>
    <div class="dgrid">${card('University results (A1)', D.results.passPct == null ? '<p class="mute">No university results given yet.</p>'
        : `<div class="big">${D.results.passPct}%</div><div class="kb big"><i style="width:${clamp(D.results.passPct)}%"></i></div><p class="mute">average pass % of the subjects handled, from ${D.results.staff} staff member${D.results.staff > 1 ? 's' : ''}</p>`)}
      ${card('Work done (entries in the appraisals)', work.map(w => hbar(esc(w.label), w.value / workMax * 100, w.label === 'FDP / STTP attended' ? `${w.value} · ${days} days` : String(w.value))).join(''))}</div>`;
}
function collegeDash(D) {
  if (!D.count) return card('Whole college', '<p class="mute">No submitted appraisals yet.</p>');
  const sign = n => (n == null ? '–' : n > 0 ? '+' + n : String(n)), big = Math.max(1, ...D.ranking.map(d => Math.abs(d.vsCollege || 0)));
  const vs = d => `<div class="hrow" title="${esc(d.dept)}: ${sign(d.vsCollege)} against the college average"><span class="hl">${esc(d.dept)}</span><span class="dv"><span class="neg"><i style="width:${d.vsCollege < 0 ? -d.vsCollege / big * 100 : 0}%"></i></span><span class="pos"><i style="width:${d.vsCollege > 0 ? d.vsCollege / big * 100 : 0}%"></i></span></span><span class="hv">${sign(d.vsCollege)} ${d.vsCollege > 0 ? 'above' : d.vsCollege < 0 ? 'below' : ''}</span></div>`;
  return `<div class="kpis dk">${kpi(D.count, 'submitted staff appraisals')}${kpi(D.self, 'average self score (out of 100)', D.self)}${kpi(D.final, 'average final score after review', D.final)}${kpi(`${D.ranking.length} / ${C.DEPARTMENTS.length}`, 'departments with submissions', D.ranking.length / C.DEPARTMENTS.length * 100)}</div>
    <div class="dgrid">${card('Department ranking (average final score)', columns(D.ranking.map(d => ({ label: d.dept, value: d.final, text: String(d.final), tip: `#${d.rank} ${d.dept}: average final ${d.final}, self ${d.self}, ${d.count} staff` })), { ref: D.final, refText: `college average ${D.final}` }))}
      ${card(`Compared with the college average (${D.final})`, `<p class="mute" style="margin:0 0 8px">Blue = above the average, orange = below.</p>` + D.ranking.map(vs).join(''))}</div>
    ${card('Top 10 staff (final score out of 100)', D.top.map(x => hbar(`${x.rank}. ${esc(x.name)} <span class="mute">${esc(x.dept)}</span>`, x.final, String(x.final), `${x.name} (${x.code}), ${x.designation}, ${x.dept}: self ${x.self}, final ${x.final}`)).join(''))}
    ${card('Department × section (% of the maximum)', `<div class="scroll"><table class="heatt"><tr><th>Department</th>${D.sections.map(s => `<th title="${esc(s.title)}">${s.code}</th>`).join('')}</tr>
      ${D.depts.filter(d => d.count).map(d => `<tr><td>${esc(d.dept)} <span class="mute">(${d.count})</span></td>${d.sections.map((v, i) => heat(v, `${d.dept} ${D.sections[i].code} ${D.sections[i].title}`)).join('')}</tr>`).join('')}</table></div>
      <p class="legend" style="margin-top:10px">${['0–19', '20–39', '40–59', '60–79', '80–100'].map((l, i) => `<span><span class="swatch" style="background:${C.HEAT[i].color}"></span>${l}% <b>${C.HEAT[i].label}</b></span>`).join('')}</p>` + keyList(D.sections.map(s => [s.code, s.title])))}
    ${card('Domain-wise average for the college (% of the maximum)', domainChart(D.domains))}
    ${card('HoD, Vice Principal, Principal and officer appraisals', stages(D.leaders) + `<div class="scroll" style="margin-top:12px"><table><tr><th>Role</th><th>Name</th><th>Department</th><th>Status</th><th>Self</th><th>Final</th></tr>${D.leaders.map(x => `<tr><td>${esc(x.role)}</td><td>${esc(x.name)} <span class="mute">${esc(x.username)}</span></td><td>${esc(x.dept || '–')}</td><td>${badge(x.status)}</td><td>${x.self ?? '–'}</td><td>${x.final ?? '–'}</td></tr>`).join('')}</table></div>`)}`;
}

/* ---------- logins (Super Admin): add a login, give a new one-time password, disable / enable ---------- */
async function loginsTab() {
  const L = await api('/api/admin/logins'), gone = await api('/api/admin/deleted');
  const state = a => (!a.active ? '<span class="badge st-draft">Disabled</span>' : a.oneTime ? '<span class="badge">One-time password not changed yet</span>' : '<span class="badge st-submitted">Active</span>');
  return card('Add a login', `<form id="addlogin"><div class="grid" style="margin-top:4px">
      <div><label for="nl-role">Role</label><select id="nl-role" required><option value="">Select…</option>${Object.entries(C.ROLES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
      <div><label for="nl-dept">Department (HoD only)</label><select id="nl-dept"><option value="">–</option>${C.DEPARTMENTS.map(d => `<option>${esc(d)}</option>`).join('')}</select></div>
      <div><label for="nl-user">Username</label><input id="nl-user" required maxlength="40" autocomplete="off" placeholder="e.g. pc4"></div>
      <div><label for="nl-name">Full name</label><input id="nl-name" required maxlength="100"></div>
      <div><label for="nl-pw">One-time password</label><input id="nl-pw" required minlength="8" maxlength="100" autocomplete="off"></div></div>
      <p class="mute" style="margin-top:8px">The owner logs in with the username and this one-time password, then chooses their own password.</p>
      <p class="warn" id="nl-err"></p><div class="actions"><button>Add login</button></div></form>`)
    + card(`All logins (${L.length})`, `<div class="scroll"><table><tr><th>Username</th><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr>
      ${L.map(a => `<tr><td><b>${esc(a.username)}</b></td><td>${esc(a.name)}</td><td>${esc(a.roleName)}</td><td>${esc(a.dept || '–')}</td><td>${state(a)}</td>
        <td><span class="actions"><button class="alt" data-reset="${esc(a.username)}">New password</button>${a.username === ME.username ? ''
          : `<button class="alt" data-active="${esc(a.username)}" data-on="${a.active ? '' : '1'}">${a.active ? 'Disable' : 'Enable'}</button>`}</span></td></tr>`).join('')}</table></div>`)
    + card(`Deleted staff forms (${gone.length})`, gone.length ? `<p class="sub">Hidden from every list, report and dashboard. The staff site still has their files; Restore brings one back.</p><div class="scroll" style="margin-top:8px"><table><tr><th>Code</th><th>Name</th><th>Department</th><th>Deleted</th><th></th></tr>
      ${gone.map(g => `<tr><td>${esc(g.owner)}</td><td>${esc(g.name || '–')}${g.designation ? `<div class="mute">${esc(g.designation)}</div>` : ''}</td><td>${esc(g.dept || '–')}</td><td>${esc(at(g.removed_at))} <span class="mute">by ${esc(g.removed_by)}</span></td><td><button class="alt" data-restore="${g.id}">Restore</button></td></tr>`).join('')}</table></div>`
      : '<p class="mute">None deleted.</p>');
}
function loginsWire() {
  $('#addlogin').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/admin/logins', { method: 'POST', body: { role: $('#nl-role').value, dept: $('#nl-dept').value, username: $('#nl-user').value.trim(), name: $('#nl-name').value.trim(), password: $('#nl-pw').value } });
      alert('Login added. Give its owner the username and the one-time password.'); route();
    } catch (x) { $('#nl-err').textContent = x.message; }
  };
  app.onclick = async e => {
    const b = e.target.closest('[data-reset], [data-active], [data-restore]'); if (!b) return;
    try {
      if (b.dataset.restore) await api(`/api/admin/deleted/${b.dataset.restore}/restore`, { method: 'POST' });
      else if (b.dataset.reset) {
        const pw = prompt(`New one-time password for ${b.dataset.reset} (8 to 100 characters).\nThey choose their own password at the next login.`); if (!pw) return;
        await api(`/api/admin/logins/${encodeURIComponent(b.dataset.reset)}/password`, { method: 'POST', body: { password: pw } });
        alert(`Done. Give ${b.dataset.reset} the new one-time password.`);
      } else {
        const on = !!b.dataset.on; if (!confirm(`${on ? 'Enable' : 'Disable'} the login "${b.dataset.active}"?${on ? '' : '\n\nIt stops working at once, also on a page already open.'}`)) return;
        await api(`/api/admin/logins/${encodeURIComponent(b.dataset.active)}/active`, { method: 'POST', body: { active: on } });
      }
      route();
    } catch (x) { fail(x); }
  };
}

/* ---------- review of an appraisal ---------- */
let R, LOG = [];
async function openReview(id) {
  R = await api('/api/review/' + id); LOG = await api(`/api/review/${id}/log`).catch(() => []); DIRTY = false;
  renderReview();
  app.onclick = reviewClick;
  app.oninput = app.onchange = e => { if (e.target.matches('[data-mk], [data-rk], [data-ov], [data-na], [data-nt]')) { DIRTY = true; const s = $('#saved'); if (s) s.textContent = 'Not saved yet'; } };
}
function renderReview() {
  const f = formOf(R.kind), d = R.data, t = R.totals, dv = R.deviation, mine = R.can.edit ? R.level : null, ml = R.levels[mine] || { ind: {} };
  const refs = C.proofs(d, f.ind), refOf = new Map(refs.map(p => [p.e, p.ref])), fileUrl = s => `/api/review/${R.id}/file/${encodeURIComponent(s)}`;
  const why = R.can.edit ? `You are reviewing as <b>${LV[mine]}</b>.${mine === 'admin' ? ' Your mark is final: it counts over the HoD, Vice Principal, Principal and Secretary (theirs stay in the history).' : ''} Type a mark only where you change it and write why in the remark box beside it; an empty box means no change at your level.`
    : ME.role === 'admin' ? 'Super Admin: view only here – ' + (R.status === 'draft' ? 'this form is still being filled by its owner.' : 'you change marks on staff and HoD appraisals.')
    : R.status === 'finalised' ? 'Finalised – view only. Only the Secretary (and, on staff and HoD appraisals, the Super Admin) can still change marks.'
    : R.kind === 'staff' && R.status === 'submitted' ? 'Waiting for the HoD to proceed – view only for now.'
    : R.kind === 'staff' && ME.role === 'hod' ? 'You have proceeded this appraisal – view only now.' : 'View only.';
  const levelRows = ind => {
    const r = t.rows[ind.code], rows = [['self', r.self, '', '']].concat(C.LEVELS.filter(l => (R.levels[l] || { ind: {} }).ind[ind.code]).map(l => { const m = R.levels[l].ind[ind.code]; return [l, m.marks, m.remark, m.by]; }));
    return `<table class="lv"><tr><th>Level</th><th>Marks</th><th>Remark</th><th>By</th></tr>${rows.map(([l, m, rk, by]) => `<tr><td>${LV[l]}</td><td>${m ?? '–'}</td><td>${esc(rk)}</td><td class="mute">${esc(by)}</td></tr>`).join('')}
      <tr><th>Final</th><th>${r.final} / ${ind.max}</th><th colspan="2"></th></tr></table>`;
  };
  const editBox = ind => { const m = ml.ind[ind.code] || {}; return `<div class="hod"><label for="mk-${ind.code}">Your marks (${LV[mine]})</label><label for="rk-${ind.code}">Remark – why the mark is changed</label>
    <input id="mk-${ind.code}" type="number" min="0" max="${ind.max}" step="0.1" data-mk="${ind.code}" value="${m.marks ?? ''}" placeholder="${t.rows[ind.code].final}"><textarea id="rk-${ind.code}" rows="2" data-rk="${ind.code}">${esc(m.remark)}</textarea></div>`; };
  const section = ind => {
    const r = t.rows[ind.code], lines = C.entryLines(ind, (d.ind || {})[ind.code], refOf), files = refs.filter(p => p.code === ind.code);
    return `<div class="card" id="ind-${ind.code}"><div class="sechead"><h3>${ind.code} · ${esc(ind.title)} <span class="mute">(Max ${ind.max})</span></h3>${r.final !== r.self ? `<span class="badge ${cls(r.final - r.self)}">${chg(r.final - r.self)}</span>` : ''}</div>
      <details class="rule"><summary>How marks are given</summary>${ind.summary ? ind.summary.map(esc).join('<br>') : `<b>Marks:</b> ${nl(ind.rule)}<br>${nl(ind.count)}${ind.proof ? `<br><b>Proof:</b> ${esc(ind.proof)}` : ''}`}</details>
      <ul class="lines">${lines.map(l => `<li>${esc(l.replace(/^• /, ''))}</li>`).join('') || '<li class="mute">Nothing entered</li>'}</ul>
      ${files.length ? `<p class="files">${files.map(p => `<a href="${fileUrl(p.e.file.stored)}" target="_blank" rel="noopener">${p.ref} · ${esc(p.e.file.name)}</a>`).join('')}</p>` : ''}
      ${levelRows(ind)}${mine ? editBox(ind) : ''}</div>`;
  };
  const noteTitle = R.kind === 'staff' ? 'Part IV – Verification' : f.checks ? 'Verification checklist' : 'Review controls and approval';
  const notes = R.noteList.map(n => {
    const v = R.notes[n.key] || {};
    if (!mine) return `<div class="nrow"><span>${esc(n.label)}</span><span>${n.yesno ? `<b>${esc(v.answer || '–')}</b> ` : ''}${esc(v.text || (n.yesno ? '' : '–'))}${v.by ? ` <span class="mute">(${esc(v.by)})</span>` : ''}</span></div>`;
    return `<div class="nrow"><span>${esc(n.label)}</span><span class="nin">${n.yesno ? ['Yes', 'No'].map(a => `<label><input type="radio" name="na-${n.key}" data-na="${n.key}" value="${a}" ${v.answer === a ? 'checked' : ''}> ${a}</label>`).join('') : ''}
      <input data-nt="${n.key}" value="${esc(v.text)}" placeholder="${n.yesno ? 'Comment' : 'Write here'}"></span></div>`;
  }).join('');
  const overall = C.LEVELS.filter(l => (R.levels[l] || {}).overall).map(l => `<p><b>${LV[l]}</b> <span class="mute">${esc(R.levels[l].overall.by)} · ${at(R.levels[l].overall.at)}</span><br>${nl(R.levels[l].overall.remark)}</p>`).join('');
  const kv = pairs => `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '–')}</dd>`).join('')}</dl>`;
  const extra = R.kind === 'staff' ? card('Part III – Planned contribution for the next academic year', kv([['Department', ((d.p3 || {}).next || {}).dept], ['College', ((d.p3 || {}).next || {}).clg]]))
    : (f.tables || []).map(tb => card(tb.title, tableView(tb, (d.tables || {})[tb.id] || []))).join('') + (f.selfReview ? card('Self-review', kv(f.selfReview.map(([k, l]) => [l, (d.self || {})[k]]))) : '');
  const devHtml = dv.changes.length ? `<div class="scroll"><table><tr><th>Section</th><th>Changed by</th><th>Before</th><th>After</th><th>Change</th><th>Remark</th></tr>${dv.changes.map(c => `<tr><td><a href="#" data-goto="ind-${c.code}">${c.code}</a> ${esc(c.title)}</td><td>${LV[c.level]}</td><td>${c.before}</td><td>${c.after}</td><td class="${cls(c.change)}">${chg(c.change)}</td><td>${esc(c.remark)}</td></tr>`).join('')}</table></div>
    <div class="scroll"><table style="margin-top:16px"><tr><th>Reviewer</th><th>Total before</th><th>Total after</th><th>Change</th><th>Sections changed</th></tr>${dv.levels.map(l => `<tr><td>${LV[l.level]}</td><td>${r1(l.before)}</td><td>${r1(l.after)}</td><td class="${cls(l.change)}">${chg(l.change)}</td><td>${l.sections.join(', ')}</td></tr>`).join('')}
      <tr><th>Overall (self → final)</th><th>${r1(dv.overall.before)}</th><th>${r1(dv.overall.after)}</th><th class="${cls(dv.overall.change)}">${chg(dv.overall.change)}</th><th></th></tr></table></div>`
    : '<p class="mute">No marks changed yet: the final total is the self total.</p>';
  app.innerHTML = userline() + `<div class="bar"><button class="alt" data-back>← Back</button><b>${esc(R.name)}</b><span class="mute">${esc(R.owner)} · ${esc(R.kindName)}${R.dept ? ' · ' + esc(R.dept) : ''} · ${esc(TERM[R.term])}</span>${badge(R.status)}
      <div class="sp"><span>Self <b>${r1(t.self)}</b> → Final <b>${r1(t.final)}</b> <span class="${cls(t.final - t.self)}">(${chg(t.final - t.self)})</span></span>
      ${mine ? '<span class="mute" id="saved">No changes</span><button id="save">Save</button>' : ''}${R.can.proceed ? '<button class="alt" id="proceed">Proceed</button>' : ''}${R.can.finalise ? '<button class="alt" id="finalise">Finalise</button>' : ''}${ME.role === 'admin' && R.kind !== 'staff' && R.status !== 'draft' ? '<button class="alt" id="reopen">Reopen for correction</button>' : ''}${ME.role === 'admin' ? delBtn(R) : ''}</div></div>
    <div class="note">${why}</div>
    ${card('Deviation – marks changed by reviewers', devHtml, 'deviation')}
    ${card('Score summary', `<table><tr><th>Domain</th><th>Max</th><th>Self</th><th>Final</th></tr>${Object.keys(f.domains).map(k => `<tr><td>${k}. ${esc(f.domains[k])}</td><td>${t.dom[k].max}</td><td>${r1(t.dom[k].self)}</td><td>${r1(t.dom[k].final)}</td></tr>`).join('')}
      <tr><th>TOTAL</th><th>100</th><th>${r1(t.self)}</th><th>${r1(t.final)}</th></tr></table>`)}
    ${card('Part I – Details', kv([...(R.kind === 'staff' ? [['NSCET faculty code', R.owner]] : []), ...f.p1.map(x => [x.label, x.value || (d.p1 || {})[x.k]])]))}
    ${Object.keys(f.domains).map(k => `<h2 style="font-size:16px">${k}. ${esc(f.domains[k])}</h2>` + f.ind.filter(i => i.domain === k).map(section).join('')).join('')}
    ${extra}
    ${card('Overall remarks', (overall || (mine ? '' : '<p class="mute">None yet.</p>')) + (mine ? `<label for="ov">Your overall remark (${LV[mine]})</label><textarea id="ov" rows="3" data-ov>${esc((ml.overall || {}).remark)}</textarea>` : ''))}
    ${card(noteTitle, notes, 'notes')}
    ${mine ? '<div class="actions" style="margin-bottom:16px"><button id="save2">Save</button></div>' : ''}
    ${card('History', LOG.length ? `<div class="scroll"><table><tr><th>When</th><th>Who</th><th>What</th></tr>${LOG.map(x => `<tr><td class="mute">${at(x.at)}</td><td>${esc(x.who)}</td><td>${esc(x.action)}${x.detail ? ': ' + esc(x.detail) : ''}</td></tr>`).join('')}</table></div>` : '<p class="mute">Nothing yet.</p>')}`;
}
function tableView(tb, rows) {
  if (!rows.length) return '<p class="mute">Nothing entered.</p>';
  const sum = k => { const v = rows.map(r => parseFloat(r[k])).filter(isFinite); return NO_SUM.test(k) || !v.length ? '' : r1(v.reduce((a, b) => a + b, 0)); };
  return `<div class="scroll"><table><tr>${tb.columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr>${rows.map(r => `<tr>${tb.columns.map(([k]) => `<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}
    ${tb.total ? `<tr><th>Total</th>${tb.columns.slice(1).map(([k]) => `<th>${sum(k)}</th>`).join('')}</tr>` : ''}</table></div>`;
}
async function saveReview() {
  const body = { marks: {}, notes: {} };
  for (const i of app.querySelectorAll('[data-mk]')) {
    const v = i.value.trim(); if (v !== '' && !(+v >= 0 && +v <= +i.max)) { i.focus(); throw new Error(`${i.dataset.mk}: marks must be between 0 and ${i.max}.`); }
    body.marks[i.dataset.mk] = { marks: v, remark: app.querySelector(`[data-rk="${i.dataset.mk}"]`).value };
  }
  const ov = $('#ov'); if (ov) body.overall = ov.value;
  for (const n of R.noteList) {   // only the notes changed here, so the others keep who wrote them
    const tx = app.querySelector(`[data-nt="${n.key}"]`); if (!tx) continue;
    const v = R.notes[n.key] || {}, a = app.querySelector(`[data-na="${n.key}"]:checked`), answer = a ? a.value : v.answer || '';
    if (answer !== (v.answer || '') || tx.value.trim() !== (v.text || '')) body.notes[n.key] = { answer, text: tx.value };
  }
  const y = scrollY;
  R = await api('/api/review/' + R.id, { method: 'PUT', body }); LOG = await api(`/api/review/${R.id}/log`).catch(() => LOG); DIRTY = false;
  renderReview(); scrollTo(0, y); $('#saved').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
async function act(kind) {
  if (!confirm(kind === 'reopen' ? 'Reopen this form so its owner can correct it?\n\nIt goes back to "being filled"; the review marks are kept, and it is reviewed again after the owner submits it.'
    : kind === 'proceed' ? 'Proceed this appraisal to the Vice Principal / Principal?\n\nAfter you proceed, your marks are locked and you can only view it.'
    : 'Finalise this appraisal?\n\nAfter you finalise, it is locked for the HoD, Vice Principal and Principal. Only the Secretary (and, on staff and HoD appraisals, the Super Admin) can still change marks.')) return;
  if (DIRTY) await saveReview();
  R = await api(`/api/review/${R.id}/${kind}`, { method: 'POST' }); LOG = await api(`/api/review/${R.id}/log`).catch(() => LOG); DIRTY = false;
  renderReview(); scrollTo(0, 0);
}
function reviewClick(e) {
  const el = e.target.closest('button, a'); if (!el) return;
  if (el.dataset.goto) { e.preventDefault(); document.getElementById(el.dataset.goto)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if ('back' in el.dataset) { if (!DIRTY || confirm('Your changes are not saved. Leave anyway?')) { DIRTY = false; go(LAST); } }
  else if (el.id === 'save' || el.id === 'save2') saveReview().catch(fail);
  else if (el.id === 'proceed' || el.id === 'finalise' || el.id === 'reopen') act(el.id).catch(fail);
  else if ('del' in el.dataset) deleteAppraisal(el).then(ok => { if (ok) { DIRTY = false; go(LAST); } }).catch(fail);
}

/* ---------- own appraisal (HoD, Vice Principal, Principal, Placement Officer, Placement Co-ordinator, Librarian, Physical Director) ---------- */
let M, MD, MLOCK = false;   // M = { kind, term, status, form }, MD = its data; MLOCK = submitted: read-only
const mUrl = () => '/api/my/' + M.term;
const star = () => (M.form.optional ? '' : ' <span class="req">*</span>');   // the compulsory mark (a form with nothing compulsory has none)
const indOf = c => M.form.ind.find(i => i.code === c), tbOf = id => M.form.tables.find(t => t.id === id);
function maskDate(raw) {   // 01122025 -> 01-12-2025; a date typed with dashes is left as typed
  let v = raw.replace(/[^\d-]/g, '').slice(0, 10);
  if (!v.includes('-')) v = v.length > 4 ? `${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 8)}` : v.length > 2 ? `${v.slice(0, 2)}-${v.slice(2)}` : v;
  return v;
}
const dateBox = (at, v) => `<input ${at} inputmode="numeric" maxlength="10" placeholder="dd-mm-yyyy" value="${esc(v)}">`;
function p1Field(x) {
  const v = x.value || MD.p1[x.k] || '', id = 'p1-' + x.k, lab = `<label for="${id}">${esc(x.label)}${x.optional || x.value ? '' : star()}</label>`;
  if (x.value) return `<div>${lab}<input id="${id}" value="${esc(v)}" disabled></div>`;
  if (x.type === 'select') return `<div>${lab}<select id="${id}" data-p1="${x.k}"><option value="">Select…</option>${x.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  if (x.type === 'date') return `<div>${lab}${dateBox(`id="${id}" data-p1="${x.k}" data-date`, v)}</div>`;
  if (x.type === 'period') { const [a = '', b = ''] = v.split(/\s+to\s*/i); return `<div class="wide">${lab}<div class="period">${dateBox(`id="${id}" data-pp="${x.k}.0"`, a)}<span>to</span>${dateBox(`data-pp="${x.k}.1"`, b)}</div></div>`; }
  if (x.long) return `<div>${lab}<textarea id="${id}" rows="2" data-p1="${x.k}">${esc(v)}</textarea></div>`;
  return `<div>${lab}<input id="${id}" data-p1="${x.k}" value="${esc(v)}"></div>`;
}
function inputFor(f, code, i, value) {
  const a = `data-f="${code}.${i}.${f.k}"`;
  if (f.type === 'select') return `<select ${a}><option value="">Select…</option>${f.options.map(o => `<option ${o.l === value ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  if (f.type === 'number') return `<input type="number" ${a} min="${f.min ?? 0}" ${f.max != null ? `max="${f.max}"` : ''} step="${f.step ?? 'any'}" value="${esc(value)}">`;
  if (f.type === 'period') { const [x, y] = String(value || '').split(/\s+to\s*/i); return `<div class="period">${dateBox(`data-fp="${code}.${i}.${f.k}.0"`, x)}<span>to</span>${dateBox(`data-fp="${code}.${i}.${f.k}.1"`, y)}</div>`; }
  return `<input ${a} value="${esc(value)}">`;
}
async function openMine(term) {
  await api(`/api/my/${term}/open`, { method: 'POST' });
  M = await api('/api/my/' + term); M.form = FM[M.kind]; MD = M.data; MLOCK = !!MD.submitted;
  showMine();
}
// validation preview (preview.html): any of the seven forms, filled in this browser only – nothing is saved or sent
function openPreview(kind) { M = { kind, term: '', form: FM[kind] }; MD = {}; MLOCK = false; showMine(); }
function showMine() {
  for (const k of ['p1', 'ind', 'tables', 'self']) MD[k] = MD[k] || {};
  const f = M.form, period = PREVIEW || M.term === 'year' ? 'Academic year appraisal form' : TERM[M.term];
  app.innerHTML = (PREVIEW ? '' : userline()) + `<div class="bar"><button class="alt" data-go="${PREVIEW ? '#' : '#t=my'}">← ${PREVIEW ? 'All forms' : 'Home'}</button><b>${esc(f.title)}</b><span class="mute">${esc(period)} · ${C.YEAR_FULL}</span>
      <div class="sp"><span id="tot"></span><span class="mute" id="saved">${PREVIEW ? 'Preview – not saved' : MLOCK ? 'Submitted' : 'All changes saved'}</span>${MLOCK ? '' : PREVIEW ? '<button data-submit>Check form</button>' : '<button class="alt" data-save>Save</button><button data-submit>Submit</button>'}</div></div>
    ${PREVIEW ? '<div class="note"><b>Preview for validation.</b> Type figures and choose files to see how the marks are calculated. Nothing you type or choose is saved or sent; it is cleared when you leave this form.</div>' : ''}
    <div class="card todo" id="todo"></div>
    ${f.intro ? `<div class="note">${esc(f.intro)}</div>` : ''}
    <div class="card" id="part1"><h3>Part I – Details</h3><div class="grid" style="margin-top:20px">${f.p1.map(p1Field).join('')}</div></div>
    <h2>Part II – Scoring sheet</h2>
    ${Object.keys(f.domains).map(k => `<h2 style="font-size:16px">${k}. ${esc(f.domains[k])}</h2>` + f.ind.filter(i => i.domain === k).map(i => `<div class="card" id="ind-${i.code}"></div>`).join('')).join('')}
    <div class="card"><h3>Score summary</h3><div id="sum" style="margin-top:12px"></div></div>
    ${(f.tables || []).map(tb => `<div class="card" id="tb-${tb.id}"></div>`).join('')}
    ${f.selfReview ? `<div class="card" id="selfreview"><h3>Self-review</h3>${f.selfReview.map(([k, l]) => `<label for="sr-${k}">${esc(l)}${star()}</label><textarea id="sr-${k}" rows="3" data-self="${k}">${esc(MD.self[k])}</textarea>`).join('')}</div>` : ''}
    ${f.notes ? card('Notes', `<ul class="lines">${f.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`) : ''}
    <div class="card" id="declaration"><h3>Declaration</h3>
      <label style="line-height:1.4;margin-top:12px"><input type="checkbox" id="decl" ${MD.declared ? 'checked' : ''}> ${esc(f.declaration)}${star()}</label>
      <p class="mute">After you submit, it is locked and goes to the ${REVIEWER[M.kind]} for review. The reviewer's marks and remarks are not shown here.</p>
      ${MLOCK ? '' : `<hr class="sep"><div class="actions"><button data-submit>${PREVIEW ? 'Check form' : 'Submit'}</button></div>`}</div>
    <div class="card"><h3>Proof index</h3><div id="pidx" style="margin-top:12px"></div></div>`;
  f.ind.forEach(renderMine); (f.tables || []).forEach(renderTable);
  app.oninput = mineInput; app.onchange = mineChange; app.onclick = mineClick;
  mineRefresh();
  if (MLOCK) app.querySelectorAll('input, select, textarea').forEach(e => { e.disabled = true; });
}
// A section = its rule, the self-rating (where the form has one), rows of fields with a proof each, then the calculated marks.
function renderMine(ind) {
  const d = MD.ind[ind.code] = MD.ind[ind.code] || {}, el = $('#ind-' + ind.code), gone = !!d.removed; d.rows = d.rows || [];
  if (!gone) for (const g of ind.groups) if (!d.rows.some(r => (r.g || ind.groups[0].id) === g.id)) d.rows.push({ g: g.id, v: {} });
  const refOf = new Map(C.proofs(MD, M.form.ind).map(p => [p.e, p.ref]));
  const head = `<div class="sechead"><h3>${ind.code} · ${esc(ind.title)} ${gone || M.form.optional ? '' : '<span class="req">*</span> '}<span class="mute">(Max ${ind.max})</span></h3>${gone || MLOCK ? '' : `<button class="del" data-rmsec="${ind.code}" title="Nothing to claim in this section? Remove it (0 marks)">Remove section</button>`}</div>`;
  const marks = `<div class="marks"><span>Self marks (calculated): <b id="mk-${ind.code}"></b> / ${ind.max}</span><span class="warn" id="w-${ind.code}"></span></div>`;
  if (gone) { el.innerHTML = `${head}<div class="note removed"><b>This section is removed.</b> Nothing to claim here: 0 marks, nothing compulsory. ${MLOCK ? '' : `<button class="alt" data-addsec="${ind.code}">Add this section back</button>`}</div>${marks}`; return; }
  const row = (r, i, g) => {
    const file = r.file ? `<a href="${r.file.url || mUrl() + '/file/' + encodeURIComponent(r.file.stored)}" target="_blank" rel="noopener">${esc(r.file.name)}</a>${MLOCK ? '' : ` <button class="del" data-rmfile="${ind.code}.${i}" title="Remove the file">✕</button>`}`
      : MLOCK ? '<span class="mute">No proof</span>' : `<input type="file" accept=".pdf,.jpg,.jpeg,.png" data-up="${ind.code}.${i}">`;
    return `<div class="entry"><span class="ref">${refOf.get(r) || '–'}</span>
      <div class="fields">${g.fields.map(x => `<div class="fld ${x.type === 'period' || x.k === 'details' || x.k === 'item' ? 'wide' : ''}"><label>${esc(x.label)}${star()}</label>${inputFor(x, ind.code, i, (r.v || {})[x.k] || '')}</div>`).join('')}</div>
      <div class="fileCell">${file}</div>${g.single || MLOCK ? '<span></span>' : `<button class="del" data-rm="${ind.code}.${i}" title="Remove this row">Remove</button>`}</div>`;
  };
  const groups = ind.groups.map(g => `${g.label ? `<p class="glabel">${esc(g.label)}</p>` : ''}${d.rows.map((r, i) => ((r.g || ind.groups[0].id) === g.id ? row(r, i, g) : '')).join('')}
    ${g.single || MLOCK ? '' : `<p><button class="alt" data-add="${ind.code}.${g.id}">+ Add another</button></p>`}`).join('');
  const pick = ind.pick ? `<div class="fld" style="max-width:520px"><label>${esc(ind.pick.label)}${star()}</label><select data-pick="${ind.code}"><option value="">Select…</option>${ind.pick.options.map(o => `<option ${o.l === d.pick ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>` : '';
  el.innerHTML = `${head}<div class="rule"><b>Counted:</b> ${esc(ind.count)}<br><b>Marks:</b> ${esc(ind.rule)}<br><b>Proof:</b> ${esc(ind.proof)}</div>${pick}${groups}
    ${MLOCK ? '' : `<p class="mute">Attach each proof as PDF, JPG or PNG, max ${C.maxMB(ind)} MB per file.</p>`}${marks}`;
}
function renderTable(tb) {
  const rows = MD.tables[tb.id] = MD.tables[tb.id] || []; if (!rows.length && !MLOCK) rows.push({});
  $('#tb-' + tb.id).innerHTML = `<h3>${esc(tb.title)}</h3><div class="scroll" style="margin-top:12px"><table class="grid-t"><tr>${tb.columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th></th></tr>
    ${rows.map((r, i) => `<tr>${tb.columns.map(([k, l]) => `<td><input data-tc="${tb.id}.${i}.${k}" aria-label="${esc(l)}" value="${esc(r[k])}"></td>`).join('')}<td>${MLOCK ? '' : `<button class="del" data-trm="${tb.id}.${i}" title="Remove this row">✕</button>`}</td></tr>`).join('')}
    ${tb.total ? `<tr><th>Total</th>${tb.columns.slice(1).map(([k]) => `<th id="tt-${tb.id}-${k}"></th>`).join('')}<th></th></tr>` : ''}</table></div>
    ${MLOCK ? '' : `<p><button class="alt" data-tadd="${tb.id}">+ Add row</button></p>`}`;
  tableTotals(tb);
}
function tableTotals(tb) {
  if (tb.total) for (const [k] of tb.columns.slice(1)) {
    const v = MD.tables[tb.id].map(r => parseFloat(r[k])).filter(isFinite);
    $(`#tt-${tb.id}-${k}`).textContent = NO_SUM.test(k) || !v.length ? '' : r1(v.reduce((a, b) => a + b, 0));
  }
}
function mineRefresh() {
  const f = M.form, t = C.totals(MD, f.ind);
  f.ind.forEach(i => { const s = C.score(i, MD.ind[i.code]); $('#mk-' + i.code).textContent = s.marks; $('#w-' + i.code).textContent = s.warn; });
  $('#tot').innerHTML = `Total <b>${r1(t.self)}</b>/100`;
  $('#sum').innerHTML = `<table><tr><th>Domain</th><th>Max</th><th>Self marks</th></tr>${Object.keys(f.domains).map(k => `<tr><td>${k}. ${esc(f.domains[k])}</td><td>${t.dom[k].max}</td><td>${r1(t.dom[k].self)}</td></tr>`).join('')}<tr><th>TOTAL</th><th>100</th><th>${r1(t.self)}</th></tr></table>`;
  const todo = $('#todo');
  if (MLOCK) {
    const again = f.reopen && M.status !== 'finalised';   // the HoD can take it back until the reviewer finalises it
    todo.classList.add('ok');
    todo.innerHTML = `<b>Submitted on ${esc(C.when(MD.submitted.at))}.</b> <span class="mute">It is with the ${REVIEWER[M.kind]} for review. ${again
      ? 'To change something, click Edit again: everything you saved stays, and you submit it again when you are done.'
      : M.status === 'finalised' ? 'It has been finalised; to correct something, ask the Super Admin to reopen it.' : 'To correct something, ask the Super Admin to reopen it.'}</span>${again ? ' <button class="alt" data-again>Edit again</button>' : ''}`;
  }
  else {
    const pr = C.problemsFor(f, MD), open = !!(todo.querySelector('details') || {}).open;
    todo.classList.toggle('ok', !pr.length);
    todo.innerHTML = pr.length ? `<details ${open ? 'open' : ''}><summary><b>${pr.length} item${pr.length > 1 ? 's' : ''} still to fill</b> <span class="mute">– everything marked <span class="req">*</span> is compulsory before you can submit</span></summary><ul>${pr.map(p => `<li><a href="#" data-goto="${p.id}">${esc(p.text)}</a></li>`).join('')}</ul></details>`
      : f.optional ? '<b>Nothing is compulsory.</b> <span class="mute">Fill in what applies to you; a section left empty gets 0 marks. You can submit any time.</span>'
      : '<b>Everything is filled in.</b> <span class="mute">You can submit.</span>';
  }
  const pl = C.proofs(MD, f.ind);
  $('#pidx').innerHTML = pl.length ? `<table><tr><th>Proof ref. no.</th><th>Sub-indicator</th><th>Description of proof</th><th>File</th></tr>${pl.map(p => `<tr><td class="ref">${p.ref}</td><td>${p.code}</td><td>${esc(p.desc)}</td><td>${esc(p.e.file.name)}</td></tr>`).join('')}</table>`
    : '<p class="mute">Attached proofs appear here, numbered automatically (A1-01, A1-02, B1-01 …).</p>';
}
function splitPeriod(old, n, v) { const [a = '', b = ''] = String(old || '').split(/\s+to\s*/i), x = n === '0' ? v : a, y = n === '1' ? v : b; return x || y ? `${x} to ${y}`.trimEnd() : ''; }
function mineInput(ev) {
  if (MLOCK) return;
  const t = ev.target, ds = t.dataset;
  if ('date' in ds || ds.pp || ds.fp) t.value = maskDate(t.value);
  if (ds.p1) MD.p1[ds.p1] = t.value;
  else if (ds.pp) { const [k, n] = ds.pp.split('.'); MD.p1[k] = splitPeriod(MD.p1[k], n, t.value); }
  else if (ds.f) { const [c, i, k] = ds.f.split('.'), r = MD.ind[c].rows[i]; r.v = r.v || {}; r.v[k] = t.value; }
  else if (ds.fp) { const [c, i, k, n] = ds.fp.split('.'), r = MD.ind[c].rows[i]; r.v = r.v || {}; r.v[k] = splitPeriod(r.v[k], n, t.value); }
  else if (ds.pick) MD.ind[ds.pick].pick = t.value;
  else if (ds.self) MD.self[ds.self] = t.value;
  else if (ds.tc) { const [id, i, k] = ds.tc.split('.'); MD.tables[id][i][k] = t.value; tableTotals(tbOf(id)); }
  else return;
  mineRefresh(); queueMine();
}
async function mineChange(ev) {
  if (MLOCK) return;
  const t = ev.target, ds = t.dataset;
  if (t.id === 'decl') { MD.declared = t.checked; mineRefresh(); return queueMine(); }
  if (!ds.up || !t.files[0]) return;
  const [c, i] = ds.up.split('.'), ind = indOf(c), lim = C.maxMB(ind);
  if (t.files[0].size > lim * 1048576) { alert(`"${t.files[0].name}" is ${(t.files[0].size / 1048576).toFixed(1)} MB. Files in ${c} can be at most ${lim} MB.`); t.value = ''; return; }
  if (PREVIEW) { MD.ind[c].rows[i].file = { name: t.files[0].name, stored: t.files[0].name, url: URL.createObjectURL(t.files[0]) }; renderMine(ind); return mineRefresh(); }   // kept in this browser only
  const fd = new FormData(); fd.append('code', c); fd.append('file', t.files[0]);   // the section code goes first so the server knows the limit
  try { MD.ind[c].rows[i].file = await api(mUrl() + '/upload', { method: 'POST', body: fd }); renderMine(ind); mineRefresh(); queueMine(); }
  catch (e) { fail(e); t.value = ''; }
}
function mineClick(ev) {
  const el = ev.target.closest('button, a'); if (!el) return; const ds = el.dataset;
  if (ds.goto) { ev.preventDefault(); document.getElementById(ds.goto)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if ('save' in ds) return saveMine().catch(() => {});
  if ('submit' in ds) return submitMine();
  if ('again' in ds) return editAgain().catch(fail);
  if (MLOCK) return;
  if (ds.add) { const [c, g] = ds.add.split('.'); MD.ind[c].rows.push({ g, v: {} }); renderMine(indOf(c)); }
  else if (ds.rm) { const [c, i] = ds.rm.split('.'); if (C.started(MD.ind[c].rows[i]) && !confirm('Remove this row? Proof numbers will be renumbered.')) return; MD.ind[c].rows.splice(i, 1); renderMine(indOf(c)); }
  else if (ds.rmfile) { const [c, i] = ds.rmfile.split('.'); delete MD.ind[c].rows[i].file; renderMine(indOf(c)); }
  else if (ds.rmsec) { const ind = indOf(ds.rmsec); if (!confirm(`Remove section ${ind.code} (${ind.title})?\n\nIt will count as 0 marks and nothing in it will be compulsory. You can add it back any time before you submit.`)) return; MD.ind[ind.code].removed = true; renderMine(ind); }
  else if (ds.addsec) { delete MD.ind[ds.addsec].removed; renderMine(indOf(ds.addsec)); }
  else if (ds.tadd) { MD.tables[ds.tadd].push({}); renderTable(tbOf(ds.tadd)); }
  else if (ds.trm) { const [id, i] = ds.trm.split('.'); MD.tables[id].splice(i, 1); renderTable(tbOf(id)); }
  else return;
  mineRefresh(); queueMine();
}
function queueMine() { if (MLOCK || PREVIEW) return; pending = true; $('#saved').textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(() => saveMine().catch(() => {}), 600); }
let saving = Promise.resolve();   // one save at a time: autosave and the Save button never overlap; each sends the form as it is then
function saveMine() {
  clearTimeout(timer); const s = () => $('#saved') || {}, url = mUrl();
  return saving = saving.catch(() => {}).then(async () => {
    try {
      await api(url, { method: 'PUT', body: { p1: MD.p1, ind: MD.ind, tables: MD.tables, self: MD.self, declared: MD.declared } });
      pending = false; s().textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { s().textContent = 'Not saved: ' + e.message; throw e; }
  });
}
// Edit again (the HoD's own form): back to editable with everything saved; submitted again when done
async function editAgain() {
  if (!confirm(`Edit your submitted appraisal again?\n\nEverything you saved stays. It goes back to "being filled" and the ${REVIEWER[M.kind]} sees it again only after you submit it again.`)) return;
  await api(mUrl() + '/reopen', { method: 'POST' }); await openMine(M.term); scrollTo(0, 0);
}
async function submitMine() {
  const miss = C.problemsFor(M.form, MD);
  if (miss.length) {
    const dd = $('#todo details'); if (dd) dd.open = true;
    document.getElementById(miss[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return alert(`Everything marked * is compulsory. Still to fill (${miss.length}):\n• ` + miss.slice(0, 8).map(m => m.text).join('\n• ') + (miss.length > 8 ? `\n…and ${miss.length - 8} more (see the list at the top of the page)` : ''));
  }
  if (PREVIEW) return alert(`Everything is filled in. Total: ${r1(C.totals(MD, M.form.ind).self)} / 100.\n\nThis is a preview: nothing is submitted or saved.`);
  if (!confirm(`Submit your appraisal (${TERM[M.term]})?\n\nAfter you submit, it is locked and goes to the ${REVIEWER[M.kind]} for review.`)) return;
  const btns = [...app.querySelectorAll('[data-submit]')]; btns.forEach(b => { b.disabled = true; b.textContent = 'Submitting…'; });
  try { await saveMine(); await api(mUrl() + '/submit', { method: 'POST' }); await openMine(M.term); scrollTo(0, 0); }
  catch (e) { fail(e); btns.forEach(b => { b.disabled = false; b.textContent = 'Submit'; }); }
}

/* ---------- validation preview: the list of the seven forms (preview.html; remove after the forms are validated) ---------- */
function previewHome() {
  app.onclick = app.oninput = app.onchange = null;
  app.innerHTML = card('Appraisal forms for validation', `<p class="sub">Academic year ${C.YEAR_FULL}. Open a form to check its sections, the marks rules and the calculated marks.
    You can type figures and choose files to try it out; nothing is saved or sent.</p>`)
    + ['hod', 'vp', 'principal', 'po', 'pc', 'librarian', 'pd'].map(k => { const f = FM[k]; return `<div class="card"><div class="sechead"><div>
      <h3>${esc(k === 'hod' ? 'Head of the Department (HoD)' : C.ROLES[k])}</h3>
      <p class="sub">${esc(f.title)} · ${f.period === 'semester' ? 'one form per semester' : 'one form per year'} · reviewed by the ${REVIEWER[k]}</p>
      <p class="sub">${Object.keys(f.domains).map(d => `${d}. ${esc(f.domains[d])} (${f.ind.filter(i => i.domain === d).reduce((s, i) => s + i.max, 0)})`).join(' · ')}</p></div>
      <button data-go="#f=${k}">Open form</button></div></div>`; }).join('');
}

/* ---------- routing ---------- */
async function route() {
  if (PREVIEW) { const k = new URLSearchParams(location.hash.slice(1)).get('f'); scrollTo(0, 0); return FM[k] ? openPreview(k) : previewHome(); }
  if (pending) await saveMine().catch(() => {});
  DIRTY = false;
  try {
    ME = ME || await api('/api/me');
    const p = new URLSearchParams(location.hash.slice(1));
    if (ME.mustChange || p.has('pw')) passwordPage(ME.mustChange);
    else if (p.has('r')) await openReview(Number(p.get('r')));
    else if (p.has('rep')) await reportPage(p.get('rep'), p.get('d') || '', p.get('s'));
    else if (p.has('m') && FM[ME.role]) await openMine(p.get('m'));
    else await home(p.get('t'), p.get('d'));
  } catch (e) {
    if (e.quiet) return;
    app.onclick = app.oninput = app.onchange = null;
    app.innerHTML = (ME ? userline() : '') + `<div class="card"><h3>Could not open this page</h3><p class="warn" style="margin-top:8px">${esc(e.message)}</p><hr class="sep"><div class="actions"><button class="alt" data-go="#">← Home</button></div></div>`;
  }
}
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-go]');
  if (g) { if (DIRTY && !confirm('Your changes are not saved. Leave anyway?')) return; DIRTY = false; return go(g.dataset.go); }
  if (!e.target.closest('[data-logout]')) return;
  if (pending) await saveMine().catch(() => {});
  if (DIRTY && !confirm('Your changes are not saved. Log out anyway?')) return;
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  ME = null; DIRTY = false; history.replaceState(null, '', location.pathname); loginPage();
});
addEventListener('hashchange', route);
addEventListener('beforeunload', e => { if (pending || DIRTY) { e.preventDefault(); e.returnValue = ''; } });
route();
