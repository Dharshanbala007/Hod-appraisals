// Section text copied from the appraisal form (with the changes requested in changes-appraisal.txt).
// Shared by server (validation, PDF) and browser. To change the template: edit this file only.
// Each section = groups of rows (typed fields) + an automatic scoring rule. Nobody types marks.
(function (root) {
  const YEAR = '2025-26', YEAR_LABEL = '2025–26', YEAR_FULL = '2025 to 2026';   // the academic year is fixed
  const B5 = [[5, 5], [4, 4], [3, 3], [2, 2], [1, 1], [0, 0]], B4 = [[4, 4], [3, 3], [2, 2], [1, 1], [0, 0]], B3 = [[3, 3], [2, 2], [1, 1], [0, 0]];
  const DEFAULT_MB = 5;   // largest proof file per section; a section can set its own `maxMB`
  const DEPARTMENTS = ['CSE', 'AI&DS', 'IT', 'EEE', 'ECE', 'MECH', 'CIVIL', 'S&H'];
  const deptOf = v => DEPARTMENTS.find(d => d.toLowerCase() === String(v || '').trim().toLowerCase()) || '';   // '' = not a valid department
  const O = (...l) => l.map(x => ({ l: x }));            // plain dropdown options
  const SEM = O('Odd', 'Even');

  const IND = [
    { code: 'A1', domain: 'A', title: 'University results', max: 20,
      count: 'Average pass % in all theory and theory cum practical courses you handled, using the latest declared Anna University result (if this semester’s result is not out, use the previous semester’s).',
      proof: 'University result, course-wise pass statement',
      rule: '90% and above = 20 | 85 – 89% = 15 | 80 – 84% = 14 | 70 – 79% = 12 | 60 – 69% = 10 | 55 – 59% = 8 | Below 55% = 0',
      groups: [{ id: 'r', fields: [
        { k: 'subject', label: 'Subject (code – name)' },
        { k: 'session', label: 'Result session', type: 'select', options: O('NOV/DEC', 'APR/MAY') },
        { k: 'pct', label: 'Pass %', type: 'number', min: 0, max: 100, suffix: '%' }] }],
      // the average of ALL subjects (rounded to the whole number, as the form says) decides the marks
      scoring: { kind: 'avg', field: 'pct', bands: [[90, 20], [85, 15], [80, 14], [70, 12], [60, 10], [55, 8], [0, 0]] } },

    { code: 'A2', domain: 'A', title: 'Proactive initiatives', max: 10,
      count: 'Extra academic activities for your students completed with student list and result (remedial / bridge class, peer learning, value-added course, slow / advanced learner support). Routine classes do not count.',
      proof: 'Activity report with student list and result',
      rule: '4 or more = 10 | 3 = 8 | 2 = 6 | 1 = 3 | None = 0',
      gate: { label: 'Any proactive initiatives?' },
      groups: [{ id: 'r', fields: [
        { k: 'activity', label: 'Activity name' },
        { k: 'subject', label: 'Name of subject – Sem / Dept' },
        { k: 'students', label: 'No. of students', type: 'number', min: 1, suffix: ' students' }] }],
      scoring: { kind: 'count', bands: [[4, 10], [3, 8], [2, 6], [1, 3], [0, 0]] } },

    { code: 'B1', domain: 'B', title: 'Publications and patents / Research guidance', max: 20, maxMB: 10,   // journal papers, books, patent documents
      count: 'Publications and patents: Add points. Scopus / WoS journal by quartile: Q1 = 5, Q2 = 4, Q3 = 3, Q4 = 2. Scopus / WoS conference paper or book chapter = 2. Book with ISBN by a reputed publisher = 2. UGC-CARE journal = 1. Patent granted = 3; patent published or design registered = 1. Quartile: best quartile in SJR (Scopus) or JCR (WoS) for the publication year. NSCET affiliation required; discontinued or predatory journals = 0.\nResearch guidance (Papers considered strictly, papers published along with UG/PG students considered): Add points: PhD awarded = 4; PhD scholar registered under you = 2 each; Papers considered strictly, papers published along with UG/PG students considered = 1.',
      proof: 'First page, DOI, SJR / JCR quartile proof, patent / ISBN proof; supervisor approval, scholar / project list with output',
      rule: 'Publications and patents: 6 or more points = 15 | 4 – 5 points = 13 | 3 points = 11 | 2 points = 9 | 1 point = 6 | 0 points = 0\nResearch guidance: 5 or more points = 5 | 4 points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0\nThe marks of both parts are added (maximum 20).',
      summary: ['Publications & Patents (15 marks): Points are awarded for Scopus/WoS journal publications by quartile, conference papers, books, and patents, with marks based on total points. NSCET affiliation and valid publication/patent evidence are mandatory.',
                'Research Guidance (5 marks): PhD awarded – 4 points; registered PhD scholar – 2 points each; eligible papers published with UG/PG students – 1 point each.',
                'Maximum: 20 marks. Submit first-page/DOI, SJR/JCR quartile, patent/ISBN proofs, supervisor approval, and scholar/project output lists.'],
      groups: [
        { id: 'pub', label: 'Publications and patents', fields: [
          { k: 'title', label: 'Title of the Paper' },
          { k: 'journal', label: 'Journal name' },
          { k: 'type', label: 'Type', type: 'select', options: [
            { l: 'Scopus / WoS journal – Q1 (5 points)', p: 5 }, { l: 'Scopus / WoS journal – Q2 (4 points)', p: 4 }, { l: 'Scopus / WoS journal – Q3 (3 points)', p: 3 }, { l: 'Scopus / WoS journal – Q4 (2 points)', p: 2 },
            { l: 'Scopus / WoS conference paper or book chapter (2 points)', p: 2 }, { l: 'Book with ISBN by a reputed publisher (2 points)', p: 2 }, { l: 'UGC-CARE journal (1 point)', p: 1 },
            { l: 'Patent granted (3 points)', p: 3 }, { l: 'Patent published or design registered (1 point)', p: 1 }] }] },
        { id: 'guide', tag: 'Research guidance', label: 'Research guidance (Papers considered strictly, papers published along with UG/PG students considered)', fields: [
          { k: 'type', label: 'Type', type: 'select', options: [
            { l: 'PhD awarded (4 points)', p: 4 }, { l: 'PhD scholar registered under you (2 points)', p: 2 },
            { l: 'Papers considered strictly, papers published along with UG/PG students considered (1 point)', p: 1, cap: 4 }] },   // the 1-point items count up to 4 marks only
          { k: 'name', label: 'Name of PhD scholar / UG/PG student and paper title' },
          { k: 'sem', label: 'Sem', type: 'select', options: SEM }] }],
      scoring: { kind: 'parts', parts: [
        { group: 'pub', kind: 'points', field: 'type', bands: [[6, 15], [4, 13], [3, 11], [2, 9], [1, 6], [0, 0]] },
        { group: 'guide', kind: 'points', field: 'type', bands: B5 }] } },

    { code: 'C1', domain: 'C', title: 'FDP / STTP', max: 5,
      count: 'Total days of FDP / STTP / workshop attended (AICTE ATAL, NITTTR, university, or other institutions; online or offline; full-day sessions only). AICTE-NPTEL FDPs are claimed in C2.',
      proof: 'Certificates',
      rule: '5 days or more = 5 | 4 days = 4 | 3 days = 3 | 2 days = 2 | 1 day = 1 | None = 0',
      groups: [{ id: 'r', fields: [
        { k: 'name', label: 'Name' }, { k: 'course', label: 'Course name' },
        { k: 'duration', label: 'Duration (days)', type: 'number', min: 0, suffix: ' day(s)' },
        { k: 'date', label: 'Date (from – to)', type: 'period' }] }],
      scoring: { kind: 'sum', field: 'duration', bands: B5 } },

    { code: 'C2', domain: 'C', title: 'NPTEL / SWAYAM / Online Academic Certifications/Technical certifications', max: 8,
      count: 'NPTEL / SWAYAM / Online Academic Certifications: Add points for online academic courses completed this semester, related to your field (at least 4 weeks): NPTEL, SWAYAM, or a course by a university / IIT / NIT / IIIT on Coursera, edX or similar. Course with a proctored exam = 2 each; course without a proctored exam = 1 each. The score obtained is not considered.\nTechnical certification: Best industry certification earned this semester. Proctored vendor exam (AWS, Microsoft, Google, Cisco, Oracle, NVIDIA, Red Hat, etc.): Professional / Expert, Associate, or Fundamentals level.',
      proof: 'Completion certificate; credential ID / verification link',
      rule: 'NPTEL / SWAYAM / Online Academic Certifications: 5 or more points = 5 | 4 points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0\nTechnical certification: Professional / Expert = 5 | Associate = 4 | Fundamentals = 3 | Vendor skill badge with assessment = 2 | Attendance only = 1 | None = 0\nThe marks of both parts are added (maximum 8).',
      summary: ['NPTEL / SWAYAM / Online Academic Certifications (up to 5 marks): Points are awarded for online academic courses completed this semester, related to your field (at least 4 weeks) – NPTEL, SWAYAM, or a university / IIT / NIT / IIIT course on Coursera, edX or similar. Proctored exam – 2 points each; non-proctored – 1 point each. The score obtained is not considered.',
                'Technical certification (up to 5 marks): Best industry certification earned this semester through a proctored vendor exam (AWS, Microsoft, Google, Cisco, Oracle, NVIDIA, Red Hat, etc.) – Professional / Expert 5, Associate 4, Fundamentals 3, vendor skill badge with assessment 2, attendance only 1.',
                'Maximum: 8 marks (both parts added). Submit the completion certificate and the credential ID / verification link.'],
      note: [['Proctored', 'You wrote the certification exam under supervision (at an authorised exam centre, or with live / online invigilation, as in the NPTEL / SWAYAM proctored certification exam), and the certificate carries the exam result. Counts 2 points.'],
             ['Non-proctored', 'You only completed the course (videos, assignments or unsupervised online quizzes) and received a completion certificate without a supervised exam, as with most Coursera / edX course certificates. Counts 1 point.']],
      groups: [
        { id: 'online', tag: 'NPTEL / SWAYAM / online course', label: 'NPTEL / SWAYAM / Online Academic Certifications', fields: [
          { k: 'name', label: 'Name' }, { k: 'course', label: 'Course name' }, { k: 'duration', label: 'Duration' },
          { k: 'date', label: 'Date (from – to)', type: 'period' },
          { k: 'type', label: 'Proctored or non-proctored?', type: 'select', options: [{ l: 'Proctored (2 points)', p: 2 }, { l: 'Non-proctored (1 point)', p: 1 }] }] },
        { id: 'tech', label: 'Technical certification', fields: [
          { k: 'name', label: 'Name' }, { k: 'course', label: 'Course name' }, { k: 'duration', label: 'Duration' },
          { k: 'date', label: 'Date (from – to)', type: 'period' },
          { k: 'type', label: 'Level', type: 'select', options: [
            { l: 'Professional / Expert (5)', p: 5 }, { l: 'Associate (4)', p: 4 }, { l: 'Fundamentals (3)', p: 3 }, { l: 'Vendor skill badge with assessment (2)', p: 2 }, { l: 'Attendance only (1)', p: 1 }] }] }],
      scoring: { kind: 'parts', parts: [
        { group: 'online', kind: 'points', field: 'type', bands: B5 },
        { group: 'tech', kind: 'best', field: 'type' }] } },

    { code: 'D1', domain: 'D', title: 'Funded projects and consultancy', max: 10,
      count: 'Best status reached this semester for funded work.',
      proof: 'Sanction order, fund receipt, submission proof',
      rule: 'PI of a sanctioned external project = 10 | Co-PI of a sanctioned external project = 8 | Consultancy or industry-sponsored work completed = 7 | Funded student project as guide (TNSCST, IEDC, etc.) = 5 | Internal college projects (TMHNU-NSCET) = 5 | Proposal submitted to a funding agency = 3 | None = 0',
      pick: { label: 'Best status', options: [
        { l: 'PI of a sanctioned external project', p: 10 }, { l: 'Co-PI of a sanctioned external project', p: 8 }, { l: 'Consultancy or industry-sponsored work completed', p: 7 },
        { l: 'Funded student project as guide (TNSCST, IEDC, etc.)', p: 5 }, { l: 'Internal college projects (TMHNU-NSCET)', p: 5 }, { l: 'Proposal submitted to a funding agency', p: 3 }] },
      groups: [{ id: 'r', proofOnly: true, fields: [] }],
      scoring: { kind: 'pick' } },

    { code: 'D2', domain: 'D', title: 'Industry projects and collaboration', max: 10,
      count: 'Add points: student project done for / sponsored by industry (completed) = 2; project pitched to industry with written response = 1; MoU activity = 2; internship batch arranged = 2; industry visit or industry expert talk organised = 1.',
      proof: 'Industry letter / email, report, MoU, attendance',
      rule: '8 or more points = 10 | 6 – 7 points = 8 | 4 – 5 points = 6 | 3 points = 4 | 1 – 2 points = 2 | 0 points = 0',
      groups: [{ id: 'r', fields: [
        { k: 'project', label: 'Name of project' }, { k: 'industry', label: 'Name of industry' },
        { k: 'period', label: 'Period of collaboration (from – to)', type: 'period' },
        { k: 'type', label: 'Type', type: 'select', options: [
          { l: 'Student project done for / sponsored by industry – completed (2 points)', p: 2 }, { l: 'Project pitched to industry with written response (1 point)', p: 1 },
          { l: 'MoU activity (2 points)', p: 2 }, { l: 'Internship batch arranged (2 points)', p: 2 }, { l: 'Industry visit or industry expert talk organised (1 point)', p: 1 }] }] }],
      scoring: { kind: 'points', field: 'type', bands: [[8, 10], [6, 8], [4, 6], [3, 4], [1, 2], [0, 0]] } },

    { code: 'E1', domain: 'E', title: 'Admission', max: 5,
      count: 'Add points: admission through your verified referral = 2; school visit or counselling camp = 1. The same admission cannot be claimed by two faculty.',
      proof: 'Admission office certificate, visit report',
      rule: '5 or more points = 5 | 4 points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
      groups: [{ id: 'r', pts: 2, fields: [   // 2 points for every admission through the staff member's referral
        { k: 'student', label: 'Name of student' }, { k: 'dept', label: 'Dept' }, { k: 'reg', label: 'Reg no' }, { k: 'centre', label: 'Admission centre' }] }],
      scoring: { kind: 'points', bands: B5 } },

    { code: 'E2', domain: 'E', title: 'Placement', max: 4,
      count: 'Add points: student placed through you = 2; placement drive or placement training programme coordinated = 2; company lead converted into a drive = 1. Internships are claimed in D2.',
      proof: 'Placement office certificate',
      rule: '4 or more points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
      groups: [
        { id: 'placed', label: 'Student placed through you', pts: 2, fields: [{ k: 'student', label: 'Name of student' }] },
        { id: 'drive', label: 'Placement drive or placement training programme coordinated', pts: 2, fields: [{ k: 'name', label: 'Placement drive / training programme' }, { k: 'date', label: 'Date (from – to)', type: 'period' }] },
        { id: 'lead', label: 'Company lead converted into a drive', pts: 1, fields: [{ k: 'company', label: 'Name of company' }] }],
      scoring: { kind: 'points', bands: B4 } },

    { code: 'E3', domain: 'E', title: 'Cell and college activities', max: 3,
      count: 'Add points: coordinator of a cell / committee with completed work (IQAC, IIC, R&D, EDC, NBA / NAAC, NSS, club, exam cell) = 2; support role in a cell, department or college event = 1.',
      proof: 'Office order, minutes, event report',
      rule: '3 or more points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
      groups: [{ id: 'r', fields: [
        { k: 'type', label: 'Activity', type: 'select', options: [{ l: 'Cell activity – coordinator (2 points)', p: 2 }, { l: 'College activity – support role (1 point)', p: 1 }] },
        { k: 'date', label: 'Date (from – to)', type: 'period' }] }],
      scoring: { kind: 'points', field: 'type', bands: B3 } },

    { code: 'E4', domain: 'E', title: 'Resource person, programmes and recognition', max: 5,
      count: 'Add points: resource person / invited talk / session chair outside NSCET = 2; programme organised as convenor (FDP, workshop, seminar, symposium, hackathon, conference) = 2, as co-coordinator = 1; question paper setter, external examiner, or journal / conference reviewer = 1; award from an external body = 2.',
      proof: 'Invitation / appointment letter, brochure, report, award certificate',
      rule: '5 or more points = 5 | 4 points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
      groups: [{ id: 'r', pts: 2, fields: [   // 2 points for every entry
        { k: 'topic', label: 'Name of topic' }, { k: 'org', label: 'Name of the college / organization' }, { k: 'date', label: 'Date (from – to)', type: 'period' }] }],
      scoring: { kind: 'points', bands: B5 } },
  ];

  const DOMAINS = {
    A: 'Academics, Results and Proactive Initiatives', B: 'Research, Publications and Guidance',
    C: 'Skills Upgradation and Certifications', D: 'Industry–Academia Collaboration', E: 'Contribution to College' };
  const CHECKS = [
    'Proof checked for every claim and proof numbers match the Proof index (Part VI)',
    'Result % and activity records checked (A1, A2)',
    'Papers and patents checked: index, quartile, DOI, NSCET affiliation (B1)',
    'Certificates and credential IDs checked (C1–C2)',
    'Project / collaboration proof checked (D1–D2)',
    'Admission / placement confirmed by the office; activity and programme proof checked (E1–E4)',
    'Reason written for every mark changed'];

  const maxMB = ind => (ind && ind.maxMB) || DEFAULT_MB, MAX_MB_ANY = () => Math.max(DEFAULT_MB, ...IND.map(i => i.maxMB || 0));
  const pad = n => String(n).padStart(2, '0');
  const hasProof = r => !!(r && r.file);
  const band = (bands, v) => { for (const [min, m] of bands) if (v >= min) return m; return 0; };
  // Dates are typed as a period, e.g. "1-12-2025 to 1-01-2026" (day-month-year, end not before start). Stored and shown as dd-mm-yyyy to dd-mm-yyyy.
  const parseDate = s => { const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(s || '').trim()); if (!m) return null; const d = +m[1], mo = +m[2], y = +m[3], t = Date.UTC(y, mo - 1, d), dt = new Date(t);
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100 ? { d, mo, y, t } : null; };
  const parsePeriod = s => { const p = String(s || '').trim().split(/\s+to\s+/i); if (p.length !== 2) return null; const a = parseDate(p[0]), b = parseDate(p[1]); return a && b && b.t >= a.t ? [a, b] : null; };
  const isPeriod = s => !!parsePeriod(s);
  const fmt1 = x => pad(x.d) + '-' + pad(x.mo) + '-' + x.y;
  const normPeriod = s => { const p = parsePeriod(s); return p ? fmt1(p[0]) + ' to ' + fmt1(p[1]) : String(s || '').trim(); };
  const val = (r, k) => String(((r && r.v) || {})[k] ?? '').trim();
  const optOf = (f, v) => (f.options || []).find(o => o.l === v);

  const groupOf = (ind, r) => ind.groups.find(g => g.id === r.g) || ind.groups[0];
  const complete = (ind, r) => groupOf(ind, r).fields.every(f => val(r, f.k) !== '' && (f.type !== 'period' || isPeriod(val(r, f.k))));
  const started = r => !!r.file || Object.values(r.v || {}).some(x => String(x).trim() !== '');
  // rows in filing order: group by group, as entered
  function rowsOf(ind, d) {
    if (d && d.removed) return [];                     // the faculty removed this section: no entries, no proofs
    const all = (d && d.rows) || [], out = [];
    for (const g of ind.groups) for (const r of all) if ((r.g || ind.groups[0].id) === g.id) out.push(r);
    return out;
  }

  // One scoring rule applied to the given rows -> {marks, avg}. Rows already filtered to complete ones.
  function calc(ind, d, rows, sc) {
    if (sc.kind === 'avg') {
      const v = rows.map(r => parseFloat(val(r, sc.field))).filter(x => isFinite(x));
      return v.length ? (a => ({ marks: band(sc.bands, a), avg: a }))(Math.round(v.reduce((a, b) => a + b, 0) / v.length)) : { marks: 0, avg: null };     // average of ALL subjects
    }
    if (sc.kind === 'count') return { marks: band(sc.bands, rows.length), avg: null };
    if (sc.kind === 'sum') return { marks: band(sc.bands, rows.reduce((a, r) => a + (parseFloat(val(r, sc.field)) || 0), 0)), avg: null };
    if (sc.kind === 'points') {
      let pts = 0; const capped = {};
      for (const r of rows) {
        const g = groupOf(ind, r), f = g.fields.find(x => x.k === sc.field), o = f && optOf(f, val(r, sc.field)), p = o ? o.p : g.pts || 0;
        if (o && o.cap) capped[o.l] = { sum: ((capped[o.l] || {}).sum || 0) + p, cap: o.cap }; else pts += p;
      }
      for (const c of Object.values(capped)) pts += Math.min(c.sum, c.cap);        // e.g. research-guidance papers: 1 point each, at most 4
      return { marks: band(sc.bands, pts), avg: null };
    }
    if (sc.kind === 'best') {
      const g = ind.groups.find(x => x.id === sc.group) || ind.groups[0], f = g.fields.find(x => x.k === sc.field);
      return { marks: Math.max(0, ...rows.map(r => (optOf(f, val(r, sc.field)) || { p: 0 }).p)), avg: null };
    }
    if (sc.kind === 'pick') return { marks: (ind.pick.options.find(o => o.l === d.pick) || { p: 0 }).p, avg: null };
    if (sc.kind === 'value') {            // one figure typed (a %, a count, an amount) scored on the bands; percentages are rounded to a whole number
      const v = parseFloat(val(rows[0], sc.field)), x = sc.round ? Math.round(v) : v;
      return isFinite(x) ? { marks: band(sc.bands, x), avg: null } : { marks: 0, avg: null };
    }
    if (sc.kind === 'target') {           // Marks = Max × (Achieved ÷ Agreed target), capped at Max, to one decimal
      const a = parseFloat(val(rows[0], sc.achieved)), t = parseFloat(val(rows[0], sc.target));
      return { marks: isFinite(a) && isFinite(t) && t > 0 ? Math.min(ind.max, Math.round(ind.max * Math.max(a, 0) / t * 10) / 10) : 0, avg: null };
    }
    if (sc.kind === 'parts') {            // sections made of several lists: the marks of the parts are added
      let marks = 0;
      for (const part of sc.parts) marks += calc(ind, d, rows.filter(r => groupOf(ind, r).id === part.group), part).marks;
      return { marks, avg: null };
    }
    return { marks: 0, avg: null };
  }

  // Marks are calculated here, never typed. Only rows with every field filled count; marks above 0 need at least one attached proof.
  // The result never exceeds the section maximum.
  function score(ind, d) {
    d = d || {};
    if (d.removed) return { marks: 0, avg: null, warn: '' };      // removed by the faculty (nothing to claim): 0 marks
    const active = ind.gate && d.gate !== 'Yes' ? [] : rowsOf(ind, d);      // A2: rows only count when the answer is Yes
    const rows = active.filter(r => complete(ind, r));
    let { marks, avg } = calc(ind, d, rows, ind.scoring);
    marks = Math.min(marks, ind.max);
    const notes = [];
    if (marks > 0 && !active.some(hasProof)) { notes.push('No proof attached – 0 marks will be counted.'); marks = 0; }
    const partial = active.filter(r => started(r) && !complete(ind, r) && !(ind.groups[0].proofOnly)).length;
    if (partial) notes.push(`${partial} row(s) with an empty field are not counted.`);
    return { marks, avg, warn: notes.join(' ') };
  }

  // Text for one row, used in the PDF and the proof index. Dates are shown dd-mm-yyyy.
  function rowText(ind, d, r) {
    const g = groupOf(ind, r);
    if (g.proofOnly) return `${ind.pick.label}: ${(d && d.pick) || ''}`;
    const parts = g.fields.map(f => { let v = val(r, f.k); if (!v) return ''; if (f.type === 'period') v = normPeriod(v); return (f.pre || '') + v + (f.suffix || ''); }).filter(Boolean);
    return (g.label ? (g.tag || g.label) + ': ' : '') + parts.join('; ');
  }
  const rowDate = (ind, r) => { const f = groupOf(ind, r).fields.find(x => x.type === 'period'); return f ? normPeriod(val(r, f.k)) : ''; };

  const when = at => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(at)).map(x => [x.type, x.value])); return p.day + '-' + p.month + '-' + p.year + ' ' + p.hour + ':' + p.minute + ' IST'; };
  // The text of a section as the faculty entered it, one line per entry with its proof number (or [no proof]). Used by the PDF and the Google Sheet.
  function entryLines(ind, d, refOf) {
    d = d || {}; const out = [], sc = score(ind, d);
    if (d.removed) return ['Section removed by the faculty – nothing to claim here (0 marks)'];
    if (ind.gate) out.push(`${ind.gate.label} ${d.gate || ''}`);
    if (ind.pick) out.push(`${ind.pick.label}: ${d.pick || ''}`);
    if (!(ind.gate && d.gate !== 'Yes') && !ind.groups[0].proofOnly) for (const r of rowsOf(ind, d)) out.push(`• [${refOf.get(r) || 'no proof'}] ${rowText(ind, d, r)}`);
    if (sc.avg != null) out.push(`Average pass %: ${sc.avg}`);
    return out;
  }

  // the scored sections of any form: what is still missing (every * is compulsory)
  function indProblems(inds, data, add) {
    for (const ind of inds) {
      const d = (data.ind || {})[ind.code] || {}, id = 'ind-' + ind.code, tag = ind.code + ' ' + ind.title.split(' (')[0];
      if (d.removed) continue;                                          // removed by the faculty: nothing to fill, nothing to prove
      if (ind.gate) {
        if (d.gate !== 'Yes' && d.gate !== 'No') { add(id, tag + ' – answer "' + ind.gate.label + '" (Yes / No)'); continue; }
        if (d.gate === 'No') continue;                                  // nothing to claim: the section is complete
      }
      if (ind.pick && !ind.pick.options.some(o => o.l === d.pick)) add(id, tag + ' – choose ' + ind.pick.label);
      const rows = rowsOf(ind, d);
      for (const g of ind.groups) {
        if (g.proofOnly) continue;
        if (!rows.some(r => groupOf(ind, r) === g && complete(ind, r))) add(id, tag + (g.label ? ' (' + g.label + ')' : '') + ' – fill in at least one row');
      }
      if (rows.some(r => started(r) && !complete(ind, r) && !groupOf(ind, r).proofOnly)) add(id, tag + ' – a row has an empty or invalid field');
      if (!rows.some(hasProof)) add(id, tag + ' – attach a proof');
    }
  }
  // the same for a HoD / Vice Principal / Principal / support-staff form (forms.js): Part I, the scored sections, the self-review, the declaration
  function problemsFor(form, data) {
    const out = [], add = (id, text) => out.push({ id, text }), p1 = data.p1 || {};
    if (form.optional) return out;                                     // a form with nothing compulsory (HoD): empty sections just get 0 marks
    for (const f of form.p1) if (!f.optional && !f.value && !(f.type === 'period' ? isPeriod(p1[f.k]) : String(p1[f.k] || '').trim())) add('part1', 'Part I – ' + f.label);
    indProblems(form.ind, data, add);
    for (const [k, l] of form.selfReview || []) if (!String(((data.self || {})[k]) || '').trim()) add('selfreview', 'Self-review – ' + l);
    if (!data.declared) add('declaration', 'Declaration – tick it');
    return out;
  }

  // Everything marked * is compulsory. Returns what is still missing as [{id, text}] (id = the page section to jump to); [] = ready to export.
  function problems(data) {
    const out = [], add = (id, text) => out.push({ id, text }), p1 = data.p1 || {}, p3 = data.p3 || {};
    for (const [k, l] of [['name', 'Name'], ['designation', 'Designation'], ['dept', 'Department'], ['workload', 'Workload (hrs/week)'], ['courses', 'Courses handled'], ['duties', 'Other approved duties']])
      if (k === 'dept' ? !deptOf(p1.dept) : !String(p1[k] || '').trim()) add('part1', 'Part I – ' + l);
    indProblems(IND, data, add);
    for (const [b, l] of [['dept', 'Department'], ['clg', 'College']])
      if (!String(((p3.next || {})[b]) || '').trim()) add('part3', 'Part III – Planned contribution for the next academic year – ' + l);
    if (!data.declared) add('part5', 'Part V – tick the declaration');
    return out;
  }

  // Marks at each level: self (calculated) > HoD > Principal > Secretary. A reviewer's marks are in data.hod / data.principal / data.secretary
  // as { ind: { A1: { marks, remark } }, overall: 'remark' }; the latest level that set a section's mark decides its final mark.
  const LEVELS = ['hod', 'vp', 'principal', 'secretary'];
  // the logins (staff have none) and the kinds of appraisal; each role except the Secretary fills an appraisal of its own kind
  const ROLES = { hod: 'HoD', vp: 'Vice Principal', principal: 'Principal', secretary: 'Secretary', po: 'Placement Officer', pc: 'Placement Co-ordinator', librarian: 'Librarian', pd: 'Physical Director', admin: 'Super Admin' };
  const KINDS = ['staff', 'hod', 'vp', 'principal', 'po', 'pc', 'librarian', 'pd'];
  const markOf = (data, lv, ind) => { const m = ((((data || {})[lv] || {}).ind || {})[ind.code] || {}).marks; return m === '' || m == null || isNaN(+m) ? null : Math.min(Math.max(+m, 0), ind.max); };
  // rows[code] = { self, hod, principal, secretary, final }; after = the total after each level (after.hod = total once the HoD's marks count)
  function totals(data, inds = IND) {
    const dom = {}, rows = {}, after = { self: 0, hod: 0, vp: 0, principal: 0, secretary: 0 }; let self = 0, final = 0;
    for (const ind of inds) {
      const r = rows[ind.code] = { self: score(ind, (data.ind || {})[ind.code]).marks };
      let cur = r.self; after.self += cur;
      for (const lv of LEVELS) { r[lv] = markOf(data, lv, ind); if (r[lv] != null) cur = r[lv]; after[lv] += cur; }
      r.final = cur;
      const x = dom[ind.domain] = dom[ind.domain] || { max: 0, self: 0, final: 0 };
      x.max += ind.max; x.self += r.self; x.final += r.final; self += r.self; final += r.final;
    }
    return { rows, dom, self, final, after };
  }

  // The deviation between the given marks and the edited marks:
  //   changes  – every section a reviewer changed: { code, title, level, before, after, change, remark } (before = the mark just before that level)
  //   levels   – per reviewer who changed something: { level, before, after, change, sections: [codes] } (totals before and after their changes)
  //   overall  – { before: self total, after: final total, change }
  function deviation(data, inds = IND) {
    const t = totals(data, inds), changes = [], levels = [];
    let prevLv = 'self';
    for (const lv of LEVELS) {
      const mine = [];
      for (const ind of inds) {
        const r = t.rows[ind.code]; if (r[lv] == null) continue;
        const before = [r.self, ...LEVELS.map(l => r[l])].slice(0, LEVELS.indexOf(lv) + 1).reduce((v, x) => (x == null ? v : x));   // the mark the earlier levels left
        if (r[lv] === before) continue;
        mine.push(ind.code);
        changes.push({ code: ind.code, title: ind.title, level: lv, before, after: r[lv], change: r[lv] - before, remark: ((((data[lv] || {}).ind || {})[ind.code] || {}).remark) || '' });
      }
      if (mine.length) levels.push({ level: lv, before: t.after[prevLv], after: t.after[lv], change: t.after[lv] - t.after[prevLv], sections: mine });
      prevLv = lv;
    }
    return { changes, levels, overall: { before: t.self, after: t.final, change: t.final - t.self } };
  }

  // The stronger and weaker sections of an appraisal: the highest / lowest share of the section's maximum in the final marks
  // (rows = totals().rows; every tie is listed). When all sections have the same share there is neither.
  function strengths(rows, inds = IND) {
    const s = inds.map(i => ({ code: i.code, title: i.title, max: i.max, marks: rows[i.code].final, share: rows[i.code].final / i.max }));
    const hi = Math.max(...s.map(x => x.share)), lo = Math.min(...s.map(x => x.share));
    return hi === lo ? { strong: [], weak: [] } : { strong: s.filter(x => x.share === hi), weak: s.filter(x => x.share === lo) };
  }

  // Ordered proof list: only rows with a file get a number (A1-01, A1-02 ... no gaps), in filing order A1..E4.
  function proofs(data, inds = IND) {
    const list = [];
    for (const ind of inds) {
      const d = (data.ind || {})[ind.code] || {}; let n = 0;
      if (ind.gate && d.gate !== 'Yes') continue;
      for (const r of rowsOf(ind, d)) if (hasProof(r)) list.push({ ref: ind.code + '-' + pad(++n), code: ind.code, e: r, desc: rowText(ind, d, r), date: rowDate(ind, r) });
    }
    return list;
  }

  const api = { DEPARTMENTS, deptOf, maxMB, MAX_MB_ANY, YEAR, YEAR_LABEL, YEAR_FULL, IND, DOMAINS, CHECKS, LEVELS, ROLES, KINDS, pad, score, totals, deviation, strengths, proofs, problems, problemsFor, when, entryLines, hasProof, rowsOf, rowText, rowDate, normPeriod, isPeriod, parseDate, complete, started, groupOf, val };
  if (typeof module !== 'undefined') module.exports = api; else root.CFG = api;
})(typeof window !== 'undefined' ? window : globalThis);
