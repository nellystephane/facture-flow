const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const ORYXA_LOGO_PATH = path.join(__dirname, '..', 'assets', 'oryxa-logo.png');

// ============================================================================
// Configuration SMTP — Brevo (ex-Sendinblue)
// Créez un compte gratuit sur https://www.brevo.com (300 emails/jour offerts),
// puis récupérez votre clé SMTP dans : Paramètres > SMTP & API > SMTP.
// Renseignez ensuite dans backend/.env :
//   BREVO_SMTP_HOST=smtp-relay.brevo.com
//   BREVO_SMTP_PORT=587
//   BREVO_SMTP_USER=votre-login@smtp-brevo.com
//   BREVO_SMTP_PASS=votre-cle-smtp
//   EMAIL_FROM="Oryxa <no-reply@votredomaine.com>"
// ============================================================================

let transporter = null;
let configWarningShown = false;

/**
 * Oryxa accepte Brevo (historique) ou un SMTP générique.
 * Le serveur ne doit jamais rester bloqué 15+ secondes simplement parce que
 * le SMTP est indisponible : le frontend a besoin d'une réponse exploitable.
 */
function getSmtpConfig() {
  const host = process.env.SMTP_HOST || process.env.BREVO_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.BREVO_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.BREVO_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.BREVO_SMTP_PASS;

  if (!host || !user || !pass) return null;
  return { host, port, user, pass };
}

function isEmailConfigured() {
  return !!getSmtpConfig();
}

function getTransporter() {
  const config = getSmtpConfig();
  if (!config) {
    if (!configWarningShown) {
      console.warn(
        '[email] SMTP non configuré — renseignez SMTP_HOST/SMTP_USER/SMTP_PASS (ou BREVO_SMTP_*).'
      );
      configWarningShown = true;
    }
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      // Ne jamais laisser une requête HTTP attendre plusieurs minutes à cause
      // d'un serveur SMTP inaccessible ou d'une connexion réseau bloquée.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, attachments = [], replyTo }) {
  const t = getTransporter();
  if (!t) {
    const err = new Error(
      "L'envoi d'email n'est pas configuré côté serveur. Configurez SMTP_HOST, SMTP_USER et SMTP_PASS (ou BREVO_SMTP_HOST, BREVO_SMTP_USER et BREVO_SMTP_PASS)."
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const config = getSmtpConfig();
  const from = process.env.EMAIL_FROM || config.user;

  try {
    const logoAttachment = fs.existsSync(ORYXA_LOGO_PATH)
      ? [{ filename: 'oryxa-logo.png', path: ORYXA_LOGO_PATH, cid: 'oryxa-logo', contentDisposition: 'inline' }]
      : [];
    return await t.sendMail({
      from,
      to,
      subject,
      html,
      attachments: [...attachments, ...logoAttachment],
      replyTo,
    });
  } catch (err) {
    const e = new Error(`Échec SMTP : ${err.message}`);
    e.code = err.code || 'EMAIL_SEND_FAILED';
    e.cause = err;
    throw e;
  }
}

function baseTemplate({ titre, intro, boutonUrl, boutonLabel, corps, pied }) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1f;">
    <div style="background: #0a0a0c; padding: 18px 32px; border-radius: 12px 12px 0 0;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
        <img src="cid:oryxa-logo" alt="Oryxa" width="38" height="38" style="display:block; width:38px; height:38px; border-radius:10px; object-fit:contain;" />
        <span style="color:#fff; font-size:18px; font-weight:800;">Oryxa</span>
      </div>
      <h1 style="color: #fff; font-size: 20px; margin: 0;">${titre}</h1>
    </div>
    <div style="border: 1px solid #eee; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
      <p style="font-size: 15px; line-height: 1.6;">${intro}</p>
      ${corps || ''}
      ${boutonUrl ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${boutonUrl}" style="background: #d9524d; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">${boutonLabel || 'Voir'}</a>
      </div>` : ''}
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">${pied || ''}</p>
    </div>
  </div>`;
}

async function sendInvoiceEmail({ to, invoice, user, pdfBuffer, paymentUrl }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(invoice.totalTTC)) + ' ' + 'FCFA';
  const html = baseTemplate({
    titre: `Facture ${invoice.numero}`,
    intro: `Bonjour,<br/>Vous trouverez ci-joint la facture <strong>${invoice.numero}</strong> émise par <strong>${user.entreprise || user.nom}</strong>, d'un montant de <strong>${montant}</strong>.`,
    boutonUrl: paymentUrl,
    boutonLabel: 'Payer cette facture en ligne',
    pied: `${user.entreprise || user.nom} — ${user.email}${user.telephone ? ' — ' + user.telephone : ''}`,
  });
  return sendMail({
    to,
    subject: `Facture ${invoice.numero} — ${user.entreprise || user.nom}`,
    html,
    attachments: [{ filename: `Facture-${invoice.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

async function sendReceiptEmail({ to, invoice, user, payment, pdfBuffer }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(payment.montant)) + ' ' + 'FCFA';
  const html = baseTemplate({
    titre: 'Paiement confirmé',
    intro: `Bonjour,<br/>Nous confirmons la réception de votre paiement de <strong>${montant}</strong> pour la facture <strong>${invoice.numero}</strong>. Le reçu est joint à cet email.`,
    pied: `${user.entreprise || user.nom} — ${user.email}`,
  });
  return sendMail({
    to,
    subject: `Reçu de paiement — Facture ${invoice.numero}`,
    html,
    attachments: [{ filename: `Recu-${invoice.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

async function sendOwnerPaymentNotification({ to, invoice, payment, clientNom }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(payment.montant)) + ' FCFA';
  const html = baseTemplate({
    titre: 'Nouveau paiement reçu',
    intro: `${clientNom} vient de régler <strong>${montant}</strong> sur la facture <strong>${invoice.numero}</strong> (${payment.methode}).`,
    pied: 'Oryxa',
  });
  return sendMail({ to, subject: `Paiement reçu — Facture ${invoice.numero}`, html });
}

async function sendVerificationCode({ to, nom, code }) {
  const html = baseTemplate({
    titre: 'Confirmez votre adresse email',
    intro: `Bonjour ${nom},<br/>Voici votre code de confirmation Oryxa. Il est valable 15 minutes.`,
    corps: `<div style="text-align:center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0a0a0c;">${code}</span>
    </div>`,
    pied: "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",
  });
  return sendMail({ to, subject: `${code} — votre code de confirmation Oryxa`, html });
}

async function sendPasswordResetCode({ to, nom, code }) {
  const html = baseTemplate({
    titre: 'Réinitialisation de votre mot de passe',
    intro: `Bonjour ${nom},<br/>Voici votre code pour réinitialiser votre mot de passe Oryxa. Il est valable 15 minutes.`,
    corps: `<div style="text-align:center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0a0a0c;">${code}</span>
    </div>`,
    pied: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé.",
  });
  return sendMail({ to, subject: `${code} — réinitialisation de votre mot de passe Oryxa`, html });
}

async function sendQuoteEmail({ to, quote, user, pdfBuffer, quoteUrl }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(quote.totalTTC)) + ' ' + 'FCFA';
  const html = baseTemplate({
    titre: `Devis ${quote.numero}`,
    intro: `Bonjour,<br/>Vous trouverez ci-joint le devis <strong>${quote.numero}</strong> de <strong>${user.entreprise || user.nom}</strong>, d'un montant de <strong>${montant}</strong>.`,
    boutonUrl: quoteUrl,
    boutonLabel: 'Consulter et répondre au devis',
    pied: `${user.entreprise || user.nom} — ${user.email}${user.telephone ? ' — ' + user.telephone : ''}`,
  });
  return sendMail({
    to,
    subject: `Devis ${quote.numero} — ${user.entreprise || user.nom}`,
    html,
    attachments: [{ filename: `Devis-${quote.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

async function sendQuoteAccepteeNotification({ to, quote, invoiceUrl }) {
  const html = baseTemplate({
    titre: 'Devis accepté 🎉',
    intro: `Votre client a accepté le devis <strong>${quote.numero}</strong>. Une facture brouillon a été créée automatiquement à partir de ce devis — relisez-la puis envoyez-la à votre client quand vous êtes prêt.`,
    boutonUrl: invoiceUrl,
    boutonLabel: 'Voir la facture brouillon',
    pied: 'Oryxa',
  });
  return sendMail({ to, subject: `Devis ${quote.numero} accepté par le client`, html });
}

async function sendQuoteInfoRequestNotification({ to, quote, message }) {
  const html = baseTemplate({
    titre: "Demande d'informations sur un devis",
    intro: `Votre client souhaite des précisions avant de se décider sur le devis <strong>${quote.numero}</strong> :`,
    corps: `<div style="background:#f8f8fa; border-radius:8px; padding:16px; margin:16px 0; font-style:italic;">${message}</div>`,
    pied: 'Oryxa',
  });
  return sendMail({ to, subject: `Question du client sur le devis ${quote.numero}`, html });
}

async function sendPaymentReminderEmail({ to, invoice, user, paymentUrl, joursRetard }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(invoice.totalTTC)) + ' ' + 'FCFA';
  const html = baseTemplate({
    titre: `Rappel — Facture ${invoice.numero}`,
    intro: `Bonjour,<br/>Sauf erreur de notre part, la facture <strong>${invoice.numero}</strong> d'un montant de <strong>${montant}</strong>, émise par <strong>${user.entreprise || user.nom}</strong>, reste impayée${joursRetard ? ` (échéance dépassée de ${joursRetard} jour${joursRetard > 1 ? 's' : ''})` : ''}.`,
    boutonUrl: paymentUrl,
    boutonLabel: 'Payer cette facture en ligne',
    pied: `${user.entreprise || user.nom} — ${user.email}${user.telephone ? ' — ' + user.telephone : ''}. Si le paiement a déjà été effectué, merci d'ignorer ce message.`,
  });
  return sendMail({
    to,
    subject: `Rappel — Facture ${invoice.numero} en attente de paiement`,
    html,
  });
}

async function sendTeamInviteEmail({ to, nomInvite, nomInvitant, entreprise, code, roleLabel }) {
  const html = baseTemplate({
    titre: `${nomInvitant} vous invite à rejoindre ${entreprise || 'son espace'} sur Oryxa`,
    intro: `Bonjour ${nomInvite},<br/>${nomInvitant} vous a ajouté à son équipe sur Oryxa avec le rôle <strong>${roleLabel}</strong>. Utilisez le code ci-dessous pour définir votre mot de passe et accéder au compte.`,
    corps: `<div style="text-align:center;font-size:28px;font-weight:800;letter-spacing:4px;color:#0a0a0c;background:#f7f7f8;border-radius:12px;padding:18px 0;margin:20px 0;">${code}</div><p style="color:#6b7280;font-size:13px;">Ce code expire dans 15 minutes. Rendez-vous sur la page "Mot de passe oublié" avec votre adresse email pour définir votre mot de passe et vous connecter.</p>`,
    pied: 'Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet email.',
  });
  return sendMail({
    to,
    subject: `Invitation à rejoindre ${entreprise || 'une équipe'} sur Oryxa`,
    html,
  });
}


function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function sendSupportTicketNotification({ to, ticket, user, isFollowUp = false }) {
  const dernier = ticket.messages?.[ticket.messages.length - 1];
  const entreprise = user?.entreprise || user?.nom || 'Utilisateur Oryxa';
  const html = baseTemplate({
    titre: isFollowUp ? `Nouvelle réponse — ${escapeHtml(ticket.numero)}` : `Nouvelle demande de support — ${escapeHtml(ticket.numero)}`,
    intro: `${escapeHtml(entreprise)} (${escapeHtml(user?.email)}) a ${isFollowUp ? 'ajouté une réponse' : 'créé une demande'} dans le support Oryxa.`,
    corps: `<p><strong>Sujet :</strong> ${escapeHtml(ticket.sujet)}</p><p><strong>Catégorie :</strong> ${escapeHtml(ticket.categorie)}</p><div style="background:#f8f8fa;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;line-height:1.6;">${escapeHtml(dernier?.message)}</div><p style="font-size:13px;color:#6b7280;">Connectez-vous à l'espace administrateur Oryxa pour traiter cette demande.</p>`,
    pied: `Support Oryxa — ${to}`,
  });
  return sendMail({ to, subject: `[Oryxa Support] ${ticket.numero} — ${ticket.sujet}`, html, replyTo: user?.email });
}

async function sendSupportReplyNotification({ to, ticket }) {
  const dernier = ticket.messages?.[ticket.messages.length - 1];
  const html = baseTemplate({
    titre: 'Réponse du support Oryxa',
    intro: `Bonjour,<br/>Le support Oryxa a répondu à votre demande <strong>${escapeHtml(ticket.numero)}</strong>.`,
    corps: `<p><strong>${escapeHtml(ticket.sujet)}</strong></p><div style="background:#f8f8fa;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;line-height:1.6;">${escapeHtml(dernier?.message)}</div><p style="font-size:13px;color:#6b7280;">Vous pouvez répondre depuis votre espace Oryxa, rubrique Support.</p>`,
    pied: 'Oryxa — Support client',
  });
  return sendMail({ to, subject: `Réponse du support — ${ticket.numero}`, html });
}

module.exports = {
  isEmailConfigured,
  sendMail,
  sendInvoiceEmail,
  sendReceiptEmail,
  sendOwnerPaymentNotification,
  sendVerificationCode,
  sendPasswordResetCode,
  sendQuoteEmail,
  sendQuoteAccepteeNotification,
  sendQuoteInfoRequestNotification,
  sendPaymentReminderEmail,
  sendTeamInviteEmail,
  sendPayoutDestinationConfirmation,
  sendSupportTicketNotification,
  sendSupportReplyNotification,
};

/**
 * Confirme une nouvelle destination de reversement. La confirmation prouve
 * que l'utilisateur contrôle l'adresse email Oryxa ; elle ne prétend pas
 * vérifier la propriété du numéro Mobile Money ou du compte bancaire.
 */
async function sendPayoutDestinationConfirmation({ to, nom, destination, confirmationUrl }) {
  const html = baseTemplate({
    titre: 'Confirmez votre moyen de retrait',
    intro: `Bonjour ${nom || ''},<br/>Vous avez configuré un nouveau moyen de retrait sur Oryxa : <strong>${destination}</strong>.`,
    corps: `<p style="font-size:14px; line-height:1.6;">Assurez-vous que ce moyen peut recevoir des paiements avant de confirmer. Après confirmation, Oryxa pourra l'utiliser pour vos prochains reversements selon votre fréquence configurée.</p>`,
    boutonUrl: confirmationUrl,
    boutonLabel: 'Confirmer ce moyen de retrait',
    pied: "Si vous n'êtes pas à l'origine de cette modification, ignorez cet email. Le nouveau moyen restera en attente et aucun reversement ne sera envoyé dessus.",
  });
  return sendMail({ to, subject: 'Confirmez votre moyen de retrait Oryxa', html });
}
