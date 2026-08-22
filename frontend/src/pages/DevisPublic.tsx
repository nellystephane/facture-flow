import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2, AlertTriangle, MessageCircleQuestion, FileText, Download } from 'lucide-react';
import { getPublicQuote, respondPublicQuote, type PublicQuoteResponse } from '../api/public';
import { quotePdfUrl } from '../api/quotes';
import { formatFCFA, formatDate, apiError } from '../utils/format';

export default function DevisPublic() {
  const { token } = useParams();
  const [data, setData] = useState<PublicQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'choix' | 'demande_infos'>('choix');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultat, setResultat] = useState<'accepte' | 'demande_envoyee' | null>(null);

  useEffect(() => {
    if (!token) return;
    getPublicQuote(token)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err, 'Devis introuvable ou lien invalide.')))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccepter = async () => {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await respondPublicQuote(token, { action: 'accepter' });
      setData((d) => (d ? { ...d, quote: res.data.quote } : d));
      setResultat('accepte');
    } catch (err) {
      setError(apiError(err, "Impossible d'accepter ce devis pour le moment."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemanderInfos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await respondPublicQuote(token, { action: 'demander_infos', message });
      setData((d) => (d ? { ...d, quote: res.data.quote } : d));
      setResultat('demande_envoyee');
    } catch (err) {
      setError(apiError(err, "Impossible d'envoyer votre demande pour le moment."));
    } finally {
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
  const { quote, emetteur, totalTTC } = data;
  const dejaAccepte = quote.statut === 'accepte' || resultat === 'accepte';
  const dejaRefuse = quote.statut === 'refuse';

  return (
    <div className="app-bg min-h-screen py-10 px-4">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="relative max-w-lg mx-auto animate-fade-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 justify-center mb-2">
            <Building2 size={20} className="text-[#d9524d]" />
            <span className="font-extrabold text-lg text-[#0a0a0c]">{emetteur.entreprise || emetteur.nom}</span>
          </div>
          <p className="text-sm text-gray-500">Devis {quote.numero} • Émis le {formatDate(quote.dateEmission)}</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          <div className="text-center pb-6 mb-6 border-b border-gray-100">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Montant du devis</p>
            <p className="text-3xl font-extrabold text-[#0a0a0c]">{formatFCFA(totalTTC)}</p>
            {quote.objet && <p className="text-sm text-gray-500 mt-2">{quote.objet}</p>}
          </div>

          <a
            href={quotePdfUrl(quote._id)}
            target="_blank" rel="noreferrer"
            className="btn-ghost text-sm w-full justify-center mb-5"
          >
            <FileText size={16} /> Voir le détail du devis (PDF) <Download size={14} />
          </a>

          {dejaAccepte ? (
            <div className="text-center py-4">
              <CheckCircle2 className="mx-auto text-green-600 mb-3" size={40} />
              <p className="font-bold text-[#0a0a0c] mb-1">Devis accepté</p>
              <p className="text-sm text-gray-500">
                Merci ! {emetteur.entreprise || emetteur.nom} a été notifié(e) et va vous faire parvenir votre facture prochainement.
              </p>
            </div>
          ) : dejaRefuse ? (
            <div className="text-center py-4">
              <p className="font-bold text-[#0a0a0c] mb-1">Ce devis a été refusé</p>
              <p className="text-sm text-gray-500">Contactez {emetteur.entreprise || emetteur.nom} directement si vous changez d'avis.</p>
            </div>
          ) : resultat === 'demande_envoyee' ? (
            <div className="text-center py-4">
              <MessageCircleQuestion className="mx-auto text-[#d9524d] mb-3" size={40} />
              <p className="font-bold text-[#0a0a0c] mb-1">Demande envoyée</p>
              <p className="text-sm text-gray-500">{emetteur.entreprise || emetteur.nom} a reçu votre question et reviendra vers vous.</p>
            </div>
          ) : mode === 'demande_infos' ? (
            <form onSubmit={handleDemanderInfos} className="space-y-3">
              <label className="field-label">Votre question ou précision souhaitée</label>
              <textarea
                required
                rows={4}
                className="field"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex : Pouvez-vous détailler le poste « installation » ?"
              />
              {error && <p className="text-sm text-[#d9524d] bg-[#d9524d]/5 rounded-lg p-2.5">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode('choix')} className="btn-ghost text-sm flex-1 justify-center">
                  Retour
                </button>
                <button type="submit" disabled={submitting} className="btn-primary text-sm flex-1 justify-center">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5">
              {error && <p className="text-sm text-[#d9524d] bg-[#d9524d]/5 rounded-lg p-2.5">{error}</p>}
              <button onClick={handleAccepter} disabled={submitting} className="btn-primary w-full justify-center text-sm">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Accepter ce devis
              </button>
              <button onClick={() => setMode('demande_infos')} className="btn-ghost w-full justify-center text-sm">
                <MessageCircleQuestion size={16} /> Demander plus d'informations
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Propulsé par FactuFlow</p>
      </div>
    </div>
  );
}
