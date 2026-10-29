// The analytics dashboard as a PDF (A4 portrait): college letterhead, title, then the same cards as on the screen – statistic tiles, column
// and bar charts, the department x section grid in its band colours – each card kept whole on one page, as many pages as needed.
const PDFKit = require('pdfkit'), path = require('path');
const C = require('./public/config.js'), { plain } = require('./report.js');
const HEADER = path.join(__dirname, 'public', 'college-header.png');
const PW = 595.28, PH = 841.89, L = 34, W = PW - 2 * L, BOTTOM = PH - 40, PAD = 12, IW = W - 2 * PAD;
const BLUE = '#2a78d6', ORANGE = '#eb6834', TRACK = '#eef3fb', INK = '#0a0a0a', MUTED = '#52514e', LINE = '#d9d8d3';
const STAGES = [['not started', 'Not started', '#c7c6c0'], ['draft', 'Being filled', '#fab219'], ['submitted', 'Submitted', BLUE], ['proceeded', 'Proceeded by HoD', '#6250d6'], ['finalised', 'Finalised', '#0ca30c']];
const r1 = x => (x == null ? '-' : String(Math.round(x * 10) / 10)), pct = x => (x == null ? '-' : Math.round(x) + '%');

function buildDashboard(D, o) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: 'A4', margins: { top: L, left: L, right: L, bottom: 12 }, bufferPages: true, info: { Title: plain(o.title) } }), bufs = [];
    doc.on('data', b => bufs.push(b)); doc.on('end', () => resolve(Buffer.concat(bufs))); doc.on('error', reject);
    // one line of text, shortened with an ellipsis when it is wider than its box (the page breaks are made here, never by the PDF library)
    const fit = (s, w) => { s = plain(s); if (doc.widthOfString(s) <= w) return s; while (s.length > 1 && doc.widthOfString(s + '…') > w) s = s.slice(0, -1); return s + '…'; };
    const txt = (s, x, y, { ellipsis, ...opt } = {}) => doc.text(opt.width ? fit(s, opt.width) : plain(s), x, y, { lineBreak: false, ...opt });
    const font = (size, bold = false, color = INK) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);

    // letterhead and title
    const hh = 64, hw = hh * 1600 / 391;
    doc.image(HEADER, (PW - hw) / 2, 20, { width: hw });
    font(15, true); doc.text(plain(o.title), L, 20 + hh + 8, { width: W, align: 'center' });
    font(8.5, false, MUTED); doc.text(plain(o.subtitle), L, doc.y + 2, { width: W, align: 'center' });
    doc.y += 10;

    // a card kept whole: moves to a new page when it does not fit; body(x, y) draws inside and returns the height it used
    const card = (title, height, body) => {
      if (doc.y + height + 34 > BOTTOM) { doc.addPage(); doc.y = L; }
      const y0 = doc.y; font(11, true); txt(title, L + PAD, y0 + 10, { width: IW });
      const used = body(L + PAD, y0 + 30);
      doc.roundedRect(L, y0, W, used + 40, 6).lineWidth(0.7).stroke(LINE);
      doc.y = y0 + used + 50;
    };
    const tiles = items => {   // [[value, label, share?]]
      if (doc.y + 56 > BOTTOM) { doc.addPage(); doc.y = L; }
      const y = doc.y, gap = 8, bw = (W - gap * (items.length - 1)) / items.length;
      items.forEach(([v, label, share], i) => {
        const x = L + i * (bw + gap); doc.roundedRect(x, y, bw, 50, 6).lineWidth(0.7).stroke(LINE);
        font(16, true); txt(v ?? '-', x + 10, y + 8, { width: bw - 20 });
        font(7.5, false, MUTED); txt(label, x + 10, y + 28, { width: bw - 20, ellipsis: true });
        if (share != null) { doc.rect(x + 10, y + 40, bw - 20, 4).fill(TRACK); doc.rect(x + 10, y + 40, (bw - 20) * Math.max(0, Math.min(1, share / 100)), 4).fill(BLUE); }
      });
      doc.y = y + 62;
    };
    // horizontal bars: [{ label, share (0-100), text }]
    const hbars = (items, x, y, labelW = IW * 0.45) => {
      const valW = 92, barW = IW - labelW - valW - 12;
      items.forEach((it, i) => {
        const yy = y + i * 16; font(8.5); txt(it.label, x, yy + 2, { width: labelW, ellipsis: true });
        doc.rect(x + labelW + 6, yy + 4, barW, 7).fill(TRACK);
        if (it.share > 0) doc.rect(x + labelW + 6, yy + 4, barW * Math.min(1, it.share / 100), 7).fill(it.color || BLUE);
        font(8.5, false, MUTED); txt(it.text, x + labelW + barW + 12, yy + 2, { width: valW });
      });
      return items.length * 16;
    };
    // a column chart: [{ label, value (0-max), text }] with an optional dashed reference line; returns its height
    const columns = (items, x, y, { max = 100, ref = null, refText = '' } = {}) => {
      const H = 130, base = y + H - 18, top = y + 14, slot = IW / items.length, bw = Math.min(34, slot * 0.55), yv = v => base - (base - top) * Math.min(v || 0, max) / max;
      for (const f of [0.25, 0.5, 0.75, 1]) doc.moveTo(x, yv(max * f)).lineTo(x + IW, yv(max * f)).lineWidth(0.5).stroke('#efeeea');
      doc.moveTo(x, base).lineTo(x + IW, base).lineWidth(0.7).stroke('#bdbcb6');
      items.forEach((it, i) => {
        const cx = x + slot * i + slot / 2, t = yv(it.value), h = base - t;
        if (h > 0.5) { doc.roundedRect(cx - bw / 2, t, bw, h, Math.min(3, h / 2)).fill(BLUE); doc.rect(cx - bw / 2, t + h / 2, bw, h / 2).fill(BLUE); }   // rounded at the top only
        font(8, true); txt(it.text, cx - slot / 2, t - 11, { width: slot, align: 'center' });
        font(8, false, MUTED); txt(it.label, cx - slot / 2, base + 5, { width: slot, align: 'center' });
      });
      let h = H;
      if (ref != null) {
        doc.moveTo(x, yv(ref)).lineTo(x + IW, yv(ref)).lineWidth(1).dash(4, { space: 3 }).stroke(MUTED).undash();
        doc.moveTo(x, y + H + 8).lineTo(x + 18, y + H + 8).lineWidth(1).dash(4, { space: 3 }).stroke(MUTED).undash();
        font(8, false, MUTED); txt(refText, x + 24, y + H + 4); h += 16;
      }
      return h;
    };
    // a key under a chart: [[code, text]] in columns
    const key = (pairs, x, y, cols = 2) => {
      const cw = IW / cols, rows = Math.ceil(pairs.length / cols);
      pairs.forEach(([k, t], i) => { const cx = x + Math.floor(i / rows) * cw, cy = y + (i % rows) * 12; font(7.5, true); txt(k, cx, cy, { width: 22 }); font(7.5, false, MUTED); txt(t, cx + 22, cy, { width: cw - 26, ellipsis: true }); });
      return rows * 12;
    };
    const keyH = (n, cols = 2) => Math.ceil(n / cols) * 12;
    const table = (head, widths, rows, x, y) => {   // widths as fractions of IW
      const w = widths.map(f => f * IW); let yy = y;
      const row = (cells, bold) => { let xx = x; font(8, bold, bold ? MUTED : INK); cells.forEach((c, i) => { txt(c ?? '-', xx + 2, yy + 3, { width: w[i] - 4, ellipsis: true }); xx += w[i]; }); doc.moveTo(x, yy + 15).lineTo(x + IW, yy + 15).lineWidth(0.5).stroke('#ecebe7'); yy += 16; };
      row(head, true); rows.forEach(r => row(r, false));
      return yy - y;
    };

    if (D.scope === 'dept' && !D.count || D.scope === 'college' && !D.count) {
      card(D.scope === 'dept' ? D.dept : 'Whole college', 20, (x, y) => { font(9, false, MUTED); txt('No submitted appraisals yet.', x, y); return 14; });
    } else if (D.scope === 'dept') {
      tiles([[String(D.count), `submitted appraisals in ${D.dept}`], [r1(D.self), 'average self score (out of 100)', D.self], [r1(D.final), 'average final score after review', D.final]]);
      card('Domain-wise average (% of the maximum)', 130 + keyH(5), (x, y) => columns(D.domains.map(d => ({ label: d.key, value: d.share, text: pct(d.share) })), x, y)
        + 6 + key(D.domains.map(d => [d.key, `${d.title} (${r1(d.avg)} / ${d.max})`]), x, y + 136));
      const sw = [...D.strongest.map(s => ['Strongest', '#0ca30c', s]), ...D.weakest.map(s => ['Weakest', '#fab219', s])];
      card('Strongest and weakest sections', Math.max(1, sw.length) * 26, (x, y) => {
        if (!sw.length) { font(9, false, MUTED); txt('All sections are level.', x, y); return 14; }
        sw.forEach(([what, color, s], i) => { const yy = y + i * 26; doc.rect(x, yy, 3, 22).fill(color); font(14, true); txt(pct(s.share), x + 10, yy + 3, { width: 50 });
          font(7.5, false, MUTED); txt(what, x + 64, yy, { width: 80 }); font(9, true); txt(`${s.code} ${s.title}`, x + 64, yy + 10, { width: IW - 200, ellipsis: true }); font(8, false, MUTED); txt(`${r1(s.avg)} of ${s.max} marks on average`, x + IW - 130, yy + 10, { width: 130, align: 'right' }); });
        return sw.length * 26;
      });
      card('Section-wise average (% of the maximum)', 130 + keyH(D.sections.length), (x, y) => columns(D.sections.map(s => ({ label: s.code, value: s.share, text: pct(s.share) })), x, y)
        + 6 + key(D.sections.map(s => [s.code, `${s.title} (${r1(s.avg)} / ${s.max})`]), x, y + 136));
      const removed = D.sections.filter(s => s.removed);
      card('Sections removed (nothing to claim)', removed.length ? removed.length * 16 : 14, (x, y) => removed.length
        ? hbars(removed.map(s => ({ label: `${s.code} ${s.title}`, share: s.removed / D.count * 100, text: `${s.removed} of ${D.count} staff` })), x, y)
        : (font(9, false, MUTED), txt('No staff member removed a section: every section was claimed.', x, y), 14));
      const dMax = Math.max(...D.designations.map(d => d.count));
      card('Designation-wise', D.designations.length * 16, (x, y) => hbars(D.designations.map(d => ({ label: d.name, share: d.count / dMax * 100, text: `${d.count} staff · avg ${r1(d.final)}` })), x, y));
      card('University results (A1)', 46, (x, y) => {
        if (D.results.passPct == null) { font(9, false, MUTED); txt('No university results given yet.', x, y); return 14; }
        font(24, true); txt(`${D.results.passPct}%`, x, y); doc.rect(x, y + 30, IW, 8).fill(TRACK); doc.rect(x, y + 30, IW * Math.min(1, D.results.passPct / 100), 8).fill(BLUE);
        font(8, false, MUTED); txt(`average pass % of the subjects handled, from ${D.results.staff} staff member${D.results.staff > 1 ? 's' : ''}`, x, y + 42); return 52;
      });
      const days = (D.work.find(w => w.label === 'FDP / STTP days') || {}).value || 0, work = D.work.filter(w => w.label !== 'FDP / STTP days').sort((a, b) => b.value - a.value), wMax = Math.max(1, ...work.map(w => w.value));
      card('Work done (entries in the appraisals)', work.length * 16, (x, y) => hbars(work.map(w => ({ label: w.label, share: w.value / wMax * 100, text: w.label === 'FDP / STTP attended' ? `${w.value} · ${days} days` : String(w.value) })), x, y));
    } else {
      tiles([[String(D.count), 'submitted staff appraisals'], [r1(D.self), 'average self score (out of 100)', D.self], [r1(D.final), 'average final score after review', D.final],
        [`${D.ranking.length} / ${C.DEPARTMENTS.length}`, 'departments with submissions', D.ranking.length / C.DEPARTMENTS.length * 100]]);
      card('Department ranking (average final score)', 146, (x, y) => columns(D.ranking.map(d => ({ label: d.dept, value: d.final, text: r1(d.final) })), x, y, { ref: D.final, refText: `college average ${r1(D.final)}` }));
      const big = Math.max(1, ...D.ranking.map(d => Math.abs(d.vsCollege || 0)));
      card(`Compared with the college average (${r1(D.final)})`, 14 + D.ranking.length * 16, (x, y) => {
        font(8, false, MUTED); txt('Blue = above the average, orange = below.', x, y);
        const labelW = 80, valW = 90, half = (IW - labelW - valW - 12) / 2, mid = x + labelW + 6 + half;
        D.ranking.forEach((d, i) => { const yy = y + 14 + i * 16, v = d.vsCollege || 0, w = half * Math.abs(v) / big; font(8.5); txt(d.dept, x, yy + 2, { width: labelW });
          if (v) doc.rect(v > 0 ? mid : mid - w, yy + 4, w, 7).fill(v > 0 ? BLUE : ORANGE);
          doc.moveTo(mid, yy + 2).lineTo(mid, yy + 13).lineWidth(0.7).stroke('#9a9993');
          font(8.5, false, MUTED); txt(`${v > 0 ? '+' : ''}${r1(v)} ${v > 0 ? 'above' : v < 0 ? 'below' : ''}`, x + labelW + 2 * half + 18, yy + 2, { width: valW }); });
        return 14 + D.ranking.length * 16;
      });
      card('Top 10 staff (final score out of 100)', D.top.length * 16, (x, y) => hbars(D.top.map(t => ({ label: `${t.rank}. ${t.name} (${t.dept})`, share: t.final, text: r1(t.final) })), x, y));
      const depts = D.depts.filter(d => d.count), n = D.sections.length;
      card('Department × section (% of the maximum)', (depts.length + 1) * 18 + 24 + keyH(n), (x, y) => {
        const dw = 70, cw = (IW - dw) / n; font(8, true, MUTED); txt('Department', x, y + 4, { width: dw });
        D.sections.forEach((s, i) => txt(s.code, x + dw + i * cw, y + 4, { width: cw, align: 'center' }));
        depts.forEach((d, r) => {
          const yy = y + 18 + r * 18; font(8.5); txt(`${d.dept} (${d.count})`, x, yy + 5, { width: dw });
          d.sections.forEach((v, i) => { const cx = x + dw + i * cw;
            if (v == null) { font(8, false, MUTED); txt('-', cx, yy + 5, { width: cw, align: 'center' }); return; }
            const b = C.heatOf(v); doc.rect(cx + 1, yy + 1, cw - 2, 16).fill(b.color); font(8, true, b.ink); txt(String(Math.round(v)), cx, yy + 5, { width: cw, align: 'center' }); });
        });
        let yy = y + 18 + depts.length * 18 + 8, xx = x;
        C.HEAT.forEach((b, i) => { const lab = `${['0-19', '20-39', '40-59', '60-79', '80-100'][i]}% ${b.label}`; doc.rect(xx, yy, 9, 9).fill(b.color); font(7.5, false, MUTED); txt(lab, xx + 12, yy + 1); xx += doc.widthOfString(plain(lab)) + 26; });
        return 18 + depts.length * 18 + 24 + key(D.sections.map(s => [s.code, s.title]), x, yy + 16);
      });
      card('Domain-wise average for the college (% of the maximum)', 130 + keyH(5), (x, y) => columns(D.domains.map(d => ({ label: d.key, value: d.share, text: pct(d.share) })), x, y)
        + 6 + key(D.domains.map(d => [d.key, `${d.title} (${r1(d.avg)} / ${d.max})`]), x, y + 136));
      const L2 = D.leaders, parts = STAGES.map(([k, l, c]) => [l, c, L2.filter(x => x.status === k).length]).filter(p => p[2]);
      card('HoD, Vice Principal, Principal and officer appraisals', 34 + (L2.length + 1) * 16, (x, y) => {
        let xx = x; parts.forEach(([, c, k]) => { const w = IW * k / L2.length; doc.rect(xx, y, Math.max(0, w - 2), 9).fill(c); xx += w; });
        xx = x; parts.forEach(([l, c, k]) => { const lab = `${l} ${k}`; doc.rect(xx, y + 15, 8, 8).fill(c); font(7.5, false, MUTED); txt(lab, xx + 11, y + 15); xx += doc.widthOfString(plain(lab)) + 24; });
        return 34 + table(['Role', 'Name', 'Department', 'Status', 'Self', 'Final'], [0.2, 0.32, 0.13, 0.17, 0.09, 0.09],
          L2.map(l => [l.role, `${l.name} (${l.username})`, l.dept || '-', (STAGES.find(s => s[0] === l.status) || [, l.status])[1], l.self == null ? '-' : r1(l.self), l.final == null ? '-' : r1(l.final)]), x, y + 34);
      });
    }

    // page numbers
    const pages = doc.bufferedPageRange().count;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i); doc.page.margins.bottom = 0;
      font(7.5, false, '#666'); txt(`NSCET Faculty Appraisal ${o.year} · ${o.title}`, L, PH - 24, { width: W / 2 });
      txt(`Page ${i + 1} of ${pages}`, L + W / 2, PH - 24, { width: W / 2, align: 'right' });
    }
    doc.end();
  });
}

module.exports = { buildDashboard };
