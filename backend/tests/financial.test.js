const { calculateClientCharge, estimatePayinFee } = require('../utils/financial');

describe('Calculs financiers Oryxa', () => {
  it('résout correctement les frais lorsque le client les supporte', () => {
    const total = calculateClientCharge(9000, 1.8, 150);
    expect(total).toBe(9318);
    expect(estimatePayinFee(total, 1.8)).toBe(168);
  });

  it('ne dépasse jamais 100 % de taux Pay-in', () => {
    expect(() => calculateClientCharge(9000, 100, 150)).toThrow();
  });
});
