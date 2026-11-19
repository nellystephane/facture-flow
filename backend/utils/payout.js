const crypto = require('crypto');
const User = require('../models/User');
const Payout = require('../models/Payout');
const fedapay = require('./fedapay');
const { getWalletBalance, payoutFeeForAmount, roundXof, createLedgerEntryOnce } = require('./financial');
const PlatformSettings = require('../models/PlatformSettings');

const ACTIVE = ['pending', 'started', 'processing'];
// Un reversement resté « pending » sans appel /start au-delà de ce délai est
// considéré comme abandonné (crash serveur, erreur avant démarrage).
const STALE_BEFORE_START_MS = 10 * 60 * 1000;

function normalizePayoutStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'scheduled') return 'processing';
  if (['pending', 'started', 'processing', 'sent', 'failed'].includes(s)) return s;
  return 'processing';
}

function applyRemote(payout, remote) {
  payout.fedapayStatus = remote.status || payout.fedapayStatus || '';
  payout.fedapayReference = remote.reference || payout.fedapayReference || '';
  payout.fraisFedaPay = roundXof(remote.fees || remote.fixed_commission || 0);
  payout.commissionFedaPay = roundXof(remote.commission || 0);
  payout.montantTransfere = roundXof(remote.amount_transferred || remote.amount || 0);
  payout.montantDebite = roundXof(remote.amount_debited || 0);
  if (payout.montantTransfere > 0) payout.montant = payout.montantTransfere;
  payout.reserveFrais = Math.max(0, payout.montantDebite - payout.montantTransfere);
  if (remote.sent_at) payout.sentAt = new Date(remote.sent_at);
  if (remote.failed_at) payout.failedAt = new Date(remote.failed_at);
  if (remote.last_error_code) payout.erreur = String(remote.last_error_code);
}

// ---------------------------------------------------------------------------
// Ledger : toutes les écritures sont idempotentes (dedupeKey unique).
// ---------------------------------------------------------------------------
async function reserveBalance(payout, amount, meta = {}) {
  return createLedgerEntryOnce(`payout_reservation:${payout._id}`, {
    owner: payout.owner,
    type: 'debit_reversement',
    montant: amount,
    payout: payout._id,
    reference: `payout-reservation-${payout._id}`,
    description: `Réservation du solde pour le reversement ${payout._id}`,
    metadata: { reservation: true, ...meta },
  });
}

async function getReservation(payout) {
  const WalletEntry = require('../models/WalletEntry');
  return WalletEntry.findOne({ payout: payout._id, type: 'debit_reversement' });
}

// Le reversement n'a jamais quitté le compte : on rend TOUT le solde réservé.
async function releaseFullReservation(payout) {
  const reservation = await getReservation(payout);
  if (!reservation) return;
  // Jamais de libération totale si une restitution partielle a déjà eu lieu.
  const WalletEntry = require('../models/WalletEntry');
  if (await WalletEntry.findOne({ dedupeKey: `payout_adjust:${payout._id}` })) return;
  await createLedgerEntryOnce(`payout_release:${payout._id}`, {
    owner: payout.owner,
    type: 'credit_annulation',
    montant: reservation.montant,
    payout: payout._id,
    reference: `release-${payout._id}`,
    description: `Libération de la réservation du reversement ${payout._id}`,
    metadata: { reason: 'payout_failed' },
  });
}

// Reversement envoyé : on rend ce que FedaPay n'a pas réellement débité.
async function releaseReservationDifference(payout) {
  const reservation = await getReservation(payout);
  if (!reservation || !payout.montantDebite) return;
  const difference = roundXof(reservation.montant - payout.montantDebite);
  if (difference <= 0) return;
  // Jamais de restitution partielle si la réservation a déjà été libérée en entier.
  const WalletEntry = require('../models/WalletEntry');
  if (await WalletEntry.findOne({ dedupeKey: `payout_release:${payout._id}` })) return;
  await createLedgerEntryOnce(`payout_adjust:${payout._id}`, {
    owner: payout.owner,
    type: 'credit_ajustement',
    montant: difference,
    payout: payout._id,
    reference: `payout-adjust-${payout._id}`,
    description: 'Restitution de la part du solde non débitée par FedaPay',
    metadata: { reservation: reservation.montant, montantDebite: payout.montantDebite },
  });
}

// Débit réel supérieur à la réservation (rare) : on trace l'écart pour que le
// solde reste exact, quitte à devenir négatif et visible côté admin.
async function chargeReservationShortfall(payout) {
  const reservation = await getReservation(payout);
  if (!reservation || !payout.montantDebite) return;
  const shortfall = roundXof(payout.montantDebite - reservation.montant);
  if (shortfall <= 0) return;
  await createLedgerEntryOnce(`payout_shortfall:${payout._id}`, {
    owner: payout.owner,
    type: 'debit_frais',
    montant: shortfall,
    payout: payout._id,
    reference: `payout-shortfall-${payout._id}`,
    description: 'Frais de reversement FedaPay supérieurs à la réservation',
    metadata: { reservation: reservation.montant, montantDebite: payout.montantDebite },
  });
}

async function settleLedger(payout) {
  if (payout.statut === 'sent') {
    await releaseReservationDifference(payout);
    await chargeReservationShortfall(payout);
  } else if (payout.statut === 'failed') {
    await releaseFullReservation(payout);
  }
}

// ---------------------------------------------------------------------------
// Création d'un reversement
// ---------------------------------------------------------------------------
async function assertDestinationReady(user) {
  const settings = user.payoutSettings || {};
  // Aucun reversement n'est autorisé tant que la destination n'est pas
  // confirmée par email.
  if (!settings.enabled || settings.status !== 'active' || !settings.emailConfirmed) {
    throw new Error('Le moyen de retrait doit être confirmé par email avant tout reversement.');
  }
  if (settings.mode !== 'mobile_money') {
    throw new Error('Ce moyen de reversement n’est pas disponible dans le flux FedaPay actuellement configuré sur Oryxa.');
  }
  if (!settings.phone) throw new Error('Aucun numéro Mobile Money de reversement configuré.');
  if (!fedapay.isFedapayConfigured()) {
    const err = new Error('FedaPay n’est pas configuré côté serveur.');
    err.code = 'FEDAPAY_NOT_CONFIGURED';
    throw err;
  }
  return settings;
}

async function createPayoutForOwner(ownerId) {
  const user = await User.findById(ownerId).select('nom email payoutSettings');
  if (!user) throw new Error('Utilisateur introuvable.');
  const settings = await assertDestinationReady(user);

  // Avant de créer un nouveau reversement, on libère les anciens reversements
  // restés bloqués avant démarrage : ils empêcheraient sinon tout retrait.
  await recoverStalePayouts(user._id);

  const platform = await PlatformSettings.getOrCreate();
  const balance = await getWalletBalance(user._id);
  if (balance < Number(platform.payoutMinimum || 1000)) return null;

  const existing = await Payout.findOne({ owner: user._id, statut: { $in: ACTIVE } });
  if (existing) return existing;

  // Les frais FedaPay de reversement sont prélevés SUR le solde retirable :
  // on demande donc au bénéficiaire (solde − frais estimés), et on ajuste
  // avant /start pour que le débit total ne dépasse jamais le solde.
  const estimatedFee = payoutFeeForAmount(balance, platform.payoutFeeBrackets);
  const initialAmount = balance - estimatedFee;
  if (initialAmount <= 0) {
    throw new Error('Le solde retirable ne couvre pas les frais de reversement.');
  }

  let payout;
  try {
    // 1) Verrou : l'index unique partiel garantit un seul reversement actif.
    payout = await Payout.create({
      owner: user._id,
      montant: initialAmount,
      mode: 'mobile_money',
      destination: {
        provider: settings.provider || 'mtn',
        phone: settings.phone,
        country: settings.country || 'BJ',
      },
      statut: 'pending',
      reserveFrais: estimatedFee,
      idempotencyKey: crypto.randomUUID(),
    });
    // 2) Réservation du solde AVANT tout appel réseau.
    await reserveBalance(payout, balance, { soldeAvant: balance, fraisEstimes: estimatedFee, montantCible: initialAmount });
  } catch (err) {
    if (err?.code === 11000) {
      const concurrent = await Payout.findOne({ owner: user._id, statut: { $in: ACTIVE } });
      if (concurrent) return concurrent;
    }
    throw err;
  }

  try {
    return await runPayout(payout, user, settings, balance, initialAmount);
  } catch (err) {
    await handleRunFailure(payout, err);
    throw err;
  }
}

async function runPayout(payout, user, settings, balance, initialAmount) {
  const customer = {
    firstname: user.nom || 'Utilisateur',
    lastname: '.',
    email: user.email,
    phone: settings.phone,
  };
  const mode = 'mobile_money';
  const metadata = {
    type: 'oryxa_payout',
    payoutId: String(payout._id),
    ownerId: String(user._id),
    provider: settings.provider || 'mtn',
  };

  let amount = initialAmount;
  let result = await fedapay.createPayout({ amount, mode, customer, metadata });
  payout.fedapayPayoutId = String(result.id || '');
  if (!payout.fedapayPayoutId) throw new Error('FedaPay n’a pas retourné d’identifiant de payout.');
  await payout.save();

  // Le débit réel (montant + frais) est connu AVANT /start. On réduit le
  // montant versé de l'excédent jusqu'à ce que le débit tienne dans le solde.
  // Comme chaque itération retranche exactement l'excédent constaté, la
  // boucle converge en une ou deux passes pour un barème de frais fixe.
  for (let i = 0; i < 5; i += 1) {
    const debite = roundXof(result.amount_debited || 0);
    if (!debite || debite <= balance) break;
    const excess = debite - balance;
    amount -= excess;
    if (amount <= 0) throw new Error('Les frais réels FedaPay dépassent le solde retirable.');
    result = await fedapay.updatePayout(payout.fedapayPayoutId, { amount, mode, customer });
  }
  const debitAvantStart = roundXof(result.amount_debited || amount);
  if (debitAvantStart > balance) {
    throw new Error('Le montant débité par FedaPay dépasserait le solde retirable disponible.');
  }

  // Point de non-retour : dès que startRequestedAt est posé, l'argent a pu
  // partir. Toute erreur ensuite se règle par relecture FedaPay, jamais par
  // une libération aveugle du solde.
  payout.startRequestedAt = new Date();
  payout.montant = amount;
  await payout.save();

  result = await fedapay.startPayout(payout.fedapayPayoutId, settings.phone);
  applyRemote(payout, result);
  payout.statut = normalizePayoutStatus(result.status);
  await payout.save();
  await settleLedger(payout);
  return payout;
}

async function handleRunFailure(payout, err) {
  payout.tentatives += 1;
  payout.erreur = err.message;

  // Avant /start : aucun argent n'a bougé, on abandonne proprement.
  if (!payout.startRequestedAt) {
    payout.statut = 'failed';
    payout.failedAt = new Date();
    await payout.save();
    await settleLedger(payout);
    return;
  }

  // Après /start demandé : l'issue est incertaine. On relit FedaPay ; en cas
  // d'échec de lecture on garde le solde réservé (statut processing) et la
  // réconciliation planifiée tranchera.
  try {
    const remote = await fedapay.getPayout(payout.fedapayPayoutId);
    applyRemote(payout, remote);
    payout.statut = normalizePayoutStatus(remote.status || 'processing');
    // Refus définitif (HTTP 4xx hors délai/limite) et FedaPay indique toujours
    // « pending » : l'ordre n'a pas été accepté, aucun argent n'est parti.
    // On abandonne et on rend le solde au lieu de le bloquer indéfiniment.
    const definitiveRejection = Number(err.status) >= 400 && Number(err.status) < 500 && ![408, 425, 429].includes(Number(err.status));
    if (definitiveRejection && payout.statut === 'pending') {
      payout.statut = 'failed';
      payout.failedAt = new Date();
      payout.erreur = `Démarrage refusé par FedaPay : ${err.message}`;
    }
  } catch {
    payout.statut = 'processing';
  }
  await payout.save();
  await settleLedger(payout);
}

// Libère les reversements bloqués AVANT démarrage (aucun argent parti).
async function recoverStalePayouts(ownerId) {
  const cutoff = new Date(Date.now() - STALE_BEFORE_START_MS);
  const filter = { statut: 'pending', startRequestedAt: null, createdAt: { $lt: cutoff } };
  if (ownerId) filter.owner = ownerId;
  const stale = await Payout.find(filter).limit(50);
  for (const payout of stale) {
    const claimed = await Payout.findOneAndUpdate(
      { _id: payout._id, statut: 'pending', startRequestedAt: null },
      { $set: { statut: 'failed', failedAt: new Date(), erreur: payout.erreur || 'Reversement abandonné avant démarrage.' } },
      { returnDocument: 'after' }
    );
    if (claimed) await settleLedger(claimed);
  }
  return stale.length;
}

async function reconcilePayout(payout) {
  // Un reversement terminé (envoyé ou échoué) ne se réconcilie plus : relire
  // FedaPay pourrait le faire revenir à un état actif et rouvrir le ledger.
  if (!ACTIVE.includes(payout.statut)) return payout;
  if (!payout.fedapayPayoutId) {
    // Jamais créé côté FedaPay : seul le nettoyage « avant démarrage » s'applique.
    await recoverStalePayouts(payout.owner);
    return Payout.findById(payout._id);
  }
  if (!fedapay.isFedapayConfigured()) return payout;
  const remote = await fedapay.getPayout(payout.fedapayPayoutId);
  applyRemote(payout, remote);
  payout.statut = normalizePayoutStatus(remote.status || payout.statut);
  await payout.save();

  // Cas d'un reversement jamais démarré par Oryxa (aucun /start demandé) mais
  // resté « pending » côté FedaPay depuis trop longtemps : on l'abandonne, le
  // solde est rendu. Après un /start demandé, on ne libère jamais sans issue.
  if (payout.statut === 'pending' && !payout.startRequestedAt
      && Date.now() - new Date(payout.createdAt).getTime() > STALE_BEFORE_START_MS) {
    payout.statut = 'failed';
    payout.failedAt = new Date();
    payout.erreur = payout.erreur || 'Reversement abandonné avant démarrage.';
    await payout.save();
  }

  // /start demandé mais FedaPay l'indique toujours « pending » : on ne libère
  // jamais le solde (l'argent a peut-être déjà été engagé) ; on signale pour
  // vérification manuelle plutôt que de rester silencieusement bloqué.
  if (payout.statut === 'pending' && payout.startRequestedAt
      && Date.now() - new Date(payout.startRequestedAt).getTime() > 30 * 60 * 1000) {
    payout.erreur = 'Démarrage non confirmé par FedaPay : vérification manuelle requise.';
    await payout.save();
  }

  if (ACTIVE.includes(payout.statut)) {
    const reservation = await getReservation(payout);
    if (!reservation && payout.montantDebite > 0) {
      await reserveBalance(payout, payout.montantDebite, { reconciled: true });
    }
  }
  await settleLedger(payout);
  return payout;
}

// Résolution manuelle par un admin d'un reversement resté incertain.
//  - recheck : relit FedaPay et applique l'issue.
//  - release : abandonne et rend le solde, UNIQUEMENT si FedaPay confirme que
//    l'ordre n'a pas été exécuté (statut distant « pending » ou « failed »).
async function resolvePayoutManually(payout, action) {
  if (!['recheck', 'release'].includes(action)) throw new Error('Action invalide.');
  if (!ACTIVE.includes(payout.statut)) throw new Error('Ce reversement est déjà finalisé.');
  if (action === 'recheck') return reconcilePayout(payout);
  if (!payout.fedapayPayoutId) {
    payout.statut = 'failed';
  } else {
    const remote = await fedapay.getPayout(payout.fedapayPayoutId);
    const status = normalizePayoutStatus(remote.status);
    if (!['pending', 'failed'].includes(status)) {
      throw new Error(`FedaPay indique « ${remote.status} » : le solde ne peut pas être libéré tant que le reversement n'est pas échoué.`);
    }
    applyRemote(payout, remote);
    payout.statut = 'failed';
  }
  payout.failedAt = new Date();
  payout.erreur = `Libéré manuellement par un administrateur. ${payout.erreur || ''}`.trim();
  await payout.save();
  await settleLedger(payout);
  return payout;
}

module.exports = { resolvePayoutManually, createPayoutForOwner, reconcilePayout, recoverStalePayouts, settleLedger, applyRemote, normalizePayoutStatus };
