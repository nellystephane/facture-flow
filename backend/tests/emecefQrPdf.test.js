const { drawPaymentQr } = require('../utils/qrcode/qrPdf');

function makePdfMock() {
  return {
    links: [],
    save() { return this; },
    restore() { return this; },
    rect() { return this; },
    fill() { return this; },
    fillColor() { return this; },
    link(...args) { this.links.push(args); return this; },
  };
}

test('dessine un QR fiscal DGI sans créer de lien PDF sur le contenu F;...', () => {
  const pdf = makePdfMock();
  drawPaymentQr(pdf, 'F;IN01000005;X537E4DBAJUUHHXNFWISFEKJ;9999900000001;20201123131708', 20, 20, 80);
  expect(pdf.links).toHaveLength(0);
});

test('conserve le lien cliquable pour le QR de paiement HTTP(S)', () => {
  const pdf = makePdfMock();
  drawPaymentQr(pdf, 'https://example.test/payer/abc', 20, 20, 80);
  expect(pdf.links).toHaveLength(1);
  expect(pdf.links[0][4]).toBe('https://example.test/payer/abc');
});
