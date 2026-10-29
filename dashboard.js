// The analytics dashboards, from the staff appraisals that are submitted (or further on): one department, or the whole college.
// Marks are the final marks (after review) unless "self" is named; a section the staff member removed counts 0.
const C = require('./public/config.js');
const r1 = x => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
const mean = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : null);
const DOMS = Object.keys(C.DOMAINS), IND = code => C.IND.find(i => i.code === code);
const domMax = k => C.IND.filter(i => i.domain === k).reduce((s, i) => s + i.max, 0);
// designations are typed freely on the staff site: grouped
const designation = d => (/teaching\s*fellow/i.test(d) ? 'Teaching Fellow' : /associate\s*prof/i.test(d) ? 'Associate Professor'
  : /assistant\s*prof|^\s*AP\b/i.test(d) ? 'Assistant Professor' : /^\s*prof(essor)?\.?\s*$/i.test(d) ? 'Professor' : 'Other');
// the complete entries of one group of a section (a removed section has none)
const entries = (data, code, group) => { const ind = IND(code); return C.rowsOf(ind, (data.ind || {})[code]).filter(r => C.groupOf(ind, r).id === group && C.complete(ind, r)); };

// items: [{ code, name, designation, dept, data, levels }] -> each with its totals (levels = the reviewers' marks)
const scored = items => items.map(it => ({ ...it, t: C.totals({ ...it.data, ...it.levels }) }));

// one department: domains (11), sections (12), strongest / weakest (13), removed sections (14), designations (16), results (17), work done (18)
function department(items) {
  const S = scored(items);
  const sections = C.IND.map(i => { const a = mean(S, x => x.t.rows[i.code].final);
    return { code: i.code, title: i.title, domain: i.domain, max: i.max, avg: r1(a), share: a == null ? null : r1(a / i.max * 100),
      removed: S.filter(x => ((x.data.ind || {})[i.code] || {}).removed).length }; });
  const shares = sections.map(s => s.share).filter(s => s != null), hi = Math.max(...shares), lo = Math.min(...shares), even = !shares.length || hi === lo;
  const desig = {}; for (const x of S) (desig[designation(x.designation || '')] = desig[designation(x.designation || '')] || []).push(x);
  const pass = S.map(x => mean(entries(x.data, 'A1', 'r'), r => +r.v.pct)).filter(p => p != null);
  const count = (code, group, f = () => true) => S.reduce((s, x) => s + entries(x.data, code, group).filter(f).length, 0);
  const patent = r => /^patent/i.test(r.v.type || '');
  return {
    count: S.length, self: r1(mean(S, x => x.t.self)), final: r1(mean(S, x => x.t.final)),
    domains: DOMS.map(k => { const a = mean(S, x => x.t.dom[k].final); return { key: k, title: C.DOMAINS[k], max: domMax(k), avg: r1(a), share: a == null ? null : r1(a / domMax(k) * 100) }; }),
    sections,
    strongest: even ? [] : sections.filter(s => s.share === hi), weakest: even ? [] : sections.filter(s => s.share === lo),
    designations: Object.entries(desig).map(([name, a]) => ({ name, count: a.length, self: r1(mean(a, x => x.t.self)), final: r1(mean(a, x => x.t.final)) })).sort((a, b) => b.count - a.count),
    results: { staff: pass.length, passPct: r1(mean(pass, p => p)) },
    work: [
      ['Papers and books', count('B1', 'pub', r => !patent(r))], ['Patents', count('B1', 'pub', patent)], ['Research guidance', count('B1', 'guide')],
      ['FDP / STTP attended', count('C1', 'r')], ['FDP / STTP days', S.reduce((s, x) => s + entries(x.data, 'C1', 'r').reduce((d, r) => d + (+r.v.duration || 0), 0), 0)],
      ['NPTEL / online courses', count('C2', 'online')], ['Technical certifications', count('C2', 'tech')],
      ['Staff with funded projects / consultancy', S.filter(x => x.t.rows.D1.final > 0).length], ['Industry projects and collaborations', count('D2', 'r')],
      ['Students placed', count('E2', 'placed')], ['Placement drives / training', count('E2', 'drive')], ['Company leads converted', count('E2', 'lead')],
    ].map(([label, value]) => ({ label, value })),
  };
}

// the whole college: department ranking (4), each department against the college average (5), average self and final (6), top 10 (8),
// department x section grid (9), domains (10), and the leaders' own appraisals (14, given as they are)
function college(items, leaders) {
  const S = scored(items), self = r1(mean(S, x => x.t.self)), final = r1(mean(S, x => x.t.final));
  const depts = C.DEPARTMENTS.map(d => { const a = S.filter(x => x.dept === d), f = r1(mean(a, x => x.t.final));
    return { dept: d, count: a.length, self: r1(mean(a, x => x.t.self)), final: f, vsCollege: f == null || final == null ? null : r1(f - final),
      sections: C.IND.map(i => { const m = mean(a, x => x.t.rows[i.code].final); return m == null ? null : r1(m / i.max * 100); }) }; });
  return {
    count: S.length, self, final,
    ranking: depts.filter(d => d.count).sort((a, b) => b.final - a.final || b.count - a.count).map((d, k) => ({ rank: k + 1, ...d })),
    depts,
    top: [...S].sort((a, b) => b.t.final - a.t.final || b.t.self - a.t.self).slice(0, 10).map((x, k) => ({ rank: k + 1, code: x.code, name: x.name, dept: x.dept, designation: x.designation, self: r1(x.t.self), final: r1(x.t.final) })),
    sections: C.IND.map(i => ({ code: i.code, title: i.title, max: i.max })),
    domains: department(items).domains,
    leaders,
  };
}

module.exports = { department, college, designation };
