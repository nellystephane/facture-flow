const { buildBuckets, bucketKey, pickGroupBy, resolveRange, computeAnalytics, catalog } = require('../utils/analyticsCore');

describe('analyticsCore', () => {
  test('découpe par mois sans trou', () => {
    const keys = buildBuckets(new Date('2026-01-15T10:00:00Z'), new Date('2026-04-02T10:00:00Z'), 'month');
    expect(keys).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });

  test('la semaine commence le lundi', () => {
    expect(bucketKey(new Date('2026-11-18T10:00:00Z'), 'week')).toBe('2026-11-16');
  });

  test('un paiement à 23h30 UTC tombe le jour suivant à l’heure du Bénin', () => {
    expect(bucketKey(new Date('2026-03-31T23:30:00Z'), 'month')).toBe('2026-04');
  });

  test('choix automatique du regroupement', () => {
    expect(pickGroupBy(new Date('2026-11-01'), new Date('2026-11-20'))).toBe('day');
    expect(pickGroupBy(new Date('2026-09-01'), new Date('2026-11-20'))).toBe('week');
    expect(pickGroupBy(new Date('2026-01-01'), new Date('2026-11-20'))).toBe('month');
    expect(pickGroupBy(new Date('2025-01-01'), new Date('2026-11-20'), 'day')).toBe('week');
  });

  test('période custom invalide ou trop longue refusée', () => {
    expect(resolveRange({ period: 'custom', from: '2026-05-01', to: '2026-01-01' })).toBeNull();
    expect(resolveRange({ period: 'custom', from: '2020-01-01', to: '2026-01-01' })).toBeNull();
    expect(resolveRange({ period: '6m' }, new Date('2026-11-17T10:00:00Z'))).toBeTruthy();
  });

  test('séries : encaissements, dépenses, bénéfice, impayés', () => {
    const range = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-30T00:00:00Z') };
    const inv = (id, statut, date, prix) => ({ _id: id, statut, dateEmission: new Date(date), items: [{ quantite: 1, prixUnitaire: prix }], tva: 0, remise: 0, client: 'c1' });
    const data = {
      invoices: [inv('a', 'payee', '2026-10-05T10:00:00Z', 10000), inv('b', 'envoyee', '2026-11-05T10:00:00Z', 8000), inv('c', 'brouillon', '2026-11-06T10:00:00Z', 999)],
      openInvoices: [],
      payments: [{ date: new Date('2026-10-06T10:00:00Z'), montant: 10000, methode: 'mtn_money' }, { date: new Date('2026-11-07T10:00:00Z'), montant: 3000, montantFacture: 3000, methode: 'especes' }],
      expenses: [{ date: new Date('2026-11-08T10:00:00Z'), montant: 2000, categorie: 'loyer' }],
      clients: [], quotes: [], clientNames: { c1: 'Awa' }, paidByInvoice: { b: 3000 },
    };
    const r = computeAnalytics({ metrics: ['encaissements', 'depenses', 'benefice', 'impayes', 'nb_factures', 'repartition_methodes', 'top_clients', 'repartition_statuts'], range, groupBy: 'month', data });
    const get = (id) => r.series.find((s) => s.id === id);
    expect(r.buckets).toEqual(['2026-10', '2026-11']);
    expect(get('encaissements').values).toEqual([10000, 3000]);
    expect(get('depenses').values).toEqual([0, 2000]);
    expect(get('benefice').values).toEqual([10000, 1000]);
    expect(get('impayes').values).toEqual([0, 5000]); // 8000 - 3000 déjà payés
    expect(get('nb_factures').total).toBe(2); // brouillon exclu
    expect(r.breakdowns.find((b) => b.id === 'repartition_methodes').items).toEqual([
      { label: 'MTN Money', value: 10000 }, { label: 'Espèces', value: 3000 },
    ]);
    expect(r.breakdowns.find((b) => b.id === 'top_clients').items).toEqual([{ label: 'Awa', value: 10000 }]);
    expect(r.breakdowns.find((b) => b.id === 'repartition_statuts').total).toBe(3);
  });

  test('ancienneté des impayés', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const mk = (id, ech, prix) => ({ _id: id, statut: 'envoyee', dateEcheance: ech && new Date(ech), items: [{ quantite: 1, prixUnitaire: prix }], tva: 0 });
    const r = computeAnalytics({
      metrics: ['anciennete_creances'], now,
      range: { from: new Date('2026-11-01'), to: new Date('2026-11-30') }, groupBy: 'day',
      data: { openInvoices: [mk('1', '2026-12-01', 1000), mk('2', '2026-11-10', 2000), mk('3', '2026-09-01', 4000), mk('4', null, 500)], paidByInvoice: { 3: 1000 } },
    });
    expect(r.breakdowns[0].items).toEqual([
      { label: 'Pas encore échu', value: 1500 },
      { label: 'En retard de 1 à 30 jours', value: 2000 },
      { label: 'En retard de plus de 60 jours', value: 3000 },
    ]);
  });

  test('catalogue : les mesures avancées sont verrouillées au plan gratuit', () => {
    const c = catalog(false);
    expect(c.find((m) => m.id === 'encaissements').locked).toBe(false);
    expect(c.find((m) => m.id === 'benefice').locked).toBe(true);
    expect(catalog(true).every((m) => !m.locked)).toBe(true);
  });
});
