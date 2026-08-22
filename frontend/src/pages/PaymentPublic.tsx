import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2, ShieldCheck, Smartphone, CreditCard, Landmark, Receipt, AlertTriangle } from 'lucide-react';
import { getPublicInvoice, initiateOnlinePayment, getPublicPaymentStatus, publicReceiptUrl, type PublicInvoiceResponse } from '../api/public';
import { formatFCFA, formatDate, apiError } from '../utils/format';
import InfoHint from '../components/ui/InfoHint';

export default function PaymentPublic() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PublicInvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [checkingReturn, setCheckingReturn] = useState(false);

  const load = () => {
    if (!token) return;
    getPublicInvoice(token)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err, 'Facture introuvable ou lien invalide.')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  // Après un retour depuis FedaPay (callback_url), on vérifie le statut réel
  // via l'API plutôt que de faire confiance au simple retour du navigateur —
  // seul le webhook côté serveur fait foi du paiement.
  useEffect(() => {
    if (searchParams.get('statut') !== 'retour' || !token) return;
    setCheckingReturn(true);
    let tries = 0;
    const interval = setInterval(async () => {
      tries += 1;
      try {
        const res = await getPublicPaymentStatus(token);
        if (res.data.statutFacture === 'payee' || tries >= 6) {
          clearInterval(interval);
          setCheckingReturn(false);
          load();
        }
      } catch {
        clearInterval(interval);
        setCheckingReturn(false);
      }
    }, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await initiateOnlinePayment(token, form);
      window.location.href = res.data.paymentUrl;
    } catch (err) {
      setError(apiError(err, "Impossible de démarrer le paiement pour le moment."));
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md text-center">
          <AlertTriangle className="mx-auto text-[#d9524d] mb-3" size={32} />
          <p className="font-bold text-[#0a0a0c] mb-1">Lien invalide</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { invoice, emetteur, totalTTC, totalPaye, payments } = data;
  const reste = Math.max(0, totalTTC - totalPaye);
  const dejaPayee = invoice.statut === 'payee' || reste <= 0.5;

  return (
    <div className="app-bg min-h-screen py-10 px-4">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="relative max-w-lg mx-auto animate-fade-up">
        {/* En-tête émetteur */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 justify-center mb-2">
            <Building2 size={20} className="text-[#d9524d]" />
            <span className="font-extrabold text-lg text-[#0a0a0c]">{emetteur.entreprise || emetteur.nom}</span>
          </div>
          <p className="text-sm text-gray-500">Facture {invoice.numero} • Émise le {formatDate(invoice.dateEmission)}</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          {/* Montant */}
          <div className="text-center pb-6 mb-6 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
              {dejaPayee ? 'Montant réglé' : 'Montant à payer'}
            </p>
            <p className="text-3xl font-extrabold text-[#0a0a0c]">{formatFCFA(dejaPayee ? totalTTC : reste)}</p>
            {totalPaye > 0 && !dejaPayee && (
              <p className="text-xs text-gray-400 mt-1">{formatFCFA(totalPaye)} déjà réglé sur un total de {formatFCFA(totalTTC)}</p>
            )}
          </div>

          {dejaPayee ? (
            <div className="text-center py-4">
              <CheckCircle2 className="mx-auto text-green-600 mb-3" size={40} />
              <p className="font-bold text-[#0a0a0c] mb-1">Facture réglée</p>
              <p className="text-sm text-gray-500 mb-5">Merci pour votre paiement. Vous pouvez télécharger votre reçu ci-dessous.</p>
              {payments.filter(p => p.statut === 'complete' || !p.statut).map((p) => (
                <a
                  key={p._id}
                  href={publicReceiptUrl(token!, p._id)}
                  target="_blank" rel="noreferrer"
                  className="btn-primary text-sm w-full justify-center mb-2"
                >
                  <Receipt size={16} /> Télécharger le reçu — {formatFCFA(p.montant)}
                </a>
              ))}
            </div>
          ) : checkingReturn ? (
            <div className="text-center py-8">
              <Loader2 className="mx-auto animate-spin text-[#d9524d] mb-3" size={28} />
              <p className="text-sm text-gray-500">Vérification de votre paiement en cours...</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center">
                  Moyens de paiement acceptés
                  <InfoHint text="Après avoir renseigné vos coordonnées, vous serez redirigé vers une page sécurisée FedaPay où vous choisirez précisément votre mode de paiement (numéro Mobile Money, carte, ou coordonnées de virement)." />
                </p>
                <div className="flex gap-2 flex-wrap text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100"><Smartphone size={13} /> MTN / Moov Money</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100"><CreditCard size={13} /> Carte bancaire</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100"><Landmark size={13} /> Virement bancaire</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Prénom</label>
                    <input className="field" value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">Nom</label>
                    <input className="field" value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Email *</label>
                  <input type="email" required className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.com" />
                </div>
                <div>
                  <label className="field-label">Téléphone (Mobile Money)</label>
                  <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ex: 66000001" />
                </div>

                {error && <p className="text-sm text-[#d9524d] bg-[#d9524d]/5 rounded-lg p-2.5">{error}</p>}

                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center text-sm mt-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Continuer vers le paiement sécurisé
                </button>
                <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
                  <ShieldCheck size={12} /> Paiement sécurisé via FedaPay
                </p>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Propulsé par FactuFlow</p>
      </div>
    </div>
  );
}
