const nodemailer = require('nodemailer');

// ============================================================================
// Configuration SMTP — Brevo (ex-Sendinblue)
// Créez un compte gratuit sur https://www.brevo.com (300 emails/jour offerts),
// puis récupérez votre clé SMTP dans : Paramètres > SMTP & API > SMTP.
// Renseignez ensuite dans backend/.env :
//   BREVO_SMTP_HOST=smtp-relay.brevo.com
//   BREVO_SMTP_PORT=587
//   BREVO_SMTP_USER=votre-login@smtp-brevo.com
//   BREVO_SMTP_PASS=votre-cle-smtp
//   EMAIL_FROM="FactuFlow <no-reply@votredomaine.com>"
// ============================================================================

let transporter = null;
let configWarningShown = false;

function isEmailConfigured() {
  return !!(process.env.BREVO_SMTP_HOST && process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
}

function getTransporter() {
  if (!isEmailConfigured()) {
    if (!configWarningShown) {
      console.warn(
        "[email] Variables BREVO_SMTP_* absentes du .env — l'envoi d'emails est désactivé tant qu'elles ne sont pas renseignées."
      );
      configWarningShown = true;
    }
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: Number(process.env.BREVO_SMTP_PORT) === 465,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Envoie un email. Lance une erreur explicite si le SMTP n'est pas configuré,
 * pour que les contrôleurs appelants puissent renvoyer un message clair au
 * lieu de prétendre silencieusement que l'email est parti.
 */
async function sendMail({ to, subject, html, attachments = [], replyTo }) {
  const t = getTransporter();
  if (!t) {
    const err = new Error(
      "L'envoi d'email n'est pas configuré côté serveur (variables BREVO_SMTP_* manquantes)."
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  const from = process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER;
  return t.sendMail({ from, to, subject, html, attachments, replyTo });
}

function baseTemplate({ titre, intro, boutonUrl, boutonLabel, corps, pied }) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1f;">
    <div style="background: #0a0a0c; padding: 24px 32px; border-radius: 12px 12px 0 0;">
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
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(invoice.totalTTC)) + ' ' + (user.devise || 'FCFA');
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
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(payment.montant)) + ' ' + (user.devise || 'FCFA');
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
    pied: 'FactuFlow',
  });
  return sendMail({ to, subject: `Paiement reçu — Facture ${invoice.numero}`, html });
}

async function sendVerificationCode({ to, nom, code }) {
  const html = baseTemplate({
    titre: 'Confirmez votre adresse email',
    intro: `Bonjour ${nom},<br/>Voici votre code de confirmation FactuFlow. Il est valable 15 minutes.`,
    corps: `<div style="text-align:center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0a0a0c;">${code}</span>
    </div>`,
    pied: "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",
  });
  return sendMail({ to, subject: `${code} — votre code de confirmation FactuFlow`, html });
}

async function sendPasswordResetCode({ to, nom, code }) {
  const html = baseTemplate({
    titre: 'Réinitialisation de votre mot de passe',
    intro: `Bonjour ${nom},<br/>Voici votre code pour réinitialiser votre mot de passe FactuFlow. Il est valable 15 minutes.`,
    corps: `<div style="text-align:center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0a0a0c;">${code}</span>
    </div>`,
    pied: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé.",
  });
  return sendMail({ to, subject: `${code} — réinitialisation de votre mot de passe FactuFlow`, html });
}

async function sendQuoteEmail({ to, quote, user, pdfBuffer, quoteUrl }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(quote.totalTTC)) + ' ' + (user.devise || 'FCFA');
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
    pied: 'FactuFlow',
  });
  return sendMail({ to, subject: `Devis ${quote.numero} accepté par le client`, html });
}

async function sendQuoteInfoRequestNotification({ to, quote, message }) {
  const html = baseTemplate({
    titre: "Demande d'informations sur un devis",
    intro: `Votre client souhaite des précisions avant de se décider sur le devis <strong>${quote.numero}</strong> :`,
    corps: `<div style="background:#f8f8fa; border-radius:8px; padding:16px; margin:16px 0; font-style:italic;">${message}</div>`,
    pied: 'FactuFlow',
  });
  return sendMail({ to, subject: `Question du client sur le devis ${quote.numero}`, html });
}

async function sendPaymentReminderEmail({ to, invoice, user, paymentUrl, joursRetard }) {
  const montant = new Intl.NumberFormat('fr-FR').format(Math.round(invoice.totalTTC)) + ' ' + (user.devise || 'FCFA');
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
    titre: `${nomInvitant} vous invite à rejoindre ${entreprise || 'son espace'} sur FactuFlow`,
    intro: `Bonjour ${nomInvite},<br/>${nomInvitant} vous a ajouté à son équipe sur FactuFlow avec le rôle <strong>${roleLabel}</strong>. Utilisez le code ci-dessous pour définir votre mot de passe et accéder au compte.`,
    corps: `<div style="text-align:center;font-size:28px;font-weight:800;letter-spacing:4px;color:#0a0a0c;background:#f7f7f8;border-radius:12px;padding:18px 0;margin:20px 0;">${code}</div><p style="color:#6b7280;font-size:13px;">Ce code expire dans 15 minutes. Rendez-vous sur la page "Mot de passe oublié" avec votre adresse email pour définir votre mot de passe et vous connecter.</p>`,
    pied: 'Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet email.',
  });
  return sendMail({
    to,
    subject: `Invitation à rejoindre ${entreprise || 'une équipe'} sur FactuFlow`,
    html,
  });
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
};
