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

module.exports = {
  isEmailConfigured,
  sendMail,
  sendInvoiceEmail,
  sendReceiptEmail,
  sendOwnerPaymentNotification,
};
