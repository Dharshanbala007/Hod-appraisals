// Scoring rules + end-to-end test on a temp UPLOADS folder, a pretend staff-site UPLOADS folder and an empty test database (nscet_appraisal_test,
// created and dropped here): logins -> staff appraisals read from the staff folder -> review chain -> own appraisals. Run: node test.js
const assert = require('assert'), { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), C = require('./public/config.js');
const I = c => C.IND.find(i => i.code === c), pf = { stored: 'x' };
// rows(code, [values...], {first row gets a proof, ...extra section data}) -> marks
const marks = (code, vals, extra = {}) => { const d = { rows: vals.map(v => ({ g: v.g, v: v.v || v })), ...extra }; d.rows[0].file = pf; for (const r of d.rows) if (r.g === undefined) delete r.g; return C.score(I(code), d).marks; };
const T = { Q2: 'Scopus / WoS journal – Q2 (4 points)', Q3: 'Scopus / WoS journal – Q3 (3 points)', Q4: 'Scopus / WoS journal – Q4 (2 points)', CONF: 'Scopus / WoS conference paper or book chapter (2 points)', UGC: 'UGC-CARE journal (1 point)' };
const paper = 'Papers considered strictly, papers published along with UG/PG students considered (1 point)';

// A1: the AVERAGE of all subjects decides the marks (not any single subject), rounded to a whole number
const a1 = (...p) => p.map((x, i) => ({ subject: 'S' + i, session: i % 2 ? 'APR/MAY' : 'NOV/DEC', pct: String(x) }));
assert.equal(marks('A1', a1(100, 90, 80)), 20);          // average 90
assert.equal(marks('A1', a1(95, 40)), 10);               // average 67.5 -> 68, even though one subject is 95
assert.equal(marks('A1', a1(88, 86)), 15);               // 87
assert.equal(marks('A1', a1(82)), 14); assert.equal(marks('A1', a1(75)), 12); assert.equal(marks('A1', a1(56)), 8); assert.equal(marks('A1', a1(54)), 0);
assert.equal(marks('A1', [{ subject: 'S', session: '', pct: '95' }]), 0);          // incomplete row (no session) is not counted
assert.equal(C.score(I('A1'), { rows: a1(95) }).marks, 0);                          // no proof = 0
// A2: only when the answer is Yes; marks by the number of activities
const act = n => Array.from({ length: n }, () => ({ activity: 'x', subject: 'CS3591 – V CSE', students: '30' }));
assert.equal(marks('A2', act(3), { gate: 'Yes' }), 8); assert.equal(marks('A2', act(5), { gate: 'Yes' }), 10); assert.equal(marks('A2', act(3), { gate: 'No' }), 0); assert.equal(marks('A2', act(1), { gate: 'Yes' }), 3);
// B1 = publications and patents (up to 15) + research guidance (up to 5) added together: 20 marks
const bp = t => ({ title: 't', journal: 'j', type: t });                                                               // a publications row
const gd = (t, n) => Array.from({ length: n }, () => ({ g: 'guide', v: { type: t, name: 'n', sem: 'Odd' } }));        // research-guidance rows
assert.equal(marks('B1', [bp(T.Q2), bp(T.CONF), bp(T.UGC)]), 15);                    // 7 points -> 15
assert.equal(marks('B1', [bp(T.Q3)]), 11); assert.equal(marks('B1', [bp(T.Q4)]), 9); assert.equal(marks('B1', [bp(T.Q3), bp(T.Q3), bp(T.Q3)]), 15);
// guidance: PhD 4, scholar 2, papers 1 each but the papers count up to 4; this part is worth at most 5
assert.deepEqual([1, 2, 3, 4, 6].map(n => marks('B1', [bp(T.Q4), ...gd(paper, n)]) - 9), [1, 2, 3, 4, 4]);                // 9 = the publications part (one Q4 paper)
assert.equal(marks('B1', [bp(T.Q4), ...gd('PhD awarded (4 points)', 1), ...gd(paper, 6)]), 9 + 5);
assert.equal(marks('B1', [bp(T.Q2), bp(T.CONF), bp(T.UGC), ...gd('PhD scholar registered under you (2 points)', 1), ...gd(paper, 3)]), 20);   // 15 + 5 = the section maximum
assert.equal(marks('B1', [...gd(paper, 2)]), 2);                                                                        // guidance alone still scores
// C1 days; C2 = online courses (points, up to 5) + technical certification (best level, up to 5), added and capped at 8
assert.equal(marks('C1', [{ name: 'a', course: 'b', duration: '2', date: '01-07-2025 to 01-07-2025' }, { name: 'a', course: 'b', duration: '3', date: '01-07-2025 to 01-07-2025' }]), 5);
const oc = t => ({ name: 'a', course: 'b', duration: '12 weeks', date: '01-07-2025 to 01-07-2025', type: t });
const tc = t => ({ g: 'tech', v: { name: 'a', course: 'b', duration: '1 day', date: '01-07-2025 to 01-07-2025', type: t } });
assert.equal(marks('C2', [oc('Proctored (2 points)'), oc('Proctored (2 points)'), oc('Non-proctored (1 point)')]), 5);             // online part alone
assert.equal(marks('C2', [oc('Non-proctored (1 point)'), tc('Associate (4)'), tc('Fundamentals (3)')]), 1 + 4);                       // 1 + best level 4
assert.equal(marks('C2', [oc('Proctored (2 points)'), oc('Proctored (2 points)'), oc('Non-proctored (1 point)'), tc('Associate (4)')]), 8);   // 5 + 4 = 9, capped at 8
// D1 status, D2 points, E1..E4
assert.equal(marks('D1', [{}], { pick: 'Consultancy or industry-sponsored work completed' }), 7);
assert.equal(marks('D1', [{}], { pick: 'Internal college projects (TMHNU-NSCET)' }), 5);                       // new option
assert.equal(C.score(I('D1'), { pick: 'Co-PI of a sanctioned external project', rows: [] }).marks, 0);            // no proof
const d2 = t => ({ project: 'p', industry: 'i', period: '1-06-2025 to 1-07-2025', type: t });
assert.equal(marks('D2', [d2('MoU activity (2 points)'), d2('Internship batch arranged (2 points)'), d2('Industry visit or industry expert talk organised (1 point)')]), 6);     // 5 points
const adm = { student: 's', dept: 'd', reg: 'r', centre: 'c' };
assert.equal(marks('E1', [adm, adm]), 4); assert.equal(marks('E1', [adm, adm, adm]), 5);
assert.equal(marks('E2', [{ g: 'placed', v: { student: 'a' } }, { g: 'placed', v: { student: 'b' } }, { g: 'lead', v: { company: 'Zoho' } }]), 4);      // 2 + 2 + 1 points
assert.equal(marks('E3', [{ type: 'Cell activity – coordinator (2 points)', date: '20-08-2025 to 20-08-2025' }, { type: 'College activity – support role (1 point)', date: '01-09-2025 to 01-09-2025' }]), 3);
assert.equal(marks('E4', [{ topic: 't', org: 'o', date: '14-10-2025 to 14-10-2025' }, { topic: 't2', org: 'o2', date: '15-10-2025 to 15-10-2025' }]), 4);        // 2 entries = 4 points = 4 marks
const e4 = n => Array.from({ length: n }, (_, i) => ({ topic: 't' + i, org: 'o', date: '15-10-2025 to 15-10-2025' }));
assert.deepEqual([1, 2, 3, 4].map(n => marks('E4', e4(n))), [2, 4, 5, 5]);                                                        // E4 maximum is 5
assert.equal(marks('E4', [{ topic: 't', org: '', date: '2026-10-14' }]), 0);                                             // incomplete row
assert.ok(C.IND.some(i => i.code === 'A2' && i.title === 'Proactive initiatives') && !C.IND.some(i => i.code === 'A3'));   // proactive initiatives is now A2
assert.equal(C.normPeriod('1-12-2025 to 1-01-2026'), '01-12-2025 to 01-01-2026'); assert.ok(C.isPeriod('1-12-2025 to 1-01-2026')); assert.ok(C.isPeriod('5-5-2025 to 5-5-2025'));
// compulsory fields: an empty form lists everything; answering "No" to A2 makes A2 complete; every section, Part I, Part III and the declaration are covered
assert.deepEqual(C.DEPARTMENTS, ['CSE', 'AI&DS', 'IT', 'EEE', 'ECE', 'MECH', 'CIVIL', 'S&H']); assert.equal(C.deptOf(' mech '), 'MECH'); assert.equal(C.deptOf('s&h'), 'S&H'); assert.equal(C.deptOf('Computer Science'), '');
assert.ok(C.problems({ p1: { name: 'a', designation: 'b', dept: 'Physics', courses: 'c', workload: '1', duties: 'd' } }).some(x => x.text === 'Part I – Department'));   // not a listed department
{ // "Remove section": the faculty has nothing to claim -> 0 marks, nothing compulsory, no entries, no proofs (whatever was typed before is ignored)
  const gone = { removed: true, gate: 'Yes', pick: 'x', rows: [{ v: { subject: 'x', session: 'NOV/DEC', pct: '99' }, file: pf }] };
  assert.deepEqual(C.score(I('A1'), gone), { marks: 0, avg: null, warn: '' }); assert.deepEqual(C.rowsOf(I('A1'), gone), []); assert.equal(C.proofs({ ind: { A1: gone } }).length, 0);
  assert.deepEqual(C.entryLines(I('A1'), gone, new Map()), ['Section removed by the faculty – nothing to claim here (0 marks)']);
  const left = C.problems({ ind: { A1: gone, A2: { removed: true }, B1: { removed: true }, D1: { removed: true } } }).map(x => x.id); for (const c of ['A1', 'A2', 'B1', 'D1']) assert.ok(!left.includes('ind-' + c)); assert.ok(left.includes('ind-C1')); }   // other sections are still compulsory
assert.ok(C.problems({}).length >= 30); assert.ok(C.problems({}).some(x => x.id === 'part5') && C.problems({}).filter(x => x.id === 'part3').length === 2 && C.IND.every(i => C.problems({}).some(x => x.id === 'ind-' + i.code)));
assert.ok(!C.problems({ ind: { A2: { gate: 'No' } } }).some(x => x.id === 'ind-A2'));
assert.ok(C.problems({ ind: { A2: { gate: 'Yes', rows: [{ v: { activity: 'x', subject: 'y', students: '' } }] } } }).some(x => /empty or invalid/.test(x.text)));   // half-filled row
assert.ok(!C.isPeriod('1-01-2026 to 1-12-2025')); assert.ok(!C.isPeriod('31-02-2025 to 1-03-2025')); assert.ok(!C.isPeriod('1-12-2025')); assert.ok(!C.isPeriod('1-12-25 to 2-12-25'));      // end before start, impossible date, one date only, 2-digit year
assert.equal(marks('E4', [{ topic: 't', org: 'o', date: '01-12-2025' }]), 0);                                              // a single date is not a period -> row not counted
assert.equal(marks('E4', [{ topic: 't', org: 'o', date: '2-12-2025 to 1-12-2025' }]), 0);                                 // end before start -> not counted
assert.ok(C.IND.find(i => i.code === 'C2').note.some(n => /proctored/i.test(n[0])) && C.IND.find(i => i.code === 'C2').title === 'NPTEL / SWAYAM / Online Academic Certifications/Technical certifications');                                       // C2 explains proctored / non-proctored
assert.equal(C.IND.reduce((s, i) => s + i.max, 0), 100);
assert.deepEqual(Object.fromEntries(C.IND.map(i => [i.code, i.max])), { A1: 20, A2: 10, B1: 20, C1: 5, C2: 8, D1: 10, D2: 10, E1: 5, E2: 4, E3: 3, E4: 5 });   // B2 and C3 are merged away
assert.ok(!JSON.stringify(C.IND).includes('claimed only in'));                       // wording removed

// ---- marks at each level (self > HoD > Principal > Secretary) and the deviation between the given and the edited marks
{ const d = { ind: {}, hod: { ind: { A1: { marks: 12, remark: 'one course only' }, E4: { marks: 5 }, B1: { marks: 0 }, C1: { marks: 99 } } }, principal: { ind: { C2: { marks: 6 }, A1: { marks: 10 } } }, secretary: { ind: { A1: { marks: 11 } } } };
  const t = C.totals(d), v = C.deviation(d);
  assert.equal(t.rows.C1.hod, 5); assert.equal(t.rows.A1.final, 11);                                                       // capped at the section maximum; the latest level decides
  assert.deepEqual(t.after, { self: 0, hod: 22, vp: 22, principal: 26, secretary: 27 }); assert.equal(t.final, 27);
  assert.deepEqual(v.changes.map(c => [c.level, c.code, c.before, c.after, c.change]), [['hod', 'A1', 0, 12, 12], ['hod', 'C1', 0, 5, 5], ['hod', 'E4', 0, 5, 5], ['principal', 'A1', 12, 10, -2], ['principal', 'C2', 0, 6, 6], ['secretary', 'A1', 10, 11, 1]]);
  assert.equal(v.changes[0].remark, 'one course only');                                                                     // B1 0 -> 0 is not a change
  assert.deepEqual(v.levels, [{ level: 'hod', before: 0, after: 22, change: 22, sections: ['A1', 'C1', 'E4'] }, { level: 'principal', before: 22, after: 26, change: 4, sections: ['A1', 'C2'] }, { level: 'secretary', before: 26, after: 27, change: 1, sections: ['A1'] }]);
  assert.deepEqual(v.overall, { before: 0, after: 27, change: 27 }); assert.deepEqual(C.deviation({}).changes, []); }
// ---- the report's stronger / weaker sections: highest / lowest share of the section maximum in the final marks; all ties; none when all are equal
{ const half = Object.fromEntries(C.IND.map(i => [i.code, { final: i.max / 2 }])), sw = rows => { const s = C.strengths(rows); return [s.strong.map(x => x.code), s.weak.map(x => x.code)]; };
  assert.deepEqual(sw({ ...half, A1: { final: 20 }, D1: { final: 0 } }), [['A1'], ['D1']]);                          // 20/20 strongest, 0/10 weakest
  assert.deepEqual(sw({ ...half, C1: { final: 5 }, E3: { final: 3 }, B1: { final: 0 }, E2: { final: 0 } }), [['C1', 'E3'], ['B1', 'E2']]);   // ties all listed
  assert.deepEqual(sw({ ...half, A1: { final: 18 } }), [['A1'], C.IND.filter(i => i.code !== 'A1').map(i => i.code)]);   // the share counts, not the marks
  assert.deepEqual(sw(half), [[], []]);                                                                              // all equal: neither
  const top = C.strengths({ ...half, A1: { final: 20 } }).strong[0]; assert.deepEqual([top.code, top.title, top.marks, top.max], ['A1', I('A1').title, 20, 20]); }

// ---- who may see or edit which appraisal (the permission table of the architecture)
{ const A = require('./auth.js'), u = (role, dept) => ({ role, dept, username: role }), ap = (kind, status, dept = 'CSE') => ({ kind, status, dept });
  const hod = u('hod', 'CSE'), otherHod = u('hod', 'IT'), vp = u('vp'), pr = u('principal'), sec = u('secretary');
  assert.ok(A.can(hod, 'view', ap('staff', 'submitted')) && A.can(hod, 'edit', ap('staff', 'submitted')) && A.can(hod, 'proceed', ap('staff', 'submitted')));
  assert.ok(A.can(hod, 'view', ap('staff', 'proceeded')) && !A.can(hod, 'edit', ap('staff', 'proceeded')));                // after Proceed: view only
  assert.ok(!A.can(otherHod, 'view', ap('staff', 'submitted')) && !A.can(hod, 'view', ap('staff', 'draft')) && !A.can(hod, 'view', ap('hod', 'submitted')));   // other department, drafts, other HoDs
  for (const who of [vp, pr]) {                                                                                            // the Vice Principal works like the Principal
    assert.ok(A.can(who, 'view', ap('staff', 'submitted')) && !A.can(who, 'edit', ap('staff', 'submitted')) && A.can(who, 'edit', ap('staff', 'proceeded')) && A.can(who, 'finalise', ap('staff', 'proceeded')) && !A.can(who, 'edit', ap('staff', 'finalised')));
    assert.ok(['hod', 'po', 'pc', 'librarian', 'pd'].every(k => A.can(who, 'view', ap(k, 'submitted')) && A.can(who, 'edit', ap(k, 'submitted')) && A.can(who, 'finalise', ap(k, 'submitted')) && !A.can(who, 'edit', ap(k, 'finalised'))));
    assert.ok(!A.can(who, 'view', ap('principal', 'submitted')) && !A.can(who, 'view', ap('hod', 'draft')));
  }
  assert.ok(A.can(pr, 'edit', ap('vp', 'submitted')) && A.can(pr, 'finalise', ap('vp', 'submitted')) && !A.can(vp, 'view', ap('vp', 'submitted')));   // only the Principal validates the VP's form
  assert.ok(['staff', 'hod', 'vp', 'principal', 'po', 'pc', 'librarian', 'pd'].every(k => A.can(sec, 'edit', ap(k, 'finalised')) && A.can(sec, 'view', ap(k, 'submitted'))) && !A.can(sec, 'finalise', ap('staff', 'proceeded')) && !A.can(sec, 'view', ap('staff', 'draft')));
  assert.ok(['po', 'pc', 'librarian', 'pd'].every(r => !A.can(u(r), 'view', ap('staff', 'proceeded')) && !A.can(u(r), 'view', ap('hod', 'submitted'))));   // the new roles: their own appraisal only
  assert.deepEqual(['hod', 'vp', 'principal', 'secretary', 'po', 'librarian', 'admin'].map(A.levelOf), ['hod', 'vp', 'principal', 'secretary', null, null, null]);
  const adm = u('admin');                                                                                                       // the Super Admin: sees everything, drafts too, changes nothing
  assert.ok(C.KINDS.every(k => ['draft', 'submitted', 'proceeded', 'finalised'].every(st => A.can(adm, 'view', ap(k, st)) && !A.can(adm, 'edit', ap(k, st)) && !A.can(adm, 'proceed', ap(k, st)) && !A.can(adm, 'finalise', ap(k, st)))));
  for (let i = 0; i < 5; i++) A.failed('Someone'); assert.ok(A.locked('someone')); A.forgive('SOMEONE'); assert.ok(!A.locked('someone')); }   // 5 wrong passwords lock the username
// ---- the HoD, Vice Principal / Principal, Placement Officer, Placement Co-ordinator, Librarian and Physical Director forms (from the templates)
{ const { FORMS } = require('./public/forms.js');
  const weights = { hod: { A: 35, B: 20, C: 20, D: 15, E: 10 }, vp: { A: 30, B: 20, C: 20, D: 20, E: 10 }, principal: { A: 30, B: 20, C: 20, D: 20, E: 10 },
    po: { A: 35, B: 25, C: 15, D: 15, E: 10 }, pc: { A: 20, B: 30, C: 20, D: 15, E: 15 }, librarian: { A: 25, B: 25, C: 15, D: 20, E: 15 }, pd: { A: 25, B: 25, C: 20, D: 15, E: 15 } };
  for (const [kind, w] of Object.entries(weights)) {
    const f = FORMS[kind], dom = {}; for (const i of f.ind) dom[i.domain] = (dom[i.domain] || 0) + i.max;
    assert.deepEqual(dom, w, kind + ' domain weightage'); assert.equal(new Set(f.ind.map(i => i.code)).size, f.ind.length, kind + ' codes unique');
    assert.ok(f.ind.every(i => i.groups.length && i.rule && i.proof), kind + ' every indicator has its rule and proof');
  }
  assert.deepEqual([FORMS.hod.ind.length, FORMS.principal.ind.length, FORMS.po.ind.length, FORMS.pc.ind.length, FORMS.librarian.ind.length, FORMS.pd.ind.length], [14, 13, 13, 12, 14, 15]);
  const ix = (kind, code) => FORMS[kind].ind.find(i => i.code === code);
  const one = (kind, code, v, extra = {}, file = pf) => C.score(ix(kind, code), { rows: [{ v: { details: 'd', ...v }, ...(file ? { file } : {}) }], ...extra }).marks;
  // HoD: bands on the figure (percentages rounded to whole numbers), points added up
  assert.deepEqual([one('hod', 'A1', { value: '88' }), one('hod', 'A1', { value: '89.6' }), one('hod', 'A1', { value: '59' })], [9, 10, 0]);
  assert.deepEqual([one('hod', 'A3', { value: '100' }), one('hod', 'A3', { value: '99' }), one('hod', 'B1', { value: '2' }), one('hod', 'E2', { value: '7' })], [10, 8, 2, 5]);
  assert.equal(one('hod', 'A1', { value: '95' }, {}, null), 0);                                                              // a claim without proof gets 0
  // HoD C after validation: Accreditation readiness removed, its 8 marks shared 4 + 4: C1 Meetings and records 10, C2 Student mentoring 10
  assert.deepEqual(FORMS.hod.ind.filter(i => i.domain === 'C').map(i => [i.code, i.title, i.max]), [['C1', 'Meetings and records', 10], ['C2', 'Student mentoring', 10]]);
  assert.deepEqual(['100', '95', '85', '75', '55', '49'].map(v => one('hod', 'C1', { value: v })), [10, 8, 6, 4, 2, 0]); assert.equal(one('hod', 'C2', { value: '90' }), 8);
  assert.ok(!JSON.stringify(FORMS.hod).includes('Accreditation readiness') && !JSON.stringify(FORMS.hod).includes('C3'));
  // nothing compulsory in the HoD form: an empty one has nothing missing and scores 0 (the other forms still list what is missing)
  assert.deepEqual(C.problemsFor(FORMS.hod, {}), []); assert.equal(C.totals({ ind: {} }, FORMS.hod.ind).self, 0); assert.ok(C.problemsFor(FORMS.principal, {}).length > 10);
  const pts = (kind, code, types) => C.score(ix(kind, code), { rows: types.map((t, n) => ({ v: { type: ix(kind, code).groups[0].fields[0].options[t].l, item: 'x' }, ...(n ? {} : { file: pf }) })) }).marks;
  assert.deepEqual([pts('hod', 'B2', [0, 3]), pts('hod', 'D3', [0, 1, 2]), pts('hod', 'E1', [0, 0, 1])], [4, 2, 5]);                 // Q1 4 + UGC 1 -> 5 points -> 4 (max); 2+2+1 = 5 -> 2; 2+2+1 = 5 -> 5
  // Principal / VP: best status and amounts
  assert.equal(one('principal', 'B1', {}, { pick: 'SAR / SSR submitted' }), 10);
  assert.deepEqual([one('principal', 'C2', { value: '30' }), one('principal', 'C2', { value: '1.5' }), one('principal', 'C2', { value: '0' }), one('principal', 'C1', { value: '4.5' })], [6, 2, 0, 7]);
  // support staff: Max × (achieved ÷ target), capped at Max, one decimal; and the evidence levels 100 / 70 / 40 / 0 %
  assert.deepEqual([one('po', 'A1', { achieved: '72', target: '80' }), one('po', 'A1', { achieved: '90', target: '80' }), one('po', 'A1', { achieved: '5', target: '0' })], [13.5, 15, 0]);
  assert.deepEqual(ix('po', 'D3').pick.options.map(o => o.p), [3, 2.1, 1.2, 0]); assert.equal(one('po', 'B1', {}, { pick: ix('po', 'B1').pick.options[1].l }), 7);
  // what is still missing, the totals and the deviation work for these forms too
  const empty = C.problemsFor(FORMS.librarian, {}); assert.ok(empty.some(p => p.text === 'Part I – Highest Qualification') && empty.some(p => /^A1 /.test(p.text)) && empty.some(p => p.id === 'selfreview') && empty.some(p => p.id === 'declaration'));
  assert.ok(!empty.some(p => /Present Designation|Reporting Officer/.test(p.text)));                                            // fixed by the template, not typed
  const lib = { p1: { name: 'L', employee_id: 'E1', qualification: 'MLISc', dob: '01-01-1980', joining: '01-06-2010', mobile: '9', email: 'l@x', review_period: '01-06-2025 to 30-11-2025' }, declared: true,
    self: { achievements: 'a', improve: 'b', next_targets: 'c' }, ind: {} };
  for (const i of FORMS.librarian.ind) lib.ind[i.code] = i.pick ? { pick: i.pick.options[0].l, rows: [{ v: { details: 'd' }, file: pf }] } : { rows: [{ v: { achieved: '9', target: '10', details: 'd' }, file: pf }] };
  assert.deepEqual(C.problemsFor(FORMS.librarian, lib), []); assert.equal(C.totals(lib, FORMS.librarian.ind).self, 98);           // A1 9 of 10, B1 9 of 10, the rest full
  lib.principal = { ind: { A2: { marks: 5, remark: 'subscription proof partial' } } };
  assert.deepEqual(C.deviation(lib, FORMS.librarian.ind).levels, [{ level: 'principal', before: 98, after: 95, change: -3, sections: ['A2'] }]); }
async function authTests() {   // password hashing and the session cookie
  const A = require('./auth.js'), h = await A.hash('Secret@123');
  assert.match(h, /^scrypt\$/); assert.ok(!h.includes('Secret@123')); assert.ok(await A.check('Secret@123', h)); assert.ok(!(await A.check('secret@123', h))); assert.ok(!(await A.check('x', 'garbage')));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-')), S = A.sessions(dir); let cookie = '';
  S.start({ headers: {} }, { append: (n, v) => { cookie = v.split(';')[0]; } }, { username: 'hodcse', role: 'hod', dept: 'CSE' });
  assert.deepEqual(S.read({ headers: { cookie } }), { username: 'hodcse', role: 'hod', dept: 'CSE' });
  assert.equal(S.read({ headers: { cookie: cookie.slice(0, -2) + 'xx' } }), null); assert.equal(S.read({ headers: {} }), null);   // tampered / missing
  assert.deepEqual(A.sessions(dir).read({ headers: { cookie } }), { username: 'hodcse', role: 'hod', dept: 'CSE' });                // still valid after a restart (key kept in UPLOADS)
  fs.rmSync(dir, { recursive: true, force: true });
}

// an empty test database: a temporary database file, or – when DB_HOST is set in .env.local – the MySQL database nscet_appraisal_test
// (created and dropped here; that MySQL user needs rights on it)
require('./env.js'); process.env.DB_NAME = 'nscet_appraisal_test'; process.env.DB_FILE = path.join(os.tmpdir(), `appraisal-test-${process.pid}.sqlite`);
const store = require('./db.js');
const admin = () => require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const rmFile = () => { for (const x of ['', '-wal', '-shm']) fs.rmSync(process.env.DB_FILE + x, { force: true }); };
const freshDb = async () => { if (store.MYSQL) { const c = await admin(); await c.query('DROP DATABASE IF EXISTS nscet_appraisal_test'); await c.query('CREATE DATABASE nscet_appraisal_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); await c.end(); } else rmFile(); await store.setup(); };
const dropDb = async () => { await store.close(); if (store.MYSQL) { const c = await admin(); await c.query('DROP DATABASE IF EXISTS nscet_appraisal_test'); await c.end(); } else rmFile(); };
const B = 'http://localhost:3100', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-')), staffDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-uploads-'));
const boot = async () => { const p = spawn('node', ['server.js'], { env: { ...process.env, PORT: 3100, UPLOADS_DIR: tmp, STAFF_UPLOADS: staffDir }, stdio: 'ignore' }); for (let i = 0; i < 160; i++) { try { if ((await fetch(B + "/healthz")).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); } return p; };   // wait until it answers
const j = (u, o = {}) => { if (o.json) { o.body = JSON.stringify(o.json); o.headers = { ...o.headers, 'Content-Type': 'application/json' }; } return fetch(B + u, o); };
const pdf = Buffer.from('JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUi9TaXplIDQ+Pg==', 'base64');

// ---- the staff site's UPLOADS folder, as the staff site saves it: <Name> (<code>)/2025-26/form.json + proofs. This site only reads it.
const staffForm = (folder, data, proofs = []) => { const d = path.join(staffDir, folder, '2025-26'); fs.mkdirSync(d, { recursive: true }); for (const p of proofs) fs.writeFileSync(path.join(d, p), pdf); fs.writeFileSync(path.join(d, 'form.json'), JSON.stringify(data, null, 2)); };
const up = { stored: 'proof A1.pdf', name: 'proof A1.pdf', mime: 'application/pdf', pages: 1 }, at = { submitted: { at: '2026-10-28T06:00:00.000Z' }, recorded: true };
const sample = f => f.type === 'select' ? f.options[0].l : f.type === 'period' ? '01-06-2025 to 05-06-2025' : f.type === 'number' ? String(f.max ? Math.min(f.max, 88) : 10) : 'x';
const whole = { p1: { name: 'Dr. Test', designation: 'AP', dept: 'CSE', courses: 'CS3591', workload: '18', duties: 'None' }, declared: true, p3: { next: { dept: 'c', clg: 'd' } }, ind: {} };
for (const ind of C.IND) whole.ind[ind.code] = { ...(ind.gate ? { gate: 'Yes' } : {}), ...(ind.pick ? { pick: ind.pick.options[0].l } : {}),
  rows: ind.groups.map((g, gi) => ({ g: g.id, v: Object.fromEntries(g.fields.map(f => [f.k, sample(f)])), ...(gi === 0 ? { file: up } : {}) })) };
staffForm('Dr. Test Staff (T1)', { ...whole, ...at }, ['proof A1.pdf', 'Appraisal_T1_2025-26.pdf']);                                // submitted, CSE
staffForm('Dept Case (T2)', { p1: { name: 'Dept Case', designation: 'AP', dept: 'AI&DS' }, p3: { next: {} }, ind: {}, declared: false });   // still a draft, another department
staffForm('Legacy Staff (L1)', { p1: { name: 'Legacy Staff', designation: 'AP', dept: 'IT' }, p3: { next: {} }, ind: {}, declared: true, ...at });
fs.mkdirSync(path.join(staffDir, 'Broken Form (B9)', '2025-26'), { recursive: true }); fs.writeFileSync(path.join(staffDir, 'Broken Form (B9)', '2025-26', 'form.json'), '{"p1":{"na');   // being saved / broken
fs.mkdirSync(path.join(staffDir, 'Not started (N1)')); fs.mkdirSync(path.join(staffDir, 'no code here'));
// every file of the staff folder with its size, time and content: must be exactly the same after this site has used it
const snap = () => { const out = {}; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { out[p] = 'dir'; walk(p); } else { const s = fs.statSync(p); out[p] = `${s.size} ${s.mtimeMs} ${fs.readFileSync(p).toString('base64')}`; } } }; walk(staffDir); return out; };

(async () => {
  await authTests();
  assert.equal(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replace(/\r\n/g, '\n'),
    require('child_process').execFileSync('node', ['db-setup.js', '--sql'], { cwd: __dirname, encoding: 'utf8' }));   // schema.sql = the tables db.js makes
  { // a database made before the Super Admin (its accounts CHECK lacks 'admin', no must_change column): rebuilt on start, every login kept
    const f = path.join(os.tmpdir(), `old-accounts-${process.pid}.sqlite`), old = new (require('node:sqlite').DatabaseSync)(f);
    old.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('hod','vp','principal','secretary','po','pc','librarian','pd')),
      dept TEXT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO accounts (username, name, role, dept, password_hash) VALUES ('oldhod', 'Old HoD', 'hod', 'CSE', 'kept')`); old.close();
    const run = require('child_process').spawnSync('node', ['-e', `const db = require('./db.js'); db.setup().then(() => db.setup()).then(() => db.addAccount({ username: 'admin2', name: 'A', role: 'admin', passwordHash: 'h' }))
      .then(() => db.listAccounts()).then(async a => { console.log(JSON.stringify([a.map(x => x.username + ':' + x.role + ':' + x.must_change), (await db.findAccount('oldhod')).password_hash])); await db.close(); })`],
      { cwd: __dirname, env: { ...process.env, DB_HOST: '', DB_FILE: f }, encoding: 'utf8' });
    assert.equal(run.stdout.trim(), JSON.stringify([['admin2:admin:1', 'oldhod:hod:0'], 'kept'])); for (const x of ['', '-wal', '-shm']) fs.rmSync(f + x, { force: true }); }
  await freshDb();
  let srv = await boot();
  try {
    const before = snap();
    const hz = await (await j('/healthz')).json(); assert.equal(hz.staffUploads, staffDir); assert.equal(hz.staffFound, true);
    assert.match(await (await j('/')).text(), /review\.js/);                                                                  // the home page is the login page
    assert.equal((await j('/api/form', { method: 'POST', json: { faculty_id: 'T1', password: 'staff123' } })).status, 404);    // no staff entry here: staff use the staff site
    // ---- the administrator's account command (HoD, Vice Principal, Principal, Secretary logins)
    const acct = (args, input = '') => require('child_process').spawnSync('node', ['accounts.js', ...args], { env: process.env, input, encoding: 'utf8' }).stdout;
    const Auth = require('./auth.js');
    // the logins made on the first start: one per HoD and role, each with a one-time password still to be changed
    assert.deepEqual((await store.listAccounts()).filter(a => a.must_change).map(a => a.username).sort(), Auth.DEFAULT_LOGINS.map(a => a.username).sort());
    assert.deepEqual((await store.listAccounts()).filter(a => a.role === 'pc').map(a => [a.username, a.name]).sort(), [['pc', 'Placement Co-ordinator'], ['pc2', 'Placement Co-ordinator 2'], ['pc3', 'Placement Co-ordinator 3']]);   // three Placement Co-ordinators
    assert.ok(await Auth.check('pc3@nscet', (await store.findAccount('pc3')).password_hash));
    assert.match(acct(['add', 'hod', 'cse', 'hodcse', 'Dr. HoD CSE'], 'Secret@123\n'), /already exists/);
    const login = (username, password) => j('/api/login', { method: 'POST', json: { username, password } });
    const first = await login('principal', 'principal@nscet'); assert.equal(first.status, 200); assert.equal((await first.json()).mustChange, true);
    const pck = first.headers.get('set-cookie').split(';')[0], prq = (url, json) => fetch(B + url, { method: json ? 'POST' : 'GET', headers: { Cookie: pck, 'Content-Type': 'application/json' }, ...(json ? { body: JSON.stringify(json) } : {}) });
    const blocked = await prq('/api/review/list'); assert.equal(blocked.status, 403); assert.equal((await blocked.json()).change, true);           // nothing opens until the password is changed
    assert.equal((await prq('/api/password', { password: 'short' })).status, 400); assert.equal((await prq('/api/password', { password: 'principal@nscet' })).status, 400);   // too short / the same one
    const changed = await prq('/api/password', { password: 'Prin@12345' }); assert.equal(changed.status, 200); assert.equal((await changed.json()).mustChange, false);
    assert.equal((await prq('/api/review/list')).status, 200); assert.equal((await login('principal', 'principal@nscet')).status, 401);                // the one-time password no longer works
    assert.equal((await prq('/api/password', { current: 'wrong', password: 'Other@12345' })).status, 400);                                           // a later change asks for the current password
    assert.match(acct(['add', 'hod', 'CSE', 'hodcse2', 'Second'], 'Secret@123\n'), /already has an active HoD login \(hodcse\)/);   // one HoD per department
    assert.match(acct(['add', 'principal', 'HODCSE', 'Dup'], 'Secret@123\n'), /already exists/);                       // usernames match in any case
    assert.match(acct(['add', 'secretary', 'sec1', 'Short'], 'short\n'), /8 to 100 characters/);
    const acc = await store.findAccount('hodcse'); assert.equal(acc.dept, 'CSE'); assert.ok(!acc.password_hash.includes('hod@nscet') && await Auth.check('hod@nscet', acc.password_hash));   // only the hash is stored
    assert.match(acct(['list']), /hodcse\s+HoD CSE\s+HoD CSE\s+\(one-time password not changed yet\)/);
    assert.match(acct(['reset', 'hodcse'], 'NewPass@123\n'), /New one-time password set/); const reset = await store.findAccount('hodcse'); assert.ok(await Auth.check('NewPass@123', reset.password_hash) && reset.must_change);
    assert.match(acct(['disable', 'hodcse']), /disabled/); assert.match(acct(['add', 'hod', 'CSE', 'hodcse2', 'Second'], 'Secret@123\n'), /Added: HoD of CSE/);
    assert.match(acct(['enable', 'hodcse']), /already has an active HoD login \(hodcse2\)/);
    assert.match(acct(['add', 'librarian', 'lib1', 'Librarian One'], 'Lib@12345\n'), /Added: Librarian, Librarian One/);   // the new roles
    srv.kill(); await new Promise(r => setTimeout(r, 500)); srv = await boot();                                                   // a restart makes no login again and resets no password
    assert.equal((await store.listAccounts()).length, Auth.DEFAULT_LOGINS.length + 2);   // + hodcse2 and lib1
    // ---- logins on the site
    assert.equal((await login('principal', 'wrong')).status, 401); assert.equal((await login('', '')).status, 400);
    const ok = await login('PRINCIPAL', 'Prin@12345'); assert.equal(ok.status, 200); assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
    assert.deepEqual(await ok.json(), { username: 'principal', name: 'Principal', role: 'principal', roleName: 'Principal', dept: '', mustChange: false });
    const sid = ok.headers.get('set-cookie').split(';')[0], me = () => j('/api/me', { headers: { Cookie: sid } });
    assert.equal((await (await me()).json()).username, 'principal'); assert.equal((await j('/api/me')).status, 401);
    assert.equal((await login('hodcse', 'NewPass@123')).status, 401);                                                    // a disabled login cannot sign in
    acct(['disable', 'principal']); assert.equal((await me()).status, 401); acct(['enable', 'principal']); assert.equal((await me()).status, 200);   // and an open session stops at once
    acct(['add', 'secretary', 'lockme', 'Lock Test'], 'Secret@123\n');
    for (let i = 0; i < 5; i++) await login('lockme', 'nope'); assert.equal((await login('lockme', 'Secret@123')).status, 429);   // 5 wrong passwords: locked for 10 minutes
    assert.match((await j('/api/logout', { method: 'POST' })).headers.get('set-cookie'), /Max-Age=0/);
    // ---- the review: HoD -> Vice Principal / Principal -> Secretary: marks, remarks, deviation, Proceed, Finalise, who may see what
    for (const [r, u, n, p] of [['vp', 'vp1', 'Dr. VP', 'Vp@123456'], ['secretary', 'sec1', 'Secretary', 'Sec@12345']]) acct(['add', r, u, n], p + '\n');
    const as = async (u, p) => { const r = await login(u, p); assert.equal(r.status, 200, u); const c = r.headers.get('set-cookie').split(';')[0];
      const call = (url, o = {}) => fetch(B + url, { method: o.method || 'GET', headers: { Cookie: c, ...(o.json ? { 'Content-Type': 'application/json' } : {}) }, ...(o.json ? { body: JSON.stringify(o.json) } : o.body ? { body: o.body } : {}) });
      if ((await r.json()).mustChange) assert.equal((await call('/api/password', { method: 'POST', json: { password: p + '-own' } })).status, 200);   // first login: choose a password
      return call; };
    const hod = await as('hodcse2', 'Secret@123'), hodit = await as('hodit', 'hod@nscet'), vpc = await as('vp1', 'Vp@123456'), pr = await as('principal', 'Prin@12345'), sec = await as('sec1', 'Sec@12345');
    // the staff appraisals come from the staff site's folder: the HoD sees the submitted ones of the department, with the staff site's details
    const list = await (await hod('/api/review/list')).json(), t1 = list.find(x => x.owner === 'T1');
    assert.ok(t1 && t1.canOpen && t1.status === 'submitted' && t1.dept === 'CSE' && t1.name === 'Dr. Test'); assert.ok(!list.some(x => x.owner === 'T2' || x.owner === 'L1'));   // own department only
    const all = await (await sec('/api/review/list')).json(), st = c => all.find(x => x.kind === 'staff' && x.owner === c);
    assert.deepEqual(['T1', 'T2', 'L1'].map(c => st(c).status), ['submitted', 'draft', 'submitted']); assert.ok(!st('T2').canOpen);   // a draft is listed but stays closed
    assert.ok(!st('B9') && !st('N1') && all.filter(x => x.kind === 'staff').length === 3);                                     // a broken or empty folder is skipped
    assert.equal(t1.self, C.totals({ ...whole }).self);
    assert.ok(!(await (await hodit('/api/review/list')).json()).some(x => x.owner === 'T1')); assert.equal((await hodit('/api/review/' + t1.id)).status, 404);   // another HoD
    assert.equal((await j('/api/review/' + t1.id)).status, 401);                                                                   // not logged in
    let rv = await (await hod('/api/review/' + t1.id)).json(); const self = rv.totals.self;
    assert.deepEqual([rv.level, rv.can.edit, rv.can.proceed, rv.can.finalise, rv.totals.rows.A1.self, rv.totals.rows.E4.self, rv.data.p1.courses], ['hod', true, true, false, 15, 2, 'CS3591']);
    assert.equal((await hod('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '25' } } } })).status, 400);       // above the maximum (20)
    rv = await (await hod('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '12', remark: 'pass % proof covers one course only' }, E4: { marks: '5', remark: 'invited talk proof added' } }, overall: 'Good year', notes: { 'check:1': { answer: 'Yes', text: 'all proofs seen' } } } })).json();
    assert.deepEqual(rv.deviation.changes.map(c => [c.level, c.code, c.before, c.after, c.change, c.remark]), [['hod', 'A1', 15, 12, -3, 'pass % proof covers one course only'], ['hod', 'E4', 2, 5, 3, 'invited talk proof added']]);
    assert.deepEqual(rv.deviation.levels, [{ level: 'hod', before: self, after: self, change: 0, sections: ['A1', 'E4'] }]); assert.equal(rv.levels.hod.overall.remark, 'Good year'); assert.equal(rv.notes['check:1'].answer, 'Yes');
    // the report of a list as a PDF: the HoD's department only; not for lists the login cannot see
    const rep = await hod('/api/review/report.pdf?kind=staff'); assert.equal(rep.status, 200); assert.match(rep.headers.get('content-type'), /pdf/); assert.match(rep.headers.get('content-disposition'), /Appraisal-Report-Staff-CSE-2025-26\.pdf/);
    const repDoc = await require('pdf-lib').PDFDocument.load(Buffer.from(await rep.arrayBuffer())); assert.equal(repDoc.getTitle(), 'Appraisal Report – Staff – CSE'); assert.ok(repDoc.getPageCount() >= 1);
    assert.equal(Math.round(repDoc.getPage(0).getWidth()), 842);                                                                      // A4 landscape
    for (const q of ['kind=hod', 'kind=vp', 'kind=nope']) assert.equal((await hod('/api/review/report.pdf?' + q)).status, 403);
    assert.equal((await j('/api/review/report.pdf?kind=staff')).status, 401);
    assert.equal((await pr('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '10' } } } })).status, 403);         // the Principal waits for the HoD's Proceed
    assert.equal((await (await vpc('/api/review/' + t1.id)).json()).can.edit, false);
    assert.equal((await (await hod('/api/review/' + t1.id + '/proceed', { method: 'POST' })).json()).status, 'proceeded');
    assert.equal((await hod('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '11' } } } })).status, 403);       // after Proceed the HoD only views
    rv = await (await vpc('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A2: { marks: '2', remark: 'one activity lacks the student list' } } } })).json();
    rv = await (await pr('/api/review/' + t1.id, { method: 'PUT', json: { marks: { C2: { marks: '6', remark: 'certificate not proctored' } } } })).json();
    assert.deepEqual(rv.deviation.levels.map(l => [l.level, l.change, l.sections.join()]), [['hod', 0, 'A1,E4'], ['vp', -1, 'A2'], ['principal', -1, 'C2']]);   // each change under whoever made it
    assert.equal(rv.deviation.overall.change, -2);
    assert.equal((await (await pr('/api/review/' + t1.id + '/finalise', { method: 'POST' })).json()).status, 'finalised');
    assert.equal((await (await hod('/api/review/list')).json()).find(x => x.id === t1.id).status, 'finalised');                     // a later list (the staff folder read again) keeps the review status
    assert.equal((await pr('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '9' } } } })).status, 403);         // finalised: locked for the Principal / VP
    rv = await (await sec('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '13', remark: 'second proof found' } } } })).json();   // the Secretary still can
    assert.equal(rv.totals.rows.A1.final, 13); assert.equal((await (await sec('/api/review/list')).json()).find(x => x.id === t1.id).final, rv.totals.final);
    // the proofs open from the staff site's folder (only files the form refers to, only for who may see it)
    const proof = await hod(`/api/review/${t1.id}/file/${encodeURIComponent('proof A1.pdf')}`); assert.equal(proof.status, 200); assert.ok(Buffer.from(await proof.arrayBuffer()).equals(pdf));
    assert.equal((await hodit(`/api/review/${t1.id}/file/${encodeURIComponent('proof A1.pdf')}`)).status, 404);
    assert.equal((await hod(`/api/review/${t1.id}/file/${encodeURIComponent('Appraisal_T1_2025-26.pdf')}`)).status, 404); assert.equal((await hod(`/api/review/${t1.id}/file/..%2F..%2Fform.json`)).status, 404);
    const log = (await (await sec(`/api/review/${t1.id}/log`)).json()).map(x => `${x.who} ${x.action} ${x.detail}`).join('\n');
    assert.match(log, /hodcse2 marks \(HoD\) A1: 15 -> 12/); assert.match(log, /hodcse2 proceed/); assert.match(log, /principal finalise/); assert.match(log, /sec1 marks \(Secretary\) A1: 12 -> 13/);
    assert.deepEqual(snap(), before);                                                                                              // the staff site's folder is untouched: nothing written, nothing added
    // what the staff site does later shows up here: a draft is submitted, a new staff member starts, a form is reopened by its administrator
    staffForm('Dept Case (T2)', { p1: { name: 'Dept Case', designation: 'Professor', dept: 'AI&DS' }, p3: { next: {} }, ind: {}, declared: true, ...at });
    staffForm('New Staff (N2)', { p1: { name: 'New Staff', designation: 'AP', dept: 'CSE' }, p3: { next: {} }, ind: {}, declared: false });
    const { submitted, ...reopened } = { ...whole, ...at }; staffForm('Dr. Test Staff (T1)', reopened, ['proof A1.pdf']);
    const later = await (await sec('/api/review/list')).json(), lt = c => later.find(x => x.kind === 'staff' && x.owner === c);
    assert.deepEqual([lt('T2').status, lt('T2').designation, lt('N2').status, lt('T1').status], ['submitted', 'Professor', 'draft', 'draft']);
    staffForm('Dr. Test Staff (T1)', { ...whole, ...at }, ['proof A1.pdf']); assert.equal((await (await hod('/api/review/list')).json()).find(x => x.id === t1.id).status, 'submitted');
    assert.equal((await (await hod('/api/review/' + t1.id)).json()).levels.hod.ind.A1.marks, 12);                                  // submitted again: the review marks were kept
    // ---- own appraisals: every form is one per academic year; the Principal's is reviewed by the Secretary only
    const { FORMS } = require('./public/forms.js'), fill = async (call, base, form) => {
      await call(base + '/open', { method: 'POST' }); const body = { p1: {}, ind: {}, tables: {}, self: {}, declared: true };
      for (const f of form.p1) body.p1[f.k] = f.type === 'date' ? '01-06-2020' : f.type === 'period' ? '01-06-2025 to 31-05-2026' : f.type === 'select' ? f.options[0] : 'x';
      for (const i of form.ind) {
        const fd = new FormData(); fd.append('code', i.code); fd.append('file', new Blob([pdf], { type: 'application/pdf' }), i.code + '.pdf');
        const file = await (await call(base + '/upload', { method: 'POST', body: fd })).json(), g = i.groups[0];
        body.ind[i.code] = { ...(i.pick ? { pick: i.pick.options[0].l } : {}), rows: [{ g: g.id, v: Object.fromEntries(g.fields.map(f => [f.k, f.type === 'select' ? f.options[0].l : f.type === 'number' ? '9' : 'x'])), file }] };
      }
      for (const [k] of form.selfReview || []) body.self[k] = 'x';
      return body;
    };
    const prBody = await fill(pr, '/api/my/year', FORMS.principal);
    assert.equal((await pr('/api/my/year', { method: 'PUT', json: prBody })).status, 200); assert.equal((await pr('/api/my/year/submit', { method: 'POST' })).status, 200);
    const prRow = (await (await sec('/api/review/list')).json()).find(x => x.kind === 'principal');
    assert.ok(prRow && prRow.canOpen); assert.ok(!(await (await vpc('/api/review/list')).json()).some(x => x.kind === 'principal')); assert.equal((await pr('/api/review/' + prRow.id)).status, 404);   // not the VP, not the Principal
    assert.equal(prRow.self, C.totals(prBody, FORMS.principal.ind).self);                                                          // the list total uses the Principal's own form
    assert.equal((await pr('/api/my/year', { method: 'PUT', json: prBody })).status, 409);                                           // submitted: locked
    // the extra Placement Co-ordinators: their own login (one-time password <username>@nscet) and their own Placement Co-ordinator form
    const pc2 = await as('Pc2', 'pc2@nscet'), pc2My = await (await pc2('/api/my')).json();
    assert.deepEqual([pc2My.user.username, pc2My.form.kind, pc2My.form.title, pc2My.items.map(x => x.term).join()], ['pc2', 'pc', FORMS.pc.title, 'year']);
    await pc2('/api/my/year/open', { method: 'POST' }); assert.equal((await (await pc2('/api/my/year')).json()).kind, 'pc');
    assert.equal((await store.find('pc', 'pc2', C.YEAR)).owner, 'pc2'); assert.equal(await store.find('pc', 'pc3', C.YEAR), null);   // each PC has an appraisal of their own
    const lib = await as('lib1', 'Lib@12345'), mineLib = await (await lib('/api/my')).json();
    assert.deepEqual(mineLib.items.map(x => x.term + ':' + x.status), ['year:not started']); assert.equal((await lib('/api/my/S1/open', { method: 'POST' })).status, 404);   // no semesters
    await lib('/api/my/year/open', { method: 'POST' }); const s1 = await lib('/api/my/year/submit', { method: 'POST' }); assert.equal(s1.status, 409); assert.ok((await s1.json()).missing.some(m => /Highest Qualification/.test(m)));
    const lock = new FormData(); lock.append('file', new Blob([fs.readFileSync(path.join(__dirname, 'test-fixtures', 'protected.pdf'))], { type: 'application/pdf' }), 'protected.pdf');
    const lr = await lib('/api/my/year/upload', { method: 'POST', body: lock }); assert.equal(lr.status, 400); assert.match((await lr.json()).error, /password-protected/);   // protected PDFs refused
    const libBody = await fill(lib, '/api/my/year', FORMS.librarian); assert.equal((await lib('/api/my/year', { method: 'PUT', json: libBody })).status, 200); assert.equal((await lib('/api/my/year/submit', { method: 'POST' })).status, 200);
    const libRow = (await (await vpc('/api/review/list')).json()).find(x => x.kind === 'librarian' && x.term === '');
    rv = await (await vpc('/api/review/' + libRow.id, { method: 'PUT', json: { marks: { A2: { marks: '4', remark: 'access proof partial' } }, notes: { 'approval:strengths': { text: 'Good automation work' }, 'control:1': { text: 'checked' } } } })).json();
    assert.deepEqual([rv.can.finalise, rv.notes['approval:strengths'].text, rv.deviation.changes[0].change], [true, 'Good automation work', -4]);
    assert.equal((await (await lib('/api/my')).json()).items[0].status, 'submitted'); assert.equal((await lib('/api/review/list')).status, 403);   // the Librarian does not review
    // the HoD fills one form for the whole academic year (no semesters), with nothing compulsory: an empty form can be submitted and scores 0
    assert.deepEqual((await (await hod('/api/my')).json()).items.map(x => x.term + ':' + x.status), ['year:not started']); assert.equal((await hod('/api/my/S1/open', { method: 'POST' })).status, 404);
    await hod('/api/my/year/open', { method: 'POST' }); const hs = await hod('/api/my/year/submit', { method: 'POST' }); assert.equal(hs.status, 200);
    const hodRow = (await (await pr('/api/review/list')).json()).find(x => x.kind === 'hod' && x.owner === 'hodcse2'); assert.ok(hodRow && hodRow.status === 'submitted' && hodRow.self === 0 && hodRow.term === '');
    // ---- the dashboards: a HoD gets their own department only, whatever is asked; the VP, Principal and Secretary any department or the college
    const dh = await (await hod('/api/dashboard?d=IT')).json();
    assert.deepEqual([dh.scope, dh.dept, dh.count], ['dept', 'CSE', 1]);                                                             // T1 only: N2 is still a draft
    assert.equal(dh.sections.find(s => s.code === 'A1').avg, 13); assert.equal(dh.domains.length, 5);                               // final marks (the Secretary's 13)
    assert.equal(dh.results.passPct, 88); assert.deepEqual(dh.designations.map(x => [x.name, x.count]), [['Assistant Professor', 1]]);   // 'AP' grouped
    assert.equal(dh.work.find(w => w.label === 'FDP / STTP attended').value, 1); assert.ok(dh.strongest.length && dh.weakest.length);
    const dc = await (await vpc('/api/dashboard')).json();
    assert.deepEqual([dc.scope, dc.count, dc.ranking.map(d => d.dept).sort().join()], ['college', 3, 'AI&DS,CSE,IT']);
    assert.equal(dc.ranking[0].vsCollege, Math.round((dc.ranking[0].final - dc.final) * 10) / 10); assert.equal(dc.depts.find(d => d.dept === 'CSE').sections.length, C.IND.length);
    assert.ok(dc.leaders.some(l => l.username === 'hodcse2' && l.status === 'submitted' && l.self === 0) && !dc.leaders.some(l => l.role === 'Principal'));   // not the Principal's for the VP
    assert.ok((await (await sec('/api/dashboard')).json()).leaders.some(l => l.role === 'Principal' && l.status === 'submitted'));
    assert.equal((await (await pr('/api/dashboard?d=CSE')).json()).count, 1);
    assert.equal((await lib('/api/dashboard')).status, 403); assert.equal((await j('/api/dashboard')).status, 401);
    // ---- the Super Admin: every list and every appraisal (drafts too), view only; dashboards; reopens a leader's form; manages the logins
    const ad = await as('admin', 'admin@nscet'), adList = await (await ad('/api/review/list')).json(), n2 = adList.find(x => x.kind === 'staff' && x.owner === 'N2');
    assert.ok(n2 && n2.status === 'draft' && n2.canOpen && ['staff', 'hod', 'principal', 'librarian', 'pc'].every(k => adList.some(x => x.kind === k)));   // every kind; a draft opens for the Super Admin
    assert.equal((await ad('/api/review/' + n2.id)).status, 200); assert.equal((await hod('/api/review/' + n2.id)).status, 404);           // ... not for the HoD
    const adT1 = await (await ad('/api/review/' + t1.id)).json(); assert.deepEqual([adT1.can.edit, adT1.can.proceed, adT1.can.finalise, adT1.level], [false, false, false, null]);
    assert.equal((await ad('/api/review/' + t1.id, { method: 'PUT', json: { marks: { A1: { marks: '1' } } } })).status, 403); assert.equal((await ad('/api/review/' + t1.id + '/finalise', { method: 'POST' })).status, 403);
    assert.equal((await (await ad('/api/dashboard')).json()).count, (await (await sec('/api/dashboard')).json()).count);            // drafts stay out of the statistics
    assert.equal((await (await ad('/api/dashboard?d=CSE')).json()).count, 1);
    // reopen: the Principal's submitted form goes back to the Principal (marks kept); not a staff form, and nobody else can
    assert.equal((await sec(`/api/review/${prRow.id}/reopen`, { method: 'POST' })).status, 403); assert.equal((await ad(`/api/review/${t1.id}/reopen`, { method: 'POST' })).status, 400);
    assert.equal((await pr('/api/my/year', { method: 'PUT', json: prBody })).status, 409);
    const re = await (await ad(`/api/review/${prRow.id}/reopen`, { method: 'POST' })).json(); assert.equal(re.status, 'draft'); assert.equal(re.data.submitted, undefined);
    assert.equal((await pr('/api/my/year', { method: 'PUT', json: prBody })).status, 200); assert.equal((await ad(`/api/review/${prRow.id}/reopen`, { method: 'POST' })).status, 409);
    assert.match((await (await ad(`/api/review/${prRow.id}/log`)).json()).map(x => x.who + ' ' + x.action).join('\n'), /admin reopen/);   // (a draft again: closed to the Secretary)
    assert.equal((await sec(`/api/review/${prRow.id}`)).status, 404);
    // logins on the site: the Super Admin only, the same rules as accounts.js
    assert.equal((await sec('/api/admin/logins')).status, 403); assert.equal((await j('/api/admin/logins')).status, 401);
    const logins = await (await ad('/api/admin/logins')).json(); assert.ok(logins.some(a => a.username === 'pc3' && a.oneTime) && !JSON.stringify(logins).includes('scrypt'));   // no password hashes
    const addL = b => ad('/api/admin/logins', { method: 'POST', json: { role: 'pc', username: 'pc4', name: 'Placement Co-ordinator 4', password: 'Pc4-first-1', ...b } });
    assert.equal((await addL({ password: 'short' })).status, 400); assert.equal((await addL({ username: 'x' })).status, 400); assert.equal((await addL({ role: 'king' })).status, 400);
    assert.equal((await addL({ role: 'hod', dept: 'CSE', username: 'hodcse3' })).status, 409);                                            // CSE has an active HoD
    assert.equal((await addL()).status, 200); assert.equal((await addL()).status, 409);                                                    // added once; the username is taken
    let p4 = await login('pc4', 'Pc4-first-1'); assert.equal(p4.status, 200); assert.equal((await p4.json()).mustChange, true);
    assert.equal((await ad('/api/admin/logins/pc4/password', { method: 'POST', json: { password: 'Pc4-second-2' } })).status, 200);
    assert.equal((await login('pc4', 'Pc4-first-1')).status, 401); assert.equal((await login('pc4', 'Pc4-second-2')).status, 200);       // a new one-time password
    assert.equal((await ad('/api/admin/logins/pc4/active', { method: 'POST', json: { active: false } })).status, 200); assert.equal((await login('pc4', 'Pc4-second-2')).status, 401);
    assert.equal((await ad('/api/admin/logins/pc4/active', { method: 'POST', json: { active: true } })).status, 200); assert.equal((await login('pc4', 'Pc4-second-2')).status, 200);
    assert.equal((await ad('/api/admin/logins/admin/active', { method: 'POST', json: { active: false } })).status, 400);                  // not your own login
    assert.equal((await ad('/api/admin/logins/hodcse/active', { method: 'POST', json: { active: true } })).status, 409);                   // CSE already has hodcse2
    assert.equal((await ad('/api/admin/logins/nobody/password', { method: 'POST', json: { password: 'Whatever-123' } })).status, 404);
    console.log('OK – scoring rules, logins, staff appraisals read from the staff folder (untouched), review chain, own appraisals, report PDF, dashboards, Super Admin');
  } finally { srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(staffDir, { recursive: true, force: true }); await dropDb().catch(e => console.error('could not drop the test database:', e.message)); }
})().catch(e => { console.error(e); process.exit(1); });
