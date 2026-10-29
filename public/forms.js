// The appraisal forms of the HoD, Vice Principal / Principal, Placement Officer, Placement Co-ordinator, Librarian and Physical Director,
// written from the college's templates (2026-27 drafts, used for the academic year 2025-26). The staff form stays in config.js.
// Each form: Part I fields, the scored indicators (same shape as the staff form, so the same engine scores them), the reviewer's verification
// checks, and – for the four support-staff forms – targets, profile, annexure tables, self-review and the Principal's approval items.
(function (root) {
  // ---- builders for the indicator kinds used by the templates
  const PCT = (label, max = 100) => ({ k: 'value', label, type: 'number', min: 0, max, suffix: '%' });
  const DETAILS = { k: 'details', label: 'Details of the achievement' };
  // one figure (a %, a count, an amount, a ratio) scored on the template's bands
  const value = (code, domain, title, max, count, proof, rule, field, bands, round = false) =>
    ({ code, domain, title, max, count, proof, rule, groups: [{ id: 'r', single: true, fields: [field, DETAILS] }], scoring: { kind: 'value', field: 'value', round, bands } });
  const pct = (code, domain, title, max, count, proof, rule, label, bands) => value(code, domain, title, max, count, proof, rule, PCT(label), bands, true);
  const num = (code, domain, title, max, count, proof, rule, label, bands, extra = {}) => value(code, domain, title, max, count, proof, rule, { k: 'value', label, type: 'number', min: 0, ...extra }, bands);
  // entries added up as points (one row per item, its type gives the points)
  const points = (code, domain, title, max, count, proof, rule, options, bands) =>
    ({ code, domain, title, max, count, proof, rule, groups: [{ id: 'r', fields: [{ k: 'type', label: 'Type', type: 'select', options }, { k: 'item', label: 'Details (title / activity / date)' }] }], scoring: { kind: 'points', field: 'type', bands } });
  // the best status reached (one choice), with details and proof
  const best = (code, domain, title, max, count, proof, rule, label, options) =>
    ({ code, domain, title, max, count, proof, rule, pick: { label, options }, groups: [{ id: 'r', single: true, fields: [DETAILS] }], scoring: { kind: 'pick' } });
  // support-staff forms: a quantitative indicator (Marks = Max × Achieved ÷ Agreed target, capped at Max)
  const RULE_T = 'Marks = Max × (Achieved ÷ Agreed target), capped at Max. No marks without evidence.';
  const target = (code, domain, title, max, count, proof, achieved = 'Achieved', agreed = 'Agreed target') =>
    ({ code, domain, title, max, count, proof, rule: RULE_T, groups: [{ id: 'r', single: true, fields: [{ k: 'achieved', label: achieved, type: 'number', min: 0 }, { k: 'target', label: agreed, type: 'number', min: 0 }, { k: 'details', label: 'Details: activities, dates, outcomes' }] }], scoring: { kind: 'target', achieved: 'achieved', target: 'target' } });
  // support-staff forms: an indicator rated against evidence (fully 100%, substantial 70%, partial 40%, weak 0)
  const RULE_R = 'Rated against evidence: fully evidenced and timely = 100% of Max | substantial = 70% | partial = 40% | weak or unsupported = 0. No marks without evidence.';
  const r1 = x => Math.round(x * 10) / 10;
  const rated = (code, domain, title, max, count, proof) => ({ code, domain, title, max, count, proof, rule: RULE_R,
    pick: { label: 'Evidence level (self-rating)', options: [['Fully evidenced and timely', 1], ['Substantial', 0.7], ['Partial', 0.4], ['Weak or unsupported', 0]].map(([l, f]) => ({ l: `${l} (${r1(max * f)} marks)`, p: r1(max * f) })) },
    groups: [{ id: 'r', single: true, fields: [{ k: 'details', label: 'Details: target vs achieved, activities, dates, outcomes' }] }], scoring: { kind: 'pick' } });

  const DEPTS = ['CSE', 'AI&DS', 'IT', 'EEE', 'ECE', 'MECH', 'CIVIL', 'S&H'];

  // ================= HoD (one form per academic year; reviewed by the Vice Principal / Principal)
  const HOD = {
    kind: 'hod', title: 'Self-Appraisal Form – Head of the Department', period: 'year', reviewer: 'Principal',
    optional: true,   // nothing is compulsory: fill what applies, anything left empty gets 0 marks, submit any time
    reopen: true,     // the HoD may take a submitted form back (Edit again) with everything saved, until it is finalised
    intro: 'Fill one form for the whole academic year. Nothing is compulsory: fill in what applies to you; a section left empty gets 0 marks. The marks for each level are given in the scoring sheet itself. Number your proofs as A1-01, A1-02, B1-01 … and attach them in that order.',
    p1: [{ k: 'name', label: 'Name' }, { k: 'faculty_id', label: 'Faculty ID' }, { k: 'designation', label: 'Designation' }, { k: 'dept', label: 'Department', type: 'select', options: DEPTS },
      { k: 'charge_date', label: 'Date of taking charge as HoD', type: 'date' }, { k: 'courses', label: 'Courses handled', long: true }, { k: 'strength', label: 'No. of faculty / students in the department' }],
    domains: { A: 'Academics and Department Results', B: 'Research and Faculty Development', C: 'Accreditation and Department Administration', D: 'Placement, Admissions and Industry', E: 'Contribution to College' },
    ind: [
      pct('A1', 'A', 'Department university results', 10, 'Average pass % of all courses offered by the department this academic year.', 'Department result analysis',
        '90% and above = 10 | 85 – 89% = 9 | 80 – 84% = 8 | 70 – 79% = 6 | 60 – 69% = 4 | Below 60% = 0', 'Department pass %', [[90, 10], [85, 9], [80, 8], [70, 6], [60, 4], [0, 0]]),
      pct('A2', 'A', 'Own subject results', 5, 'Average pass % in the subjects you handled this academic year.', 'University result',
        '90% and above = 5 | 85 – 89% = 4 | 80 – 84% = 3 | 70 – 79% = 2 | 60 – 69% = 1 | Below 60% = 0', 'Own pass %', [[90, 5], [85, 4], [80, 3], [70, 2], [60, 1], [0, 0]]),
      pct('A3', 'A', 'Academic monitoring', 10, '% of department faculty whose lesson plan, course file, attendance and internal tests were checked, with a written action report.', 'Audit checklist and action report',
        '100% = 10 | 90 – 99% = 8 | 80 – 89% = 6 | 70 – 79% = 4 | 50 – 69% = 2 | Below 50% = 0', 'Faculty audited %', [[100, 10], [90, 8], [80, 6], [70, 4], [50, 2], [0, 0]]),
      num('A4', 'A', 'Department academic initiatives', 10, 'Department-level initiatives completed with student list and outcome (remedial / bridge course, value-added course, slow / advanced learner programme, etc.).', 'Circular, report, outcome data',
        '5 or more = 10 | 4 = 8 | 3 = 6 | 2 = 4 | 1 = 2 | None = 0', 'No. of initiatives', [[5, 10], [4, 8], [3, 6], [2, 4], [1, 2], [0, 0]], { step: 1 }),
      num('B1', 'B', 'Department publications', 8, 'Scopus / WoS-indexed papers by department faculty with NSCET affiliation this academic year.', 'Publication list with DOI',
        '6 or more = 8 | 5 = 7 | 4 = 6 | 3 = 4 | 1 – 2 = 2 | None = 0', 'No. of papers', [[6, 8], [5, 7], [4, 6], [3, 4], [1, 2], [0, 0]], { step: 1 }),
      points('B2', 'B', 'Own research', 4, 'Add points for your own papers: Q1/Q2 = 4, Q3/Q4 = 3, Scopus/WoS = 2, UGC-CARE = 1.', 'First page, DOI, index proof',
        '4 or more points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
        [{ l: 'Q1 / Q2 journal (4 points)', p: 4 }, { l: 'Q3 / Q4 journal (3 points)', p: 3 }, { l: 'Scopus / WoS (2 points)', p: 2 }, { l: 'UGC-CARE (1 point)', p: 1 }], [[4, 4], [3, 3], [2, 2], [1, 1], [0, 0]]),
      pct('B3', 'B', 'Faculty development', 8, '% of department faculty who completed at least one FDP / STTP or NPTEL course this academic year.', 'Faculty-wise FDP / NPTEL list',
        '80% and above = 8 | 70 – 79% = 7 | 60 – 69% = 6 | 50 – 59% = 4 | 30 – 49% = 2 | Below 30% = 0', 'Faculty covered %', [[80, 8], [70, 7], [60, 6], [50, 4], [30, 2], [0, 0]]),
      // Accreditation readiness (8 marks) removed after validation: its marks went 4 + 4 to the two sections below (6 -> 10 each, the A3 bands)
      pct('C1', 'C', 'Meetings and records', 10, '% of scheduled department meetings held with minutes and action-taken report (staff meeting, class committee, DAB, PAC, etc.).', 'Minutes and action-taken reports',
        '100% = 10 | 90 – 99% = 8 | 80 – 89% = 6 | 70 – 79% = 4 | 50 – 69% = 2 | Below 50% = 0', 'Meetings held %', [[100, 10], [90, 8], [80, 6], [70, 4], [50, 2], [0, 0]]),
      pct('C2', 'C', 'Student mentoring', 10, '% of department students with an updated mentoring record (attendance, marks, counselling follow-up).', 'Mentor records summary',
        '100% = 10 | 90 – 99% = 8 | 80 – 89% = 6 | 70 – 79% = 4 | 50 – 69% = 2 | Below 50% = 0', 'Students covered %', [[100, 10], [90, 8], [80, 6], [70, 4], [50, 2], [0, 0]]),
      pct('D1', 'D', 'Department placement', 6, '% of eligible final-year students of the department placed (or admitted to higher studies) so far this academic year.', 'Placement office report',
        '90% and above = 6 | 80 – 89% = 5 | 70 – 79% = 4 | 60 – 69% = 3 | 50 – 59% = 2 | Below 50% = 0', 'Students placed %', [[90, 6], [80, 5], [70, 4], [60, 3], [50, 2], [0, 0]]),
      pct('D2', 'D', 'Department admissions', 5, '% of the department’s approved intake filled (latest admission figure).', 'Admission office statement',
        '95% and above = 5 | 90 – 94% = 4 | 80 – 89% = 3 | 70 – 79% = 2 | 60 – 69% = 1 | Below 60% = 0', 'Intake filled %', [[95, 5], [90, 4], [80, 3], [70, 2], [60, 1], [0, 0]]),
      points('D3', 'D', 'Industry collaboration', 4, 'Add department points: MoU activity or consultancy = 2, internship batch = 2, expert talk or industry visit = 1.', 'MoU, report, attendance',
        '8 or more points = 4 | 6 – 7 points = 3 | 4 – 5 points = 2 | 1 – 3 points = 1 | 0 points = 0',
        [{ l: 'MoU activity or consultancy (2 points)', p: 2 }, { l: 'Internship batch (2 points)', p: 2 }, { l: 'Expert talk or industry visit (1 point)', p: 1 }], [[8, 4], [6, 3], [4, 2], [1, 1], [0, 0]]),
      points('E1', 'E', 'Institutional duties', 5, 'Add points: major college activity as coordinator (IQAC, IIC, R&D, EDC, NBA/NAAC, club) = 2, support role = 1.', 'Office order / minutes',
        '5 or more points = 5 | 4 points = 4 | 3 points = 3 | 2 points = 2 | 1 point = 1 | 0 points = 0',
        [{ l: 'Major college activity as coordinator (2 points)', p: 2 }, { l: 'Support role (1 point)', p: 1 }], [[5, 5], [4, 4], [3, 3], [2, 2], [1, 1], [0, 0]]),
      num('E2', 'E', 'Student achievements', 5, 'Department student achievements this academic year: prizes in hackathons / competitions, papers, patents, funded projects.', 'Certificates / proofs',
        '6 or more = 5 | 4 – 5 = 4 | 3 = 3 | 2 = 2 | 1 = 1 | None = 0', 'No. of achievements', [[6, 5], [4, 4], [3, 3], [2, 2], [1, 1], [0, 0]], { step: 1 }),
    ],
    checks: ['Proof checked for every claim and proof numbers match the Proof index', 'Result analysis and academic audit records checked (A1–A4)', 'Publication and FDP data checked (B1–B3)',
      'Minutes and mentor records checked (C1–C2)', 'Placement and admission figures confirmed by the respective offices (D1–D2)', 'Duties and student achievement proofs checked (E1–E2)', 'Reason written for every mark changed'],
    declaration: 'I declare that the details given are correct, the proofs are genuine, and no item is claimed twice.',
    signatures: ['HoD', 'Vice-Principal', 'IQAC', 'Principal'],
    notes: ['Round percentages to the nearest whole number.', 'Claim only work done in this academic year. Except B1 / B2, claim each item once, under one sub-indicator only. A claim without proof gets 0 marks.',
      'Department figures (A1, A3, A4, B1, B3, C1–C2, D1–D3, E2) are the department’s; own figures (A2, B2, E1) are yours. A paper may count in both B1 and B2.',
      'Rating: 90–100 Outstanding; 80–89 Excellent; 70–79 Very Good; 60–69 Satisfactory; below 60 Needs Improvement. Outstanding also needs at least 21 out of 35 in Domain A.'],
    outstandingNeeds: { domain: 'A', min: 21 },
  };

  // ================= Vice-Principal / Principal (one form per academic year; VP reviewed by the Principal, Principal by the Secretary)
  const LEADER = kind => ({
    kind, title: 'Self-Appraisal Form – ' + (kind === 'vp' ? 'Vice-Principal' : 'Principal'), period: 'year', reviewer: kind === 'vp' ? 'Principal' : 'Secretary / Correspondent',
    intro: 'Fill one form per academic year. The marks for each level are given in the scoring sheet itself. Number your proofs as A1-01, A1-02, B1-01 … and attach them in that order.',
    p1: [{ k: 'name', label: 'Name' }, { k: 'employee_id', label: 'Employee ID' }, { k: 'post_date', label: 'Date of assuming present post', type: 'date' },
      { k: 'review_period', label: 'Review period (from – to)', type: 'period' }, ...(kind === 'vp' ? [{ k: 'portfolio', label: 'Portfolio assigned (Vice-Principal)', optional: true }] : []),
      { k: 'strength', label: 'No. of departments / faculty / students' }],
    domains: { A: 'Academic Leadership and Results', B: 'Accreditation, Quality and Compliance', C: 'Research, Innovation and Faculty Development', D: 'Placement, Admissions and Industry', E: 'Administration and Governance' },
    ind: [
      pct('A1', 'A', 'Institutional university results', 10, 'College-wide average pass % in university examinations (all departments, all semesters in the year).', 'Consolidated result analysis',
        '90% and above = 10 | 85 – 89% = 9 | 80 – 84% = 8 | 70 – 79% = 6 | 60 – 69% = 4 | Below 60% = 0', 'College average pass %', [[90, 10], [85, 9], [80, 8], [70, 6], [60, 4], [0, 0]]),
      pct('A2', 'A', 'Academic monitoring', 10, '% of departments audited each semester (lesson plan, course file, attendance, internal tests) with a written action report.', 'Audit reports and action-taken reports',
        '100% = 10 | 90 – 99% = 8 | 80 – 89% = 6 | 70 – 79% = 4 | 50 – 69% = 2 | Below 50% = 0', 'Departments audited %', [[100, 10], [90, 8], [80, 6], [70, 4], [50, 2], [0, 0]]),
      num('A3', 'A', 'Teaching–learning initiatives', 10, 'Institution-level initiatives completed with outcome (OBE implementation, mentoring system, ICT/LMS, faculty induction, student support, etc.).', 'Circular, report, outcome data',
        '5 or more = 10 | 4 = 8 | 3 = 6 | 2 = 4 | 1 = 2 | None = 0', 'No. of initiatives', [[5, 10], [4, 8], [3, 6], [2, 4], [1, 2], [0, 0]], { step: 1 }),
      best('B1', 'B', 'Accreditation and ranking', 12, 'Best status reached in the year (NBA, NAAC, NIRF or other recognised ranking).', 'Accreditation letter, submission proof',
        'Accreditation granted / renewed = 12 | SAR / SSR submitted = 10 | Ranking obtained (NIRF / other) = 8 | Ranking data submitted = 6 | Mock audit completed = 3 | None = 0', 'Best status',
        [{ l: 'Accreditation granted / renewed', p: 12 }, { l: 'SAR / SSR submitted', p: 10 }, { l: 'Ranking obtained (NIRF / other)', p: 8 }, { l: 'Ranking data submitted', p: 6 }, { l: 'Mock audit completed', p: 3 }, { l: 'None', p: 0 }]),
      pct('B2', 'B', 'Statutory compliance', 8, '% of statutory submissions made on time (AICTE EoA, university affiliation, AQAR, AISHE, NIRF data, etc.).', 'Submission acknowledgements',
        '100% = 8 | 90 – 99% = 6 | 75 – 89% = 4 | 50 – 74% = 2 | Below 50% = 0', 'On-time submissions %', [[100, 8], [90, 6], [75, 4], [50, 2], [0, 0]]),
      num('C1', 'C', 'Institutional research output', 8, 'Scopus / WoS-indexed papers with NSCET affiliation in the year, per 10 faculty members.', 'Publication list with DOI',
        '5 or more per 10 faculty = 8 | 4 = 7 | 3 = 6 | 2 = 4 | 1 = 2 | Less than 1 = 0', 'Papers per 10 faculty', [[5, 8], [4, 7], [3, 6], [2, 4], [1, 2], [0, 0]], { step: 'any' }),
      num('C2', 'C', 'Funded projects and consultancy', 6, 'External funding received by the institution in the year (research grants, consultancy, sponsored projects).', 'Sanction orders, fund receipts',
        '₹25 lakh or more = 6 | ₹10 – 24 lakh = 5 | ₹5 – 9 lakh = 4 | ₹2 – 4 lakh = 3 | Below ₹2 lakh = 2 | None = 0', 'Amount received (₹ lakh)', [[25, 6], [10, 5], [5, 4], [2, 3], [0.01, 2], [0, 0]], { step: 'any', suffix: ' lakh' }),
      pct('C3', 'C', 'Faculty development', 6, '% of faculty who completed at least one FDP / STTP or NPTEL course in the year.', 'Department-wise FDP / NPTEL list',
        '90% and above = 6 | 80 – 89% = 5 | 70 – 79% = 4 | 60 – 69% = 3 | 50 – 59% = 2 | Below 50% = 0', 'Faculty covered %', [[90, 6], [80, 5], [70, 4], [60, 3], [50, 2], [0, 0]]),
      pct('D1', 'D', 'Placement', 8, '% of eligible final-year students placed (or admitted to higher studies).', 'Placement office report with offer letters',
        '90% and above = 8 | 80 – 89% = 7 | 70 – 79% = 6 | 60 – 69% = 4 | 50 – 59% = 2 | Below 50% = 0', 'Students placed %', [[90, 8], [80, 7], [70, 6], [60, 4], [50, 2], [0, 0]]),
      pct('D2', 'D', 'Admissions', 8, '% of approved intake filled (all programmes).', 'Admission statement',
        '95% and above = 8 | 90 – 94% = 7 | 80 – 89% = 6 | 70 – 79% = 4 | 60 – 69% = 2 | Below 60% = 0', 'Intake filled %', [[95, 8], [90, 7], [80, 6], [70, 4], [60, 2], [0, 0]]),
      num('D3', 'D', 'Industry partnerships', 4, 'Active MoUs with at least one completed activity in the year.', 'MoU and activity reports',
        '5 or more = 4 | 3 – 4 = 3 | 2 = 2 | 1 = 1 | None = 0', 'Active MoUs', [[5, 4], [3, 3], [2, 2], [1, 1], [0, 0]], { step: 1 }),
      pct('E1', 'E', 'Statutory meetings', 5, '% of scheduled statutory meetings held with minutes and action-taken report (Governing Council, IQAC, CDC, grievance, anti-ragging, etc.).', 'Minutes and action-taken reports',
        '100% = 5 | 90 – 99% = 4 | 80 – 89% = 3 | 70 – 79% = 2 | 50 – 69% = 1 | Below 50% = 0', 'Meetings held %', [[100, 5], [90, 4], [80, 3], [70, 2], [50, 1], [0, 0]]),
      pct('E2', 'E', 'Grievance redressal', 5, '% of student and staff grievances closed within the set time.', 'Grievance register',
        '95% and above = 5 | 90 – 94% = 4 | 80 – 89% = 3 | 70 – 79% = 2 | 50 – 69% = 1 | Below 50% = 0', 'Closed on time %', [[95, 5], [90, 4], [80, 3], [70, 2], [50, 1], [0, 0]]),
    ],
    checks: ['Proof checked for every claim and proof numbers match the Proof index', 'Result analysis and academic audit reports checked (A1–A3)', 'Accreditation and statutory submissions checked (B1–B2)',
      'Publication, funding and FDP data checked (C1–C3)', 'Placement and admission figures confirmed by the respective offices (D1–D2)', 'Minutes and grievance register checked (E1–E2)', 'Reason written for every mark changed'],
    declaration: 'I declare that the details given are correct, the proofs are genuine, and no item is claimed twice.',
    signatures: ['Appraisee', 'Reviewing authority', 'Secretary / Correspondent', 'Chairman'],
    notes: ['Round percentages to the nearest whole number. A Vice-Principal is scored on the institution’s figures unless a portfolio was assigned at the start of the year; then the portfolio figures are used.',
      'Claim each item once, under one sub-indicator only. A claim without proof gets 0 marks.',
      'Vice-Principal: reviewed by the Principal; approved by the Secretary / Correspondent and the Chairman. Principal: reviewed by the Secretary / Correspondent; approved by the Chairman.',
      'Rating: 90–100 Outstanding; 80–89 Excellent; 70–79 Very Good; 60–69 Satisfactory; below 60 Needs Improvement. Outstanding also needs at least 18 out of 30 in Domain A.'],
    outstandingNeeds: { domain: 'A', min: 18 },
  });

  // ================= the four support-staff forms (one form per academic year; reviewed by the Vice Principal / Principal)
  const SUPPORT_P1 = (section, designation) => [
    { k: 'section', label: 'Name of the Department / Section', ...(section ? { value: section } : { type: 'select', options: DEPTS }) },
    { k: 'name', label: 'Name of the Employee' }, { k: 'employee_id', label: 'Employee ID' }, { k: 'designation', label: 'Present Designation', value: designation },
    { k: 'qualification', label: 'Highest Qualification' }, { k: 'dob', label: 'Date of birth', type: 'date' }, { k: 'joining', label: 'Date of Joining', type: 'date' },
    { k: 'mobile', label: 'Mobile No.' }, { k: 'email', label: 'Email ID' }, { k: 'reporting', label: 'Reporting Officer', value: 'Principal' },
    { k: 'review_period', label: 'Review period (from – to)', type: 'period' }];
  const PROFILE = [
    { id: 'qualifications', title: 'Profile (information only – not scored): qualifications', columns: [['degree', 'Degree / Certificate'], ['specialization', 'Specialization'], ['institution', 'Institution / University'], ['year', 'Year'], ['grade', '% / Grade'], ['remarks', 'Remarks']] },
    { id: 'positions', title: 'Profile (information only – not scored): positions held', columns: [['position', 'Position held'], ['organization', 'Institution / Organization'], ['from', 'From'], ['to', 'To'], ['years', 'Years']] }];
  const TARGETS = { id: 'targets', title: 'Targets agreed at the start of the academic year (planning record only; carries no marks)', columns: [['indicator', 'Indicator'], ['description', 'Target description'], ['target', 'Agreed target (number / %)']] };
  const SELF_REVIEW = [['achievements', 'Three major achievements'], ['improve', 'Areas needing improvement / support'], ['next_targets', 'Proposed targets for the next academic year']];
  const DECL_SUPPORT = 'I certify that the claims made in this form are accurate, the evidence enclosed is genuine, no activity has been counted twice, and the work was completed during the review period.';
  const APPROVAL = [['response', 'Employee response / appeal disposition'], ['strengths', 'Strengths and achievements'], ['priorities', 'Three development priorities'], ['training', 'Training / support approved'],
    ['recommendation', 'Principal recommendation'], ['management', 'Management approval'], ['next_review', 'Next review date']];
  const SUPPORT_NOTES = ['Quantitative indicators: Marks = Max × (Achieved ÷ Agreed target), capped at Max. Other indicators (rated against evidence): fully evidenced and timely = 100% of Max; substantial = 70%; partial = 40%; weak or unsupported = 0. No marks without evidence. The same activity cannot be claimed under two indicators. Targets are agreed with the reporting officer at the start of the academic year.',
    'Rating: 90–100 Outstanding | 80–89.9 Excellent | 70–79.9 Very Good | 60–69.9 Satisfactory | below 60 Needs Improvement. The rating is advisory and is not an automatic pay or promotion decision.'];
  const support = (kind, title, section, designation, domains, ind, annexures, controls) => ({
    kind, title, period: 'year', reviewer: 'Principal', intro: 'One form for the whole academic year. ' + SUPPORT_NOTES[0],
    p1: SUPPORT_P1(section, designation), domains, ind, tables: [TARGETS, ...PROFILE, ...annexures], selfReview: SELF_REVIEW, declaration: DECL_SUPPORT,
    controls, approval: APPROVAL, notes: SUPPORT_NOTES, signatures: ['Employee', 'Principal', 'IQAC Moderator', 'Secretary / Management'],
  });

  const PO = support('po', 'Self-Appraisal Form for Training & Placement Officer', 'Training & Placement Cell', 'Training & Placement Officer',
    { A: 'Placement Outcomes', B: 'Training and Career Readiness', C: 'Industry Relations and Internships', D: 'Data, Systems and Compliance', E: 'Professional Development and Institutional Contribution' },
    [target('A1', 'A', 'Placement of eligible students', 15, 'Marks = 15 × (Placed % ÷ agreed target %), capped at 15. Placed = verified offer letters for registered eligible students.', 'Offer-letter list, company-wise statement', 'Placed %', 'Agreed target %'),
      target('A2', 'A', 'Quality and quantity of offers', 10, 'Core-domain / higher-package / multiple offers and number of companies visited, against agreed target.', 'Offer details and package statement'),
      target('A3', 'A', 'Recruiter base development', 10, 'New recruiters, repeat recruiters and pre-placement agreements against agreed target.', 'Invitations, confirmations, MoUs'),
      rated('B1', 'B', 'Aptitude, soft-skill and technical training', 10, 'Hours delivered, student attendance and assessed outcomes.', 'Schedule, attendance, assessment results'),
      rated('B2', 'B', 'Mock interviews, group discussions, pre-placement talks', 8, 'Sessions completed and students covered.', 'Reports, attendance, feedback'),
      rated('B3', 'B', 'Higher studies, competitive exam and entrepreneurship guidance', 7, 'Documented sessions and students guided.', 'Reports, attendance'),
      target('C1', 'C', 'Internships secured', 8, 'Marks = 8 × (Students placed in internships ÷ agreed target).', 'Internship offer / completion letters', 'Students placed in internships'),
      rated('C2', 'C', 'Industry–institute interaction', 7, 'Guest lectures, industrial visits, industry events with reports.', 'Invitation, report, photographs, attendance'),
      rated('D1', 'D', 'Placement records, database and reports', 8, 'Accuracy and timeliness of placement database and required reports.', 'Submitted reports with dates'),
      rated('D2', 'D', 'Recruiter and student feedback', 4, 'Feedback collected, analysed and acted on.', 'Feedback summary and action taken'),
      rated('D3', 'D', 'Compliance and ethics', 3, 'Transparent registration, no malpractice, grievances closed.', 'Grievance log'),
      rated('E1', 'E', 'Own professional development', 4, 'Relevant training / certification completed.', 'Certificates'),
      rated('E2', 'E', 'Admission outreach and other assigned duties', 6, 'Documented duties assigned by the Principal.', 'Order, report, outcome')],
    [{ id: 'placement_stats', title: 'Annexure 1: Department-wise placement statistics (attach company-wise list)', total: true, columns: [['dept', 'Department'], ['eligible', 'Eligible'], ['registered', 'Registered'], ['placed', 'Placed'], ['placed_pct', 'Placed %'], ['offers', 'Offers'], ['highest', 'Highest package (LPA)'], ['average', 'Average package (LPA)']] },
      { id: 'drives', title: 'Annexure 2: Recruiters and drives', columns: [['company', 'Company'], ['date', 'Date'], ['type', 'Type (New / Repeat)'], ['appeared', 'Students appeared'], ['selected', 'Students selected'], ['remarks', 'Offers / Remarks']] }],
    ['Placement figures matched to offer letters and registered-student list', 'Eligibility and registration data verified', 'Recruiter, MoU and internship records verified', 'Training and mock-interview records (attendance, assessment) verified',
      'Reports and data submitted on time (management / university / accreditation)', 'Feedback collected and action taken', 'Conflicts of interest or shared claims resolved']);

  const PC = support('pc', 'Self-Appraisal Form for Placement Coordinator', '', 'Faculty Placement Coordinator (additional duty)',
    { A: 'Student Mobilisation and Readiness', B: 'Placement Outcomes', C: 'Training Coordination', D: 'Industry Liaison', E: 'Documentation and Reporting' },
    [rated('A1', 'A', 'Registration and eligibility database', 8, 'Complete, accurate and updated student database (eligible, registered, backlogs, higher-study intent).', 'Database extract with dates'),
      target('A2', 'A', 'Student readiness', 7, 'Profiles, resumes and readiness checks completed. Marks = 7 × (Students ready ÷ registered students).', 'Resume / profile records', 'Students ready', 'Registered students'),
      rated('A3', 'A', 'Drive logistics', 5, 'Venue, scheduling, student communication and discipline for drives.', 'Drive reports'),
      target('B1', 'B', 'Placement of eligible students', 15, 'Marks = 15 × (Placed % ÷ agreed target %), capped at 15.', 'Offer letters, company list', 'Placed %', 'Agreed target %'),
      target('B2', 'B', 'Quality of offers', 8, 'Core / higher-package / multiple offers against agreed target.', 'Offer details'),
      rated('B3', 'B', 'Higher studies and entrepreneurship support', 7, 'Students guided and outcomes.', 'Session reports, student list'),
      rated('C1', 'C', 'Aptitude, technical and soft-skill sessions coordinated', 10, 'Sessions arranged, attendance and assessed improvement.', 'Schedule, attendance, results'),
      rated('C2', 'C', 'Mock interviews and group discussions', 10, 'Sessions held and students covered.', 'Reports, feedback'),
      target('D1', 'D', 'Companies brought to campus', 8, 'New and repeat companies against agreed target.', 'Invitation and confirmation'),
      target('D2', 'D', 'Internships facilitated', 7, 'Marks = 7 × (Internships ÷ agreed target).', 'Internship letters', 'Internships'),
      rated('E1', 'E', 'Records and reports', 8, 'Accurate and timely drive, placement and training reports.', 'Submitted reports'),
      rated('E2', 'E', 'Follow-up, feedback and coordination', 7, 'Feedback taken, action followed, coordination with the Placement Officer and HoD.', 'Minutes, feedback summary')],
    [{ id: 'placement_stats', title: 'Annexure 1: Placement statistics', total: true, columns: [['batch', 'Batch / Section'], ['eligible', 'Eligible'], ['registered', 'Registered'], ['appeared', 'Appeared'], ['placed', 'Placed'], ['placed_pct', 'Placed %'], ['offers', 'Offers'], ['higher', 'Higher studies']] },
      { id: 'drives', title: 'Annexure 2: Drives coordinated', columns: [['company', 'Company'], ['date', 'Date'], ['eligible', 'Eligible'], ['appeared', 'Appeared'], ['selected', 'Selected'], ['remarks', 'Remarks']] },
      { id: 'sessions', title: 'Annexure 3: Training / mock sessions coordinated', columns: [['session', 'Session'], ['date', 'Date'], ['resource', 'Resource person'], ['students', 'Students'], ['outcome', 'Assessment outcome']] }],
    ['Student registration and eligibility data verified', 'Drive records (appeared / selected) matched to company records', 'Offer letters verified against claimed placements', 'Training and mock-session attendance and assessments verified',
      'Reports submitted on time', 'Follow-up and feedback records verified', 'Conflicts of interest or shared claims resolved']);

  const LIB = support('librarian', 'Self-Appraisal Form for Librarian', 'Central Library', 'Librarian',
    { A: 'Collection Development and Resources', B: 'Library Services and Utilisation', C: 'Technology and Automation', D: 'Administration and Compliance', E: 'Professional Development and Contribution' },
    [target('A1', 'A', 'Acquisition against requirement', 10, 'Books and journals acquired against department requests and approved budget. Marks = 10 × (Requirements fulfilled ÷ approved requirements).', 'Indents, purchase orders, accession register', 'Requirements fulfilled', 'Approved requirements'),
      rated('A2', 'A', 'E-resources and subscriptions', 8, 'Subscription, renewal and access management of e-journals, e-books and databases.', 'Subscription records, access confirmation'),
      rated('A3', 'A', 'Collection quality and stock verification', 7, 'Accession, weeding, binding and stock verification completed.', 'Stock verification report'),
      target('B1', 'B', 'Library usage', 10, 'Footfall, issue / return and e-resource usage against agreed target.', 'Library software reports'),
      rated('B2', 'B', 'User services', 8, 'Reference, new-arrival display, inter-library and photocopy / scan services, user query handling.', 'Service records'),
      rated('B3', 'B', 'Reading promotion and user orientation', 7, 'Orientation, information-literacy and reading-promotion activities.', 'Reports, attendance'),
      rated('C1', 'C', 'Library automation and digital library', 8, 'Library software, OPAC, barcode / RFID, digital library and repository maintained.', 'System reports, backup record'),
      rated('C2', 'C', 'Research support', 7, 'Support for literature search, citation tools, plagiarism check and indexed-journal data.', 'Service log'),
      rated('D1', 'D', 'Budget, accounts and records', 8, 'Budget utilisation, bills, registers and records maintained.', 'Accounts statements'),
      rated('D2', 'D', 'Statutory and accreditation documentation', 8, 'Library data for AICTE, university, NBA, NAAC and NIRF submitted accurately and on time.', 'Submitted formats'),
      rated('D3', 'D', 'Ambience, discipline and safety', 4, 'Opening hours, cleanliness, discipline, fire and safety checks.', 'Inspection record'),
      rated('E1', 'E', 'Own professional development', 5, 'Training / certification completed.', 'Certificates'),
      rated('E2', 'E', 'Research and repository support', 5, 'Bibliometric support, repository contribution, publication data.', 'Records'),
      rated('E3', 'E', 'Committee and institutional duties', 5, 'Documented duties assigned by the Principal.', 'Order, report')],
    [{ id: 'resources', title: 'Annexure 1: Resources and budget', total: true, columns: [['resource', 'Resource'], ['opening', 'Opening stock'], ['added', 'Added'], ['total', 'Total'], ['allotted', 'Budget allotted (Rs.)'], ['utilised', 'Budget utilised (Rs.)']] },
      { id: 'usage', title: 'Annexure 2: Usage statistics (month-wise, from library software or registers)', columns: [['month', 'Month'], ['footfall', 'Footfall'], ['issued', 'Books issued'], ['returned', 'Books returned'], ['eres', 'E-resource logins / downloads'], ['members', 'New members']] }],
    ['Acquisition records, purchase orders and accession register verified', 'Budget allotted and utilised verified', 'E-resource subscription and access verified', 'Usage statistics checked against library software / registers',
      'Stock verification report verified', 'Accreditation and statutory data verified', 'Conflicts of interest or shared claims resolved']);

  const PD = support('pd', 'Self-Appraisal Form for Physical Director', 'Department of Physical Education', 'Physical Director (Physical Education)',
    { A: 'Physical Education Programme and Participation', B: 'Competitive Performance', C: 'Events and Facilities', D: 'Administration and Compliance', E: 'Professional Development and Contribution' },
    [target('A1', 'A', 'Delivery of physical education and training', 10, 'Scheduled sports, yoga and fitness sessions held and student attendance. Marks = 10 × (Sessions held ÷ scheduled).', 'Timetable, attendance', 'Sessions held', 'Sessions scheduled'),
      target('A2', 'A', 'Student participation', 8, 'Students taking part in sports and intramural activities against agreed target.', 'Enrolment lists', 'Students taking part'),
      rated('A3', 'A', 'Fitness assessment', 7, 'Fitness tests conducted, results recorded and used for programme planning.', 'Assessment records'),
      target('B1', 'B', 'Participation in inter-college and university competitions', 10, 'Teams sent and events entered against agreed target.', 'Entry forms, participation certificates', 'Teams sent / events entered'),
      rated('B2', 'B', 'Achievements', 10, 'Medals, ranks and selections at university, state and national level.', 'Certificates, results'),
      rated('B3', 'B', 'Coaching and talent identification', 5, 'Coaching camps, selection trials and student development.', 'Camp reports, trial lists'),
      rated('C1', 'C', 'Events organised', 8, 'Sports day, intramurals, tournaments, yoga / fitness camps.', 'Approval, schedule, report'),
      rated('C2', 'C', 'Grounds, equipment and gymnasium', 7, 'Maintenance, safe condition and stock register.', 'Stock register, maintenance record'),
      rated('C3', 'C', 'Safety and first aid', 5, 'First-aid readiness, injury records and risk assessment.', 'Injury log, inspection record'),
      rated('D1', 'D', 'Sports budget and records', 7, 'Budget utilisation, entry fees, eligibility and certificate records.', 'Accounts statements'),
      rated('D2', 'D', 'Statutory and accreditation documentation', 4, 'Sports data for university, AICTE, NBA, NAAC and NIRF submitted accurately and on time.', 'Submitted formats'),
      rated('D3', 'D', 'Coordination with departments and student sports council', 4, 'Timely coordination for participation, attendance and permissions.', 'Minutes, circulars'),
      rated('E1', 'E', 'Own professional development', 5, 'Coaching, officiating or sports-science certification.', 'Certificates'),
      rated('E2', 'E', 'Student wellness and discipline initiatives', 5, 'Yoga, wellness and discipline programmes with documented impact.', 'Reports, attendance'),
      rated('E3', 'E', 'Committee and institutional duties', 5, 'Documented duties assigned by the Principal.', 'Order, report')],
    [{ id: 'competitions', title: 'Annexure 1: Competition participation and achievements', columns: [['event', 'Event'], ['level', 'Level (Inter-college / University / State / National)'], ['venue', 'Venue & date'], ['team', 'Students / team'], ['result', 'Result (Medal / Rank)'], ['evidence', 'Evidence ID']] },
      { id: 'participation', title: 'Annexure 2: Participation statistics', total: true, columns: [['sport', 'Sport / Activity'], ['boys', 'Boys'], ['girls', 'Girls'], ['total', 'Total'], ['teams', 'Teams']] },
      { id: 'facilities', title: 'Annexure 3: Facilities and equipment', columns: [['facility', 'Facility / Equipment'], ['condition', 'Condition'], ['work', 'Maintenance / purchase done'], ['date', 'Date']] }],
    ['Participation and attendance records verified', 'Fitness assessment records verified', 'Competition entries, results and certificates verified', 'Event reports and approvals verified',
      'Equipment stock register and facility condition verified', 'Injury, first-aid and safety records verified', 'Conflicts of interest or shared claims resolved']);

  const FORMS = { hod: HOD, vp: LEADER('vp'), principal: LEADER('principal'), po: PO, pc: PC, librarian: LIB, pd: PD };
  const api = { FORMS };
  if (typeof module !== 'undefined') module.exports = api; else root.FORMS = api;
})(typeof window !== 'undefined' ? window : globalThis);
