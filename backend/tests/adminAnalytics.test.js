const { computeAdminAnalytics, adminCatalog } = require('../utils/adminAnalytics');

describe('adminAnalytics', () => {
  const range = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-30T00:00:00Z') };
  test('séries et répartitions', () => {
    const r = computeAdminAnalytics({
      metrics: ['nouveaux_comptes', 'revenu_abonnements', 'comptes_par_plan', 'revenu_par_plan', 'reversements', 'tickets_par_statut'],
      range, groupBy: 'month',
      data: {
        users: [{ createdAt: new Date('2026-10-03T10:00:00Z') }, { createdAt: new Date('2026-11-04T10:00:00Z') }, { createdAt: new Date('2026-11-05T10:00:00Z') }],
        subscriptions: [{ createdAt: new Date('2026-10-10T10:00:00Z'), montant: 3500, plan: 'pro', duree: '1mois' }, { createdAt: new Date('2026-11-10T10:00:00Z'), montant: 6000, plan: 'business', duree: '1mois' }],
        planCounts: [{ _id: 'gratuit', count: 10 }, { _id: 'pro', count: 2 }],
        payouts: [{ createdAt: new Date('2026-11-12T10:00:00Z'), statut: 'sent', montantTransfere: 5000 }, { createdAt: new Date('2026-11-13T10:00:00Z'), statut: 'failed', montant: 999 }],
        tickets: [{ createdAt: new Date('2026-11-01T10:00:00Z'), statut: 'nouveau' }],
      },
    });
    const s = (id) => r.series.find((x) => x.id === id);
    expect(s('nouveaux_comptes').values).toEqual([1, 2]);
    expect(s('revenu_abonnements').values).toEqual([3500, 6000]);
    expect(s('reversements').values).toEqual([0, 5000]);
    expect(r.breakdowns.find((b) => b.id === 'comptes_par_plan').items).toEqual([{ label: 'Gratuit', value: 10 }, { label: 'Pro', value: 2 }]);
    expect(r.breakdowns.find((b) => b.id === 'revenu_par_plan').items[0]).toEqual({ label: 'Business', value: 6000 });
    expect(r.breakdowns.find((b) => b.id === 'tickets_par_statut').items).toEqual([{ label: 'Nouveau', value: 1 }]);
  });
  test('catalogue sans verrou', () => { expect(adminCatalog().every((m) => !m.locked)).toBe(true); });
});
