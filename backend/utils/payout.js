const crypto = require('crypto');
const User = require('../models/User');
const Payout = require('../models/Payout');
const WalletEntry = require('../models/WalletEntry');
const fedapay = require('./fedapay');
const { getWalletBalance, payoutFeeForAmount, roundXof } = require('./financial');
const PlatformSettings = require('../models/PlatformSettings');

function normalizePayoutStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'scheduled') return 'processing';
  if (['pending', 'started', 'processing', 'sent', 'failed'].includes(s)) return s;
  return 'processing';
}

function providerMode(provider) {
  // FedaPay documente le mode générique mobile_money. Le provider reste dans
  // les coordonnées du bénéficiaire et les custom_metadata pour la traçabilité.
  return 'mobile_money';
}

async function createPayoutForOwner(ownerId) {
  const user = await User.findById(ownerId).select('nom email payoutSettings');
  if (!user) throw new Error('Utilisateur introuvable.');
  const settings = user.payoutSettings || {};

  // Aucun reversement n'est autorisé tant que la destination n'est pas
  // explicitement confirmée par email. Cette confirmation ne prétend pas
  // vérifier l'identité du titulaire du numéro : elle autorise seulement la
  // destination configurée par le propriétaire du compte Oryxa.
  if (!settings.enabled || settings.status !== 'active' || !settings.emailConfirmed) {
    throw new Error('Le moyen de retrait doit être confirmé par email avant tout reversement.');
  }

  // Le flux réellement implémenté ici est Mobile Money. Les cartes restent
  // des moyens de paiement entrants via le Checkout FedaPay. Nous refusons
  // volontairement de fabriquer un payout carte ou bancaire tant que les
  // paramètres exacts exigés par FedaPay ne sont pas configurés et testés.
  if (settings.mode !== 'mobile_money') {
    throw new Error('Ce moyen de reversement n’est pas disponible dans le flux FedaPay actuellement configuré sur Oryxa.');
  }
  if (!settings.phone) throw new Error('Aucun numéro Mobile Money de reversement configuré.');
  if (!fedapay.isFedapayConfigured()) {
    const err = new Error('FedaPay n’est pas configuré côté serveur.');
    err.code = 'FEDAPAY_NOT_CONFIGURED';
    throw err;
  }

  const platform = await PlatformSettings.getOrCreate();
  const balance = await getWalletBalance(user._id);
  if (balance < Number(platform.payoutMinimum || 1000)) return null;

  // Un seul payout non terminé par espace. L'index unique du modèle protège
  // également contre deux workers concurrents.
  const existing = await Payout.findOne({
    owner: user._id,
    statut: { $in: ['pending', 'started', 'processing'] },
  });
  if (existing) return existing;

  const estimatedFee = payoutFeeForAmount(balance, platform.payoutFeeBrackets);
  // Les frais prévisionnels sont déjà provisionnés au niveau des paiements
  // en ligne qui composent le solde. Le payout doit donc transférer tout le
  // solde actuellement retirable, et non retrancher une deuxième fois le
  // barème estimatif.
  const targetTransfer = balance;
  if (targetTransfer <= 0) throw new Error('Aucun solde retirable disponible.');

  const idempotencyKey = crypto.randomUUID();
  let payout;
  try {
    // Réserver le solde AVANT l'appel FedaPay. Ainsi, un second worker ne peut
    // pas réutiliser la même créance pendant qu'un appel réseau est en cours.
    payout = await Payout.create({
      owner: user._id,
      montant: targetTransfer,
      mode: 'mobile_money',
      destination: {
        provider: settings.provider || 'mtn',
        phone: settings.phone,
        country: settings.country || 'BJ',
      },
      statut: 'pending',
      reserveFrais: estimatedFee,
      idempotencyKey,
    });

    await WalletEntry.create({
      owner: user._id,
      type: 'debit_reversement',
      montant: balance,
      payout: payout._id,
      reference: `payout-reservation-${payout._id}`,
      description: `Réservation du solde pour le reversement ${payout._id}`,
      metadata: {
        reservation: true,
        soldeAvant: balance,
        estimationFrais: estimatedFee,
        montantCible: targetTransfer,
        fraisEstimesDejaProvisionnes: estimatedFee,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const concurrent = await Payout.findOne({
        owner: user._id,
        statut: { $in: ['pending', 'started', 'processing'] },
      });
      if (concurrent) return concurrent;
    }
    throw err;
  }

  try {
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

    // FedaPay documente amount_transferred et amount_debited sur le payout.
    // On demande donc d'abord le montant net cible, puis on vérifie le débit
    // réel avant /start. Si l'estimation était insuffisante, on réduit la
    // cible avant le démarrage ; aucune différence ne doit être absorbée
    // silencieusement par Oryxa.
    let result = await fedapay.createPayout({
      amount: targetTransfer,
      mode,
      customer,
      metadata,
    });

    payout.fedapayPayoutId = String(result.id || '');
    payout.fedapayReference = result.reference || '';
    if (!payout.fedapayPayoutId) {
      throw new Error('FedaPay n’a pas retourné d’identifiant de payout.');
    }

    for (let i = 0; i < 5; i += 1) {
      const debite = roundXof(result.amount_debited || result.amount || 0);
      const transfere = roundXof(result.amount_transferred || result.amount || 0);
      if (!debite || debite <= balance) break;

      // Les frais exacts sont connus avant /start. On ne réduit la somme
      // transférée que de l'écart entre frais réels et frais déjà provisionnés.
      const fraisReels = Math.max(0, debite - transfere);
      const fraisDejaProvisionnes = Math.min(estimatedFee, balance);
      const ecartFrais = Math.max(0, fraisReels - fraisDejaProvisionnes);
      const montantCible = Math.max(1, balance - ecartFrais);
      if (montantCible <= 0) {
        throw new Error('Les frais réels FedaPay dépassent la provision disponible pour ce reversement.');
      }
      result = await fedapay.updatePayout(payout.fedapayPayoutId, {
        amount: montantCible,
        mode,
        customer,
      });
    }

    const debitAvantStart = roundXof(result.amount_debited || result.amount || 0);
    if (debitAvantStart > balance) {
      throw new Error('Le montant débité par FedaPay dépasserait le solde retirable disponible.');
    }

    result = await fedapay.startPayout(payout.fedapayPayoutId, settings.phone);

    payout.fedapayReference = result.reference || payout.fedapayReference || '';
    payout.fedapayStatus = result.status || '';
    payout.fraisFedaPay = roundXof(result.fees || result.fixed_commission || 0);
    payout.commissionFedaPay = roundXof(result.commission || 0);
    payout.montantTransfere = roundXof(result.amount_transferred || result.amount || 0);
    payout.montantDebite = roundXof(result.amount_debited || 0);
    payout.montant = payout.montantTransfere || payout.montant;
    payout.reserveFrais = Math.max(0, roundXof(payout.montantDebite - payout.montantTransfere));
    payout.statut = normalizePayoutStatus(result.status);
    payout.sentAt = result.sent_at ? new Date(result.sent_at) : null;
    await payout.save();

    // La réservation était volontairement égale au solde entier. Le montant
    // réellement débité par FedaPay peut être inférieur : on recrédite alors
    // uniquement la différence, de façon idempotente.
    await releaseReservationDifference(payout);
    return payout;
  } catch (err) {
    payout.tentatives += 1;

    // Une erreur réseau après création distante ne permet pas de conclure à un
    // échec. On relit FedaPay avant toute libération du solde.
    if (payout.fedapayPayoutId) {
      try {
        const remote = await fedapay.getPayout(payout.fedapayPayoutId);
        payout.fedapayStatus = remote.status || payout.fedapayStatus;
        payout.fedapayReference = remote.reference || payout.fedapayReference || '';
        payout.statut = normalizePayoutStatus(remote.status || 'processing');
        payout.fraisFedaPay = roundXof(remote.fees || remote.fixed_commission || 0);
        payout.commissionFedaPay = roundXof(remote.commission || 0);
        payout.montantTransfere = roundXof(remote.amount_transferred || remote.amount || 0);
        payout.montantDebite = roundXof(remote.amount_debited || 0);
        payout.montant = payout.montantTransfere || payout.montant;
        if (remote.sent_at) payout.sentAt = new Date(remote.sent_at);
        if (remote.failed_at) payout.failedAt = new Date(remote.failed_at);
      } catch {
        // L'existence du payout distant est certaine : on garde une réserve
        // bloquée et un statut processing plutôt que de risquer un double
        // reversement.
        payout.statut = 'processing';
      }
    } else {
      payout.statut = 'failed';
      payout.failedAt = new Date();
    }
    payout.erreur = err.message;
    await payout.save();

    if (payout.statut === 'failed') {
      await releaseFullReservation(payout);
    } else if (payout.statut === 'sent') {
      await releaseReservationDifference(payout);
    }
    throw err;
  }
}

async function releaseFullReservation(payout) {
  const reservation = await WalletEntry.findOne({ payout: payout._id, type: 'debit_reversement' });
  if (!reservation) return;
  const releaseExists = await WalletEntry.findOne({
    payout: payout._id,
    type: 'credit_annulation',
    reference: `release-${payout._id}`,
  });
  if (!releaseExists) {
    await WalletEntry.create({
      owner: payout.owner,
      type: 'credit_annulation',
      montant: reservation.montant,
      payout: payout._id,
      reference: `release-${payout._id}`,
      description: `Libération de la réservation du reversement ${payout._id}`,
      metadata: { reason: 'payout_failed' },
    });
  }
}

async function releaseReservationDifference(payout) {
  const reservation = await WalletEntry.findOne({ payout: payout._id, type: 'debit_reversement' });
  if (!reservation || !payout.montantDebite) return;
  const difference = roundXof(reservation.montant - payout.montantDebite);
  if (difference <= 0) return;
  const reference = `payout-adjust-${payout._id}`;
  const exists = await WalletEntry.findOne({ payout: payout._id, type: 'credit_ajustement', reference });
  if (exists) return;
  await WalletEntry.create({
    owner: payout.owner,
    type: 'credit_ajustement',
    montant: difference,
    payout: payout._id,
    reference,
    description: 'Restitution de la part du solde non débitée par FedaPay',
    metadata: { reservation: reservation.montant, montantDebite: payout.montantDebite },
  });
}

async function reconcilePayout(payout) {
  if (!payout.fedapayPayoutId || !fedapay.isFedapayConfigured()) return payout;
  const remote = await fedapay.getPayout(payout.fedapayPayoutId);
  payout.fedapayStatus = remote.status || '';
  payout.fraisFedaPay = roundXof(remote.fees || remote.fixed_commission || 0);
  payout.commissionFedaPay = roundXof(remote.commission || 0);
  payout.montantTransfere = roundXof(remote.amount_transferred || 0);
  if (payout.montantTransfere > 0) payout.montant = payout.montantTransfere;
  payout.montantDebite = roundXof(remote.amount_debited || 0);
  payout.statut = normalizePayoutStatus(remote.status || payout.statut);
  if (remote.sent_at) payout.sentAt = new Date(remote.sent_at);
  if (remote.failed_at) payout.failedAt = new Date(remote.failed_at);
  if (remote.last_error_code) payout.erreur = String(remote.last_error_code);
  await payout.save();

  if (['pending', 'started', 'processing'].includes(payout.statut)) {
    const reservation = await WalletEntry.findOne({ payout: payout._id, type: 'debit_reversement' });
    if (!reservation && payout.montantDebite > 0) {
      await WalletEntry.create({
        owner: payout.owner,
        type: 'debit_reversement',
        montant: payout.montantDebite,
        payout: payout._id,
        reference: payout.fedapayReference || String(payout._id),
        description: `Réservation du solde pour le reversement ${payout._id}`,
        metadata: { reservation: true, reconciled: true },
      });
    }
  }

  if (payout.statut === 'sent') {
    await releaseReservationDifference(payout);
  }

  if (payout.statut === 'failed') {
    await releaseFullReservation(payout);
  }
  return payout;
}

module.exports = { createPayoutForOwner, reconcilePayout };
