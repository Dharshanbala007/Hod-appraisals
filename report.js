// The report of a review list as a PDF (A4 landscape): college letterhead, title, summary, one row per appraisal with its self, final and
// change and its weaker / stronger sections, page numbers and a signature line. Same look as the staff site's appraisal PDF (pdfkit).
const PDFKit = require('pdfkit'), path = require('path');
const HEADER = path.join(__dirname, 'public', 'college-header.png');
const PW = 841.89, PH = 595.28, L = 32, W = PW - 2 * L, BOTTOM = PH - 40;
// the built-in PDF fonts know only Western characters: write the few others the site uses as plain ones
const plain = s => String(s ?? '').replace(/[−–—]/g, m => (m === '−' ? '-' : '–')).replace(/→/g, '->').replace(/[^\n\x20-\x7E\xA0-\xFF–‘’“”•…]/g, '?');
const r1 = x => Math.round(x * 10) / 10, sign = n => (n > 0 ? '+' + r1(n) : n < 0 ? '-' + r1(-n) : '0');

// r = { title, subtitle, by, summary: [[label, value]...], note, rows: [{ code, name, designation, status, self, final, weak: [..], strong: [..] }] }
// (self = null: not submitted yet)
function buildReport(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: 'A4', layout: 'landscape', margin: L, bufferPages: true, info: { Title: plain(r.title), Author: plain(r.by) } }), bufs = [];
    doc.on('data', b => bufs.push(b)); doc.on('end', () => resolve(Buffer.concat(bufs))); doc.on('error', reject);

    // letterhead, title, summary boxes
    const hh = 78, hw = hh * 1600 / 391;
    doc.image(HEADER, (PW - hw) / 2, 22, { width: hw });
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#000').text(plain(r.title), L, 22 + hh + 8, { width: W, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#444').text(plain(r.subtitle), L, doc.y + 2, { width: W, align: 'center' }).fillColor('#000');
    const by = doc.y + 10, bw = W / r.summary.length;
    r.summary.forEach(([label, value], i) => {
      const x = L + i * bw; doc.rect(x + 2, by, bw - 4, 40).fillAndStroke('#f3f6fb', '#c9d3e3');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text(plain(value), x + 2, by + 6, { width: bw - 4, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#444').text(plain(label), x + 2, by + 25, { width: bw - 4, align: 'center' }).fillColor('#000');
    });
    doc.y = by + 52;

    // the table: header repeated on every page, rows never split
    const cols = [['#', 22, 'center'], ['Code', 62], ['Name', 128], ['Status', 70], ['Self', 38, 'right'], ['Final', 38, 'right'], ['Change', 44, 'right'], ['Weaker section', 184], ['Stronger section', 184]];
    const scale = W / cols.reduce((s, c) => s + c[1], 0), w = cols.map(c => c[1] * scale), pad = 4;
    const height = cells => Math.max(18, ...cells.map((c, i) => doc.heightOfString(c, { width: w[i] - 2 * pad }) + 2 * pad));
    const drawRow = (cells, { head = false, shade = false } = {}) => {
      doc.font(head ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      const h = height(cells);
      if (!head && doc.y + h > BOTTOM) { doc.addPage(); doc.y = L; drawRow(cols.map(c => c[0]), { head: true }); doc.font('Helvetica').fontSize(8.5); }
      const y = doc.y; let x = L;
      cells.forEach((c, i) => {
        doc.rect(x, y, w[i], h).fillAndStroke(head ? '#1f4e8c' : shade ? '#f5f5f3' : '#ffffff', '#b9b8b2');
        doc.fillColor(head ? '#ffffff' : '#000').text(c, x + pad, y + pad, { width: w[i] - 2 * pad, align: cols[i][2] || 'left' });
        x += w[i];
      });
      doc.y = y + h;
    };
    const secs = xs => (xs.length ? xs.slice(0, 4).map(s => `${s.code} ${s.title} (${r1(s.marks)}/${s.max})`).join('\n') + (xs.length > 4 ? `\n+${xs.length - 4} more` : '') : '-');
    drawRow(cols.map(c => c[0]), { head: true });
    if (!r.rows.length) drawRow(['', '', 'No appraisals in this list.', '', '', '', '', '', '']);
    r.rows.forEach((x, k) => drawRow([String(k + 1), x.code, x.name + (x.designation ? '\n' + x.designation : ''), x.status,
      ...(x.self == null ? ['-', '-', '-', 'Not submitted yet', ''] : [String(r1(x.self)), String(r1(x.final)), sign(x.final - x.self), secs(x.weak), secs(x.strong)])].map(plain), { shade: k % 2 === 1 }));

    // note and signature
    if (doc.y + 90 > BOTTOM) { doc.addPage(); doc.y = L; }
    doc.font('Helvetica').fontSize(8).fillColor('#444').text(plain(r.note), L, doc.y + 8, { width: W }).fillColor('#000');
    const sy = doc.y + 34;
    doc.moveTo(PW - L - 220, sy).lineTo(PW - L, sy).stroke('#000');
    doc.font('Helvetica').fontSize(9).text(plain(r.by), PW - L - 220, sy + 4, { width: 220, align: 'center' });
    doc.fontSize(8).fillColor('#444').text('Signature and date', PW - L - 220, sy + 16, { width: 220, align: 'center' }).fillColor('#000');

    // page numbers
    const n = doc.bufferedPageRange().count;
    for (let i = 0; i < n; i++) {
      doc.switchToPage(i); doc.page.margins.bottom = 0;   // the footer sits below the margin: no new page for it
      doc.font('Helvetica').fontSize(7.5).fillColor('#666').text(plain(`NSCET Faculty Appraisal ${r.year} · ${r.title}`), L, PH - 26, { width: W / 2, lineBreak: false })
        .text(`Page ${i + 1} of ${n}`, L + W / 2, PH - 26, { width: W / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { buildReport, plain };
