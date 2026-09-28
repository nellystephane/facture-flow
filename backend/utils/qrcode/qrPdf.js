const QRCode = require('./index');
const QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

/**
 * Draw a QR code directly into a PDFKit document.
 * The encoded payload is intentionally only the public payment URL: invoice
 * data is resolved server-side from the public token when the page opens.
 */
function drawPaymentQr(pdf, text, x, y, size = 96) {
  if (!text) return;

  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 4;
  const moduleSize = size / (count + quiet * 2);
  const actualSize = moduleSize * (count + quiet * 2);

  // White quiet-zone so the code remains scannable on every template.
  pdf.save();
  pdf.rect(x, y, actualSize, actualSize).fill('#ffffff');
  pdf.fillColor('#000000');
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        pdf.rect(
          x + (col + quiet) * moduleSize,
          y + (row + quiet) * moduleSize,
          moduleSize + 0.08,
          moduleSize + 0.08
        ).fill();
      }
    }
  }
  pdf.restore();

  // Make the whole QR clickable in PDF viewers as a convenience.
  pdf.link(x, y, actualSize, actualSize, text);
  return actualSize;
}

module.exports = { drawPaymentQr };
