'use strict';
const { normalizeDevise } = require('../utils/currency');
const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { encryptSecret } = require('../utils/emecefCrypto');
const emecef = require('../utils/emecefService');
const { syncInvoiceStatus } = require('../utils/invoicePayments');

const PAYMENT_TYPES = new Set(['ESPECES', 'CHEQUES', 'MOBILEMONEY', 'CARTEBANCAIRE', 'VIREMENT', 'CREDIT', 'AUTRE']);

function publicConfig(user) {
  const f = user.fiscalisation || {};
  return {
    environment: 'test',
    ifu: f.ifu || '',
    operatorName: f.operatorName || '',
    tokenConfigured: Boolean(f.tokenConfigured),
    lastConnectionCheckAt: f.lastConnectionCheckAt || null,
    lastConnectionStatus: f.lastConnectionStatus || 'unknown',
  };
}

function safeApiError(result) {
  return {
    errorCode: result?.data?.errorCode == null ? null : String(result.data.errorCode),
    errorDesc: String(result?.data?.errorDesc || result?.data?.message || 'La DGI a retourné une erreur.'),
  };
}

function optionCode(option) {
  if (typeof option === 'string') return option.trim().toUpperCase();
  if (option && typeof option === 'object') {
    const value = option.type || option.code || option.name || option.value;
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }
  return '';
}

function amount(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} doit être un montant entier positif ou nul en FCFA.`);
  return n;
}

function buildPayload({ invoice, client, config, taxGroup, paymentType, priceBasis, taxGroupRates, invoiceType = 'FV', aib = '', reference = '' }) {
  if (invoice.statut === 'annulee') throw new Error('Une facture commerciale annulée ne peut pas être envoyée à la DGI.');
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) throw new Error('Ajoutez au moins un article avant la fiscalisation.');
  if (Number(invoice.remise || 0) !== 0) throw new Error('La remise globale n’est pas encore prise en charge par l’intégration e-MECeF. Retirez-la ou attendez la prise en charge dédiée.');
  if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(taxGroup)) throw new Error('Choisissez un groupe fiscal valide (A à F).');
  if (!['FV', 'FA', 'EV', 'EA'].includes(invoiceType)) throw new Error('Choisissez un type de facture reconnu par la DGI.');
  if (['FA', 'EA'].includes(invoiceType)) {
    if (typeof reference !== 'string') throw new Error('Pour un avoir, renseignez le code MECeF/DGI de la facture originale.');
    const normalizedReference = reference.trim().replace(/-/g, '');
    if (!/^[A-Za-z0-9]{24}$/.test(normalizedReference)) throw new Error('Pour un avoir, la référence doit contenir les 24 caractères du code MECeF/DGI de la facture originale.');
    reference = normalizedReference;
  } else if (reference && String(reference).trim()) { throw new Error('La référence de facture originale ne s’applique qu’aux avoirs FA/EA.'); }
  if (aib && !['A', 'B'].includes(aib)) throw new Error('Le type d’AIB doit être A ou B.');
  if (aib) {
    const aibRate = Number(taxGroupRates?.[aib === 'A' ? 'aibA' : 'aibB']);
    if (!Number.isFinite(aibRate) || aibRate <= 0 || aibRate > 100) throw new Error('Le taux AIB sélectionné n’a pas été confirmé par la DGI.');
  }
  if (['EV', 'EA'].includes(invoiceType) && client?.ifu && !/^\d{13}$/.test(String(client.ifu))) throw new Error('L’IFU du client export doit comporter 13 chiffres lorsqu’il est renseigné.');
  if (!PAYMENT_TYPES.has(paymentType)) throw new Error('Choisissez un moyen de paiement reconnu par la DGI.');
  // Dans le modèle Oryxa, prixUnitaire est une base HT et totalTTC ajoute la TVA.
  // Accepter TTC ici créerait un document fiscal différent de la facture commerciale.
  if (priceBasis !== 'HT') throw new Error('Cette version fiscalise les factures Oryxa dont les prix sont saisis HT. Le mode TTC n’est pas pris en charge car Oryxa calcule déjà la TVA sur les prix saisis.');
  const taxRate = Number(taxGroupRates?.[taxGroup.toLowerCase()]);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Le taux de ce groupe fiscal n’a pas pu être vérifié auprès de la DGI. Réessayez après avoir vérifié la connexion.');
  if (!config.ifu || !/^\d{13}$/.test(config.ifu)) throw new Error('L’IFU du vendeur doit comporter 13 chiffres.');
  if (!config.operatorName?.trim()) throw new Error('Renseignez le nom de l’opérateur dans le profil e-MECeF.');
  const items = invoice.items.map((item, index) => {
    const quantity = Number(item.quantite);
    const unitPrice = Number(item.prixUnitaire);
    if (!item.description?.trim()) throw new Error(`L’article ${index + 1} n’a pas de libellé.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`La quantité de l’article ${index + 1} est invalide.`);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`Le prix de l’article ${index + 1} doit être supérieur à zéro.`);
    if (item.taxGroup && !['A', 'B', 'C', 'D', 'E', 'F'].includes(item.taxGroup)) throw new Error(`Le groupe fiscal de l’article ${index + 1} est invalide.`);
    const selectedTaxGroup = item.taxGroup || taxGroup;
    const selectedRate = Number(taxGroupRates?.[selectedTaxGroup.toLowerCase()]);
    if (!Number.isFinite(selectedRate) || selectedRate < 0 || selectedRate > 100) throw new Error(`Le taux fiscal de l’article ${index + 1} est invalide.`);
    // Le manuel e-MECeF définit `price` comme le prix unitaire TTC.
    // La conversion utilise le taux du groupe fiscal de CHAQUE ligne.
    const apiPrice = Math.round(unitPrice * (1 + selectedRate / 100));
    if (!Number.isSafeInteger(apiPrice) || apiPrice <= 0) throw new Error(`Le prix converti de l’article ${index + 1} est invalide.`);
    const itemPayload = { name: item.description.trim().slice(0, 200), price: apiPrice, quantity, taxGroup: selectedTaxGroup };
    const taxSpecific = Number(item.taxSpecific || 0);
    if (!Number.isSafeInteger(taxSpecific) || taxSpecific < 0) throw new Error(`La taxe spécifique de l’article ${index + 1} doit être un montant entier positif ou nul.`);
    if (taxSpecific > 0) itemPayload.taxSpecific = taxSpecific;
    if (item.originalPrice != null && Number(item.originalPrice) > 0) {
      if (!Number.isSafeInteger(Number(item.originalPrice))) throw new Error(`Le prix d’origine de l’article ${index + 1} doit être entier.`);
      if (!item.priceModification || !String(item.priceModification).trim()) throw new Error(`La justification de modification du prix de l’article ${index + 1} est obligatoire.`);
      itemPayload.originalPrice = Number(item.originalPrice);
      itemPayload.priceModification = String(item.priceModification).trim().slice(0, 100);
    } else if (item.priceModification) {
      throw new Error(`Le prix d’origine doit être renseigné pour l’article ${index + 1} si une modification de prix est indiquée.`);
    }
    return itemPayload;
  });
  const itemsTotal = items.reduce((sum, item) => sum + Math.round(Number(item.price) * Number(item.quantity)), 0);
  const specificTaxTotal = items.reduce((sum, item) => sum + Number(item.taxSpecific || 0), 0);
  const expectedTotal = amount(Math.round(itemsTotal + specificTaxTotal), 'Le total fiscal calculé');
  const existingTotal = Number(invoice.totalTTC);
  if (!Number.isFinite(existingTotal) || existingTotal < 0) throw new Error('Le total TTC Oryxa est indisponible ou invalide ; la facture n’a pas été envoyée.');
  // Contrôle strict pour TOUS les scénarios : le document commercial Oryxa
  // et le document fiscal envoyé doivent représenter le même montant. Ne pas
  // contourner ce contrôle pour les groupes mixtes ou taxes spécifiques :
  // cela pourrait fiscaliser un montant différent de celui présenté au client.
  // Le manuel DGI arrondit le prix unitaire TTC de CHAQUE ligne : l'écart avec
  // le calcul HT global peut atteindre 0,5 FCFA par unité vendue. Cet écart
  // d'arrondi est toléré ; le total DGI fait ensuite foi (voir invoiceTotals).
  // Un écart supérieur trahit une vraie erreur (groupe fiscal, TVA...) : blocage.
  const roundingTolerance = Math.ceil(invoice.items.reduce((sum, item) => sum + 0.5 * Math.abs(Number(item.quantite) || 0), 0)) + 1;
  if (Math.abs(Math.round(existingTotal) - expectedTotal) > roundingTolerance) {
    throw new Error(
      `Le total fiscal calculé (${expectedTotal} FCFA) ne correspond pas au total TTC Oryxa (${Math.round(existingTotal)} FCFA). ` +
      `Aucun envoi n’a été effectué. Vérifiez les groupes fiscaux de chaque ligne, la TVA, les taxes spécifiques et les arrondis.`
    );
  }
  const paymentAmount = expectedTotal;
  const payload = {
    ifu: config.ifu,
    type: invoiceType,
    items,
    operator: { name: config.operatorName.trim().slice(0, 150) },
    payment: [{ name: paymentType, amount: paymentAmount }],
  };
  if (aib) payload.aib = aib;
  if (['FA', 'EA'].includes(invoiceType)) payload.reference = reference.trim();
  if (client) {
    const c = {};
    if (client.ifu && /^\d{13}$/.test(client.ifu)) c.ifu = client.ifu;
    if (client.nom) c.name = client.nom.slice(0, 150);
    if (client.telephone || client.whatsapp) c.contact = String(client.telephone || client.whatsapp).slice(0, 50);
    if (client.adresse) c.address = client.adresse.slice(0, 200);
    if (Object.keys(c).length) payload.client = c;
  }
  return { payload, expectedTotal };
}

exports.getConfig = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  res.json(publicConfig(user));
});

exports.saveConfig = asyncHandler(async (req, res) => {
  const { ifu, operatorName, token } = req.body || {};
  if (typeof ifu !== 'string' || !/^\d{13}$/.test(ifu.trim())) return res.status(400).json({ message: 'L’IFU doit comporter exactement 13 chiffres.' });
  if (typeof operatorName !== 'string' || operatorName.trim().length < 2 || operatorName.trim().length > 150) return res.status(400).json({ message: 'Le nom de l’opérateur doit comporter entre 2 et 150 caractères.' });
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  const tokenProvided = typeof token === 'string' && token.trim().length > 0;
  if (tokenProvided && token.trim().length < 20) return res.status(400).json({ message: 'Le jeton fourni semble trop court. Vérifiez le jeton de test DGI.' });
  if (!tokenProvided && !user.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Collez le jeton de test fourni par la DGI.' });
  user.fiscalisation = user.fiscalisation || {};
  user.fiscalisation.environment = 'test';
  user.fiscalisation.ifu = ifu.trim();
  user.fiscalisation.operatorName = operatorName.trim();
  if (tokenProvided) user.fiscalisation.tokenEncrypted = encryptSecret(token);
  user.fiscalisation.tokenConfigured = Boolean(user.fiscalisation.tokenEncrypted);
  user.fiscalisation.lastConnectionStatus = 'unknown';
  await user.save();
  res.json(publicConfig(user));
});

exports.testConnection = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Enregistrez d’abord le jeton de test.' });
  try {
    const result = await emecef.request({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted, path: '/api/info/status' });
    const data = result.data || {};
    const ok = result.ok && data.status === true && !data.errorCode && (!data.ifu || data.ifu === user.fiscalisation.ifu);
    user.fiscalisation.lastConnectionCheckAt = new Date();
    user.fiscalisation.lastConnectionStatus = ok ? 'ok' : 'error';
    await user.save();
    if (!ok) return res.status(502).json({ message: data.errorDesc || data.message || 'La DGI n’a pas validé la connexion.', status: data.status ?? null });
    return res.json({ connected: true, environment: 'test', status: data.status ?? true, version: data.version || null, tokenValidUntil: data.tokenValid || null, nim: data.nim || null });
  } catch (error) {
    user.fiscalisation.lastConnectionCheckAt = new Date();
    user.fiscalisation.lastConnectionStatus = 'error';
    await user.save();
    throw error;
  }
});

exports.getOptions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Configurez le jeton e-MECeF dans le profil.' });
  const options = await emecef.getOptions({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted });
  if (options.status?.ifu && options.status.ifu !== user.fiscalisation.ifu) {
    return res.status(409).json({ message: 'L’IFU retourné par la DGI ne correspond pas à l’IFU enregistré dans Oryxa. Vérifiez le jeton et la configuration.' });
  }
  res.json(options);
});

exports.prepareInvoice = asyncHandler(async (req, res) => {
  const { taxGroup, paymentType, priceBasis, invoiceType = 'FV', aib = '', reference = '', autoConfirm = true } = req.body || {};
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable.' });
  if (normalizeDevise(invoice.devise) !== 'XOF') return res.status(400).json({ message: 'La normalisation e-MECeF (DGI) est possible uniquement pour les factures en FCFA.' });
  const currentStatus = invoice.fiscalisation?.status || 'non_emise';
  if (['submitting', 'confirming', 'cancelling', 'pending_confirmation', 'confirmed', 'unknown'].includes(currentStatus)) {
    return res.status(409).json({ message: `Cette facture e-MECeF est déjà dans l’état « ${currentStatus} ». Ne la renvoyez pas pour éviter un doublon.`, status: currentStatus, uid: invoice.fiscalisation?.uid || null });
  }
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted || !user.fiscalisation?.tokenConfigured) return res.status(400).json({ message: 'Configurez d’abord le jeton e-MECeF dans le profil.' });
  let dgiOptions;
  try {
    dgiOptions = await emecef.getOptions({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted });
  } catch (error) {
    return res.status(error.status || 502).json({ message: `Impossible de charger les paramètres fiscaux actuels de la DGI : ${error.message}` });
  }
  if (dgiOptions.status?.ifu && dgiOptions.status.ifu !== user.fiscalisation.ifu) {
    return res.status(409).json({ message: 'L’IFU retourné par la DGI ne correspond pas à celui configuré dans Oryxa. Aucun envoi effectué.' });
  }
  const availableInvoiceTypes = dgiOptions.invoiceTypes.map(optionCode).filter(Boolean);
  const availablePaymentTypes = dgiOptions.paymentTypes.map(optionCode).filter(Boolean);
  if (!availableInvoiceTypes.includes(String(invoiceType).toUpperCase())) {
    return res.status(400).json({ message: `Le type ${invoiceType} n’est pas proposé par la DGI pour cet IFU.` });
  }
  if (!availablePaymentTypes.includes(String(paymentType).toUpperCase())) {
    return res.status(400).json({ message: `Le moyen de paiement ${paymentType} n’est pas proposé par la DGI pour cet IFU.` });
  }
  let built;
  try {
    built = buildPayload({ invoice, client: invoice.client, config: user.fiscalisation, taxGroup, paymentType, priceBasis, taxGroupRates: dgiOptions.taxGroups, invoiceType, aib, reference });
  } catch (error) { return res.status(400).json({ message: error.message }); }

  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(built.payload)).digest('hex');
  // Verrou atomique : deux clics simultanés ne doivent pas créer deux demandes DGI.
  const lockedInvoice = await Invoice.findOneAndUpdate(
    { _id: invoice._id, owner: req.userId, ...(invoice.updatedAt ? { updatedAt: invoice.updatedAt } : {}), $or: [ { 'fiscalisation.status': { $in: ['non_emise', 'error', 'cancelled'] } }, { 'fiscalisation.status': { $exists: false } } ] },
    { $set: {
      'fiscalisation.status': 'submitting', 'fiscalisation.environment': 'test',
      'fiscalisation.requestFingerprint': fingerprint, 'fiscalisation.requestAt': new Date(),
      'fiscalisation.invoiceType': invoiceType, 'fiscalisation.aib': aib || '',
      'fiscalisation.reference': ['FA', 'EA'].includes(invoiceType) ? String(reference).trim().replace(/-/g, '') : null,
      'fiscalisation.requestPayload': built.payload,
      'fiscalisation.errorCode': null, 'fiscalisation.errorDesc': null,
    } },
    { returnDocument: 'after' }
  );
  if (!lockedInvoice) return res.status(409).json({ message: 'Une autre opération e-MECeF vient de démarrer ou cette facture a déjà été envoyée. Rechargez la facture avant de continuer.' });
  invoice.fiscalisation = lockedInvoice.fiscalisation;

  let result;
  try {
    result = await emecef.request({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted, method: 'POST', path: '/api/invoice', body: built.payload });
  } catch (error) {
    invoice.fiscalisation.status = 'unknown';
    invoice.fiscalisation.errorCode = error.code || 'NETWORK_ERROR';
    invoice.fiscalisation.errorDesc = error.message;
    await invoice.save();
    return res.status(502).json({ message: error.message, status: 'unknown', doNotRetry: true });
  }

  if (!result.ok || result.data?.status === false || !result.data?.uid || result.data?.errorCode) {
    const apiError = safeApiError(result);
    // Si un UID existe malgré une réponse atypique, on interdit une nouvelle soumission.
    const ambiguous = Boolean(result.data?.uid) || (result.ok && !result.data?.errorCode) || (result.httpStatus || 0) >= 500;
    invoice.fiscalisation.status = ambiguous ? 'unknown' : 'error';
    invoice.fiscalisation.uid = result.data?.uid ? String(result.data.uid) : null;
    invoice.fiscalisation.expectedTotal = built.expectedTotal;
    invoice.fiscalisation.dgiTotal = result.data?.total !== null && result.data?.total !== undefined && result.data?.total !== '' && Number.isFinite(Number(result.data.total)) ? Number(result.data.total) : null;
    invoice.fiscalisation.errorCode = apiError.errorCode;
    invoice.fiscalisation.errorDesc = apiError.errorDesc;
    invoice.fiscalisation.response = result.data;
    await invoice.save();
    return res.status(422).json({ message: apiError.errorDesc, errorCode: apiError.errorCode, response: result.data, status: invoice.fiscalisation.status, doNotRetry: ambiguous });
  }

  const rawDgiTotal = result.data?.total;
  const dgiTotal = rawDgiTotal === null || rawDgiTotal === undefined || rawDgiTotal === '' ? NaN : Number(rawDgiTotal);
  invoice.fiscalisation.uid = String(result.data.uid);
  invoice.fiscalisation.expectedTotal = built.expectedTotal;
  invoice.fiscalisation.dgiTotal = Number.isFinite(dgiTotal) ? dgiTotal : null;
  invoice.fiscalisation.response = result.data;
  invoice.fiscalisation.creationResponse = result.data;

  // Le manuel DGI impose de comparer le total calculé par l'e-MCF avant toute
  // confirmation. En cas d'écart (ou de total absent), on tente l'annulation
  // immédiate et on interdit toujours la confirmation.
  const totalIsValid = Number.isFinite(dgiTotal) && Number.isInteger(dgiTotal) && dgiTotal >= 0;
  if (!totalIsValid || dgiTotal !== built.expectedTotal) {
    const mismatchMessage = totalIsValid
      ? `Écart de total : Oryxa attend ${built.expectedTotal} FCFA, la DGI a calculé ${dgiTotal} FCFA. La demande ne sera pas confirmée.`
      : `La DGI n’a pas renvoyé un total exploitable. La demande ne sera pas confirmée.`;
    try {
      const cancelResult = await emecef.request({
        environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted,
        method: 'PUT', path: `/api/invoice/${encodeURIComponent(invoice.fiscalisation.uid)}/annuler`,
      });
      const cancellationSucceeded = cancelResult.ok && cancelResult.data?.status !== false && !cancelResult.data?.errorCode;
      invoice.fiscalisation.status = cancellationSucceeded ? 'cancelled' : 'unknown';
      invoice.fiscalisation.response = { creation: result.data, cancellation: cancelResult.data };
      invoice.fiscalisation.errorCode = cancellationSucceeded ? 'TOTAL_MISMATCH' : (safeApiError(cancelResult).errorCode || 'TOTAL_MISMATCH_CANCEL_FAILED');
      invoice.fiscalisation.errorDesc = cancellationSucceeded
        ? `${mismatchMessage} La demande a été annulée auprès de la DGI.`
        : `${mismatchMessage} L’annulation n’a pas pu être confirmée par la DGI. Ne renvoyez pas cette facture et vérifiez son état auprès de la DGI.`;
      await invoice.save();
      return res.status(422).json({
        message: invoice.fiscalisation.errorDesc, status: invoice.fiscalisation.status,
        uid: invoice.fiscalisation.uid, expectedTotal: built.expectedTotal,
        dgiTotal: invoice.fiscalisation.dgiTotal, doNotRetry: true,
      });
    } catch (cancelError) {
      invoice.fiscalisation.status = 'unknown';
      invoice.fiscalisation.errorCode = 'TOTAL_MISMATCH_CANCEL_FAILED';
      invoice.fiscalisation.errorDesc = `${mismatchMessage} L’appel d’annulation a échoué : ${cancelError.message}. Ne renvoyez pas cette facture et vérifiez son état auprès de la DGI.`;
      invoice.fiscalisation.response = { creation: result.data, cancellationError: cancelError.message };
      await invoice.save();
      return res.status(502).json({
        message: invoice.fiscalisation.errorDesc, status: 'unknown', uid: invoice.fiscalisation.uid,
        expectedTotal: built.expectedTotal, dgiTotal: invoice.fiscalisation.dgiTotal, doNotRetry: true,
      });
    }
  }

  invoice.fiscalisation.status = 'pending_confirmation';
  invoice.fiscalisation.errorCode = null;
  invoice.fiscalisation.errorDesc = null;
  await invoice.save();

  // Confirmation automatique : le total DGI vient d'être vérifié identique au
  // total attendu, et la demande expire vite côté DGI. On confirme donc dans la
  // foulée plutôt que de dépendre d'un second clic de l'utilisateur.
  if (autoConfirm !== false) {
    const locked = await Invoice.findOneAndUpdate(
      { _id: invoice._id, owner: req.userId, 'fiscalisation.status': 'pending_confirmation', 'fiscalisation.uid': invoice.fiscalisation.uid },
      { $set: { 'fiscalisation.status': 'confirming' } },
      { returnDocument: 'after' }
    );
    if (locked) {
      const outcome = await runConfirm(locked, user);
      if (outcome.code === 200) {
        return res.json({ ...outcome.body, uid: locked.fiscalisation.uid, expectedTotal: built.expectedTotal, dgiTotal, message: 'Facture fiscalisée et confirmée par la DGI.' });
      }
      return res.status(outcome.code).json({ ...outcome.body, uid: locked.fiscalisation.uid, expectedTotal: built.expectedTotal, dgiTotal });
    }
  }
  return res.json({ status: 'pending_confirmation', uid: invoice.fiscalisation.uid, response: result.data, expectedTotal: built.expectedTotal, dgiTotal, message: 'Le total DGI correspond au total Oryxa. Confirmez rapidement depuis cet écran.' });
});

// Sortie des états bloqués. Après une erreur réseau ou une réponse ambiguë, la
// facture reste « unknown » et ne peut plus être fiscalisée : l'utilisateur
// doit pouvoir repartir de zéro APRÈS avoir vérifié auprès de la DGI. L'action
// est explicite (acknowledge) et conservée dans l'historique de la facture.
exports.resetFiscalisation = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable.' });
  if (!req.body || req.body.acknowledge !== true) {
    return res.status(400).json({ message: 'Confirmez que vous avez vérifié l’état de cette demande auprès de la DGI (acknowledge: true).' });
  }
  const status = invoice.fiscalisation?.status || 'non_emise';
  const transient = ['submitting', 'confirming', 'cancelling'].includes(status);
  const staleTransient = transient && invoice.updatedAt && Date.now() - new Date(invoice.updatedAt).getTime() > 5 * 60 * 1000;
  if (!['unknown', 'error', 'cancelled', 'pending_confirmation'].includes(status) && !staleTransient) {
    return res.status(409).json({ message: status === 'confirmed' ? 'Une facture confirmée par la DGI ne peut pas être réinitialisée (utilisez un avoir).' : 'Une opération e-MECeF est en cours. Réessayez dans quelques minutes.', status });
  }
  const previous = { status, uid: invoice.fiscalisation?.uid || null, errorCode: invoice.fiscalisation?.errorCode || null, at: new Date() };
  const updated = await Invoice.findOneAndUpdate(
    { _id: invoice._id, owner: req.userId, 'fiscalisation.status': status },
    {
      $set: {
        'fiscalisation.status': 'non_emise', 'fiscalisation.uid': null, 'fiscalisation.errorCode': null, 'fiscalisation.errorDesc': null,
        'fiscalisation.requestFingerprint': null, 'fiscalisation.requestPayload': null, 'fiscalisation.dgiTotal': null, 'fiscalisation.expectedTotal': null,
      },
      $push: { 'fiscalisation.resetHistory': previous },
    },
    { returnDocument: 'after' }
  );
  if (!updated) return res.status(409).json({ message: 'L’état de la facture a changé entre-temps. Actualisez avant de réessayer.' });
  res.json({ status: 'non_emise', fiscalisation: updated.fiscalisation });
});

// Envoie la confirmation à la DGI pour une facture DÉJÀ verrouillée à l'état
// « confirming ». Partagé par la confirmation manuelle et la confirmation
// automatique juste après la préparation (la demande DGI expire en ~2 minutes :
// ne pas laisser l'utilisateur la perdre en tardant à cliquer).
async function runConfirm(invoice, user) {
  try {
    const result = await emecef.request({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted, method: 'PUT', path: `/api/invoice/${encodeURIComponent(invoice.fiscalisation.uid)}/confirm` });
    if (!result.ok || result.data?.status === false || result.data?.errorCode || !result.data?.codeMECeFDGI) {
      const apiError = safeApiError(result);
      const ambiguous = apiError.errorCode === '20' || result.ok || (result.httpStatus || 0) >= 500;
      invoice.fiscalisation.status = ambiguous ? 'unknown' : 'pending_confirmation';
      invoice.fiscalisation.errorCode = apiError.errorCode || (ambiguous ? 'RESPONSE_INCOMPLETE' : null);
      invoice.fiscalisation.errorDesc = apiError.errorDesc;
      invoice.fiscalisation.response = result.data;
      await invoice.save();
      return { code: 422, body: { message: apiError.errorDesc, errorCode: invoice.fiscalisation.errorCode, status: invoice.fiscalisation.status, doNotRetry: ambiguous } };
    }
    const data = result.data;
    invoice.fiscalisation.status = 'confirmed';
    invoice.fiscalisation.confirmedAt = new Date();
    invoice.fiscalisation.codeMECeFDGI = data.codeMECeFDGI || null;
    invoice.fiscalisation.nim = data.nim || null;
    invoice.fiscalisation.dateTime = data.dateTime || null;
    invoice.fiscalisation.qrCode = data.qrCode || null;
    invoice.fiscalisation.counters = data.counters || null;
    invoice.fiscalisation.response = data;
    invoice.fiscalisation.errorCode = null;
    invoice.fiscalisation.errorDesc = null;
    await invoice.save();
    // Le total DGI fait désormais foi : le statut commercial (payée / envoyée)
    // doit être recalculé par rapport à ce total.
    try { await syncInvoiceStatus(invoice._id); } catch (err) { console.error('Synchronisation du statut après confirmation DGI:', err.message); }
    return { code: 200, body: { status: 'confirmed', fiscalisation: invoice.fiscalisation } };
  } catch (error) {
    invoice.fiscalisation.status = 'unknown';
    invoice.fiscalisation.errorCode = error.code || 'NETWORK_ERROR';
    invoice.fiscalisation.errorDesc = error.message;
    await invoice.save();
    return { code: 502, body: { message: error.message, status: 'unknown', doNotRetry: true } };
  }
}

exports.confirmInvoice = asyncHandler(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Facture introuvable.' });
  if (existing.fiscalisation?.status === 'confirmed') return res.json({ status: 'confirmed', fiscalisation: existing.fiscalisation, alreadyConfirmed: true });
  if (existing.fiscalisation?.status !== 'pending_confirmation' || !existing.fiscalisation?.uid) {
    return res.status(409).json({ message: 'Aucune demande e-MECeF en attente de confirmation.', status: existing.fiscalisation?.status || 'non_emise' });
  }

  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Le jeton e-MECeF n’est plus configuré. Vérifiez le profil.' });

  // Verrou atomique pour empêcher confirmation et annulation simultanées depuis
  // plusieurs onglets ou sessions.
  const invoice = await Invoice.findOneAndUpdate(
    { _id: existing._id, owner: req.userId, 'fiscalisation.status': 'pending_confirmation', 'fiscalisation.uid': existing.fiscalisation.uid },
    { $set: { 'fiscalisation.status': 'confirming' } },
    { returnDocument: 'after' }
  );
  if (!invoice) {
    const latest = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
    return res.status(409).json({ message: 'Une autre opération e-MECeF est en cours. Actualisez la facture avant de continuer.', status: latest?.fiscalisation?.status || 'unknown' });
  }

  const outcome = await runConfirm(invoice, user);
  return res.status(outcome.code).json(outcome.body);
});

exports.cancelInvoice = asyncHandler(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Facture introuvable.' });
  if (existing.fiscalisation?.status !== 'pending_confirmation' || !existing.fiscalisation?.uid) {
    return res.status(409).json({ message: 'Seule une demande en attente peut être annulée dans cette version.', status: existing.fiscalisation?.status || 'non_emise' });
  }

  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Le jeton e-MECeF n’est plus configuré. Vérifiez le profil.' });
  const invoice = await Invoice.findOneAndUpdate(
    { _id: existing._id, owner: req.userId, 'fiscalisation.status': 'pending_confirmation', 'fiscalisation.uid': existing.fiscalisation.uid },
    { $set: { 'fiscalisation.status': 'cancelling' } },
    { returnDocument: 'after' }
  );
  if (!invoice) {
    const latest = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
    return res.status(409).json({ message: 'Une autre opération e-MECeF est en cours. Actualisez la facture avant de continuer.', status: latest?.fiscalisation?.status || 'unknown' });
  }

  try {
    const result = await emecef.request({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted, method: 'PUT', path: `/api/invoice/${encodeURIComponent(invoice.fiscalisation.uid)}/annuler` });
    if (!result.ok || result.data?.status === false || result.data?.errorCode) {
      const apiError = safeApiError(result);
      const ambiguous = apiError.errorCode === '20' || (result.httpStatus || 0) >= 500;
      invoice.fiscalisation.status = ambiguous ? 'unknown' : 'pending_confirmation';
      invoice.fiscalisation.errorCode = apiError.errorCode;
      invoice.fiscalisation.errorDesc = apiError.errorDesc;
      invoice.fiscalisation.response = result.data;
      await invoice.save();
      return res.status(422).json({ message: apiError.errorDesc, errorCode: apiError.errorCode, status: invoice.fiscalisation.status, doNotRetry: ambiguous });
    }
    invoice.fiscalisation.status = 'cancelled';
    invoice.fiscalisation.response = result.data;
    invoice.fiscalisation.errorCode = null;
    invoice.fiscalisation.errorDesc = null;
    await invoice.save();
    return res.json({ status: 'cancelled', fiscalisation: invoice.fiscalisation });
  } catch (error) {
    invoice.fiscalisation.status = 'unknown';
    invoice.fiscalisation.errorCode = error.code || 'NETWORK_ERROR';
    invoice.fiscalisation.errorDesc = error.message;
    await invoice.save();
    return res.status(502).json({ message: error.message, status: 'unknown', doNotRetry: true });
  }
});

// Récupération prudente : l'API DGI ne liste que les demandes encore en attente.
// Une absence de la liste ne prouve ni une confirmation ni une annulation ; on
// conserve donc l'état unknown plutôt que d'inventer un résultat fiscal.
exports.refreshInvoiceStatus = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable.' });
  const status = invoice.fiscalisation?.status || 'non_emise';
  if (['confirmed', 'cancelled'].includes(status)) {
    return res.json({ status, pendingOnDgi: false, fiscalisation: invoice.fiscalisation, message: 'Le résultat déjà enregistré est définitif dans Oryxa.' });
  }
  if (['submitting', 'confirming', 'cancelling'].includes(status) && invoice.updatedAt && Date.now() - new Date(invoice.updatedAt).getTime() < 30000) {
    return res.status(409).json({ message: 'Une opération e-MECeF est encore en cours. Attendez quelques secondes avant de vérifier de nouveau.', status });
  }
  if (!invoice.fiscalisation?.uid) {
    return res.status(409).json({ status, message: 'Aucun UID DGI n’est enregistré. Il est impossible de rapprocher cette demande automatiquement ; ne la renvoyez pas avant vérification auprès de la DGI.' });
  }
  const user = await User.findById(req.userId).select('+fiscalisation.tokenEncrypted');
  if (!user?.fiscalisation?.tokenEncrypted) return res.status(400).json({ message: 'Le jeton e-MECeF n’est plus configuré. Vérifiez le profil.' });

  const result = await emecef.request({ environment: 'test', tokenEncrypted: user.fiscalisation.tokenEncrypted, path: '/api/invoice' });
  if (!result.ok || result.data?.status !== true || !Array.isArray(result.data?.pendingRequestsList)) {
    const apiError = safeApiError(result);
    return res.status(502).json({ message: apiError.errorDesc || 'La DGI n’a pas fourni la liste des demandes en attente.', status });
  }

  const pendingOnDgi = result.data.pendingRequestsList.some((item) => String(item?.uid || '').toLowerCase() === String(invoice.fiscalisation.uid).toLowerCase());
  if (pendingOnDgi) {
    invoice.fiscalisation.status = 'pending_confirmation';
    invoice.fiscalisation.errorCode = null;
    invoice.fiscalisation.errorDesc = null;
    await invoice.save();
    return res.json({ status: 'pending_confirmation', pendingOnDgi: true, fiscalisation: invoice.fiscalisation, message: 'La demande est toujours en attente auprès de la DGI. Vous pouvez confirmer ou annuler depuis Oryxa.' });
  }

  invoice.fiscalisation.status = 'unknown';
  invoice.fiscalisation.errorCode = 'NOT_IN_PENDING_LIST';
  invoice.fiscalisation.errorDesc = 'Cet UID n’apparaît plus dans les demandes en attente. La liste DGI ne permet pas de distinguer une facture finalisée, annulée ou expirée. Ne renvoyez pas cette facture ; vérifiez le résultat auprès de la DGI.';
  await invoice.save();
  return res.json({ status: 'unknown', pendingOnDgi: false, fiscalisation: invoice.fiscalisation, message: invoice.fiscalisation.errorDesc });
});

exports._buildPayloadForTests = buildPayload;
