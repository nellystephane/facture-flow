const { summarizeClient } = require('../utils/clientHistory');

const inv = (id, statut, em, ech, prix) => ({
  _id: id, numero: `F${id}`, statut, dateEmission: new Date(em), dateEcheance: ech ? new Date(ech) : null,
  items: [{ quantite: 1, prixUnitaire: prix }], tva: 0,
});

describe('clientHistory', () => {
  const now = new Date('2026-11-20T10:00:00Z');

  test('totaux, reste et délai moyen', () => {
    const r = summarizeClient({
      now,
      invoices: [inv('1', 'payee', '2026-09-01', '2026-09-15', 1000), inv('2', 'payee', '2026-09-10', '2026-09-20', 2000), inv('3', 'envoyee', '2026-10-01', '2026-10-10', 4000), inv('4', 'brouillon', '2026-10-02', null, 9999)],
      payments: [
        { invoice: '1', date: new Date('2026-09-10'), montant: 1000 },
        { invoice: '2', date: new Date('2026-09-18'), montant: 2000 },
        { invoice: '3', date: new Date('2026-10-05'), montant: 1500 },
      ],
    });
    expect(r.nombreFactures).toBe(3);
    expect(r.totalFacture).toBe(7000);
    expect(r.totalPaye).toBe(4500);
    expect(r.totalReste).toBe(2500);
    expect(r.nombreEnRetard).toBe(1);
    expect(r.delaiMoyenJours).toBe(9);
    expect(r.fiabilite).toBe('moyenne');
  });

  test('client sans historique = nouveau', () => {
    expect(summarizeClient({ now, invoices: [], payments: [] }).fiabilite).toBe('nouveau');
  });

  test('retards répétés = à surveiller', () => {
    const r = summarizeClient({ now, invoices: [inv('1', 'envoyee', '2026-08-01', '2026-08-10', 1000), inv('2', 'en_retard', '2026-08-05', '2026-08-15', 1000)], payments: [] });
    expect(r.fiabilite).toBe('a_surveiller');
  });
});
