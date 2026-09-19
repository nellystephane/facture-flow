import { useEffect, useState } from 'react';
import { Headphones, Mail, Plus, Send, MessageCircle, ChevronRight } from 'lucide-react';
import { supportApi } from '../api/support';
import PageHeader from '../components/ui/PageHeader';

interface Message { _id: string; auteurType: 'utilisateur' | 'admin'; auteurNom: string; message: string; createdAt: string; }
interface Ticket { _id: string; numero: string; sujet: string; categorie: string; statut: string; dernierMessagePar: string; createdAt: string; updatedAt: string; messages: Message[]; }

const categories = [
  ['question', 'Question générale'], ['paiement', 'Paiement'], ['facture', 'Facture'],
  ['reversement', 'Reversement'], ['abonnement', 'Abonnement'], ['bug', 'Problème / bug'], ['autre', 'Autre'],
];

const statusLabel: Record<string, string> = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', ferme: 'Fermé' };

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [sujet, setSujet] = useState('');
  const [categorie, setCategorie] = useState('question');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setTickets((await supportApi.list()).data.tickets); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openTicket = async (id: string) => {
    const t = (await supportApi.get(id)).data.ticket;
    setSelected(t);
  };

  const create = async () => {
    if (!sujet.trim() || !message.trim()) return;
    setBusy(true); setError('');
    try {
      const t = (await supportApi.create({ sujet, categorie, message })).data.ticket;
      setSujet(''); setMessage(''); setCreating(false);
      await load(); setSelected(t);
    } catch (e: any) { setError(e.response?.data?.message || 'Impossible d’envoyer votre demande.'); }
    finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true); setError('');
    try {
      const t = (await supportApi.reply(selected._id, reply)).data.ticket;
      setSelected(t); setReply(''); await load();
    } catch (e: any) { setError(e.response?.data?.message || 'Impossible d’envoyer votre réponse.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Support client" subtitle="Une question ou un problème ? Écrivez à l’équipe Oryxa." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#d9524d]/10 text-[#d9524d]"><Headphones size={21} /></div>
          <div><p className="font-bold">Assistance Oryxa</p><p className="text-sm text-gray-500 mt-1">Envoyez une demande directement depuis votre espace. Elle sera suivie par notre équipe.</p></div>
        </div>
        <a href="mailto:contact@emgdigitalsolutions.bj" className="glass-card p-5 flex items-start gap-4 hover:border-[#d9524d]/30 transition-soft">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#d9524d]/10 text-[#d9524d]"><Mail size={21} /></div>
          <div><p className="font-bold">Email</p><p className="text-sm text-[#d9524d] mt-1">contact@emgdigitalsolutions.bj</p></div>
        </a>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Mes demandes</h2>
        <button className="btn-primary" onClick={() => { setCreating(true); setSelected(null); }}><Plus size={16} /> Nouvelle demande</button>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">{error}</div>}

      {creating && (
        <div className="glass-card p-5 flex flex-col gap-4">
          <div><label className="field-label">Sujet</label><input className="field" value={sujet} onChange={e => setSujet(e.target.value)} placeholder="Ex. Mon paiement n’apparaît pas" maxLength={160} /></div>
          <div><label className="field-label">Catégorie</label><select className="field" value={categorie} onChange={e => setCategorie(e.target.value)}>{categories.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="field-label">Votre message</label><textarea className="field" rows={6} value={message} onChange={e => setMessage(e.target.value)} placeholder="Décrivez votre demande avec le plus de détails possible…" maxLength={5000} /></div>
          <div className="flex gap-2"><button className="btn-primary" disabled={busy || !sujet.trim() || !message.trim()} onClick={create}><Send size={16} /> {busy ? 'Envoi…' : 'Envoyer au support'}</button><button className="btn-ghost" onClick={() => setCreating(false)}>Annuler</button></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card overflow-hidden">
          {loading ? <div className="flex justify-center py-16"><div className="spinner" /></div> : tickets.length === 0 ? (
            <div className="p-10 text-center text-gray-500"><MessageCircle className="mx-auto mb-3 opacity-50" /><p>Aucune demande pour le moment.</p></div>
          ) : tickets.map(t => (
            <button key={t._id} onClick={() => openTicket(t._id)} className={`w-full text-left p-4 border-b border-white/10 hover:bg-white/5 transition-soft ${selected?._id === t._id ? 'bg-white/5' : ''}`}>
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-gray-500">{t.numero}</span><span className="badge">{statusLabel[t.statut] || t.statut}</span></div>
              <p className="font-semibold mt-2 truncate">{t.sujet}</p><p className="text-xs text-gray-500 mt-1">{new Date(t.updatedAt).toLocaleString('fr-FR')}</p>
              <ChevronRight size={15} className="float-right -mt-4 text-gray-500" />
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 glass-card p-5 min-h-[360px]">
          {!selected ? <div className="h-full min-h-[320px] flex items-center justify-center text-center text-gray-500"><div><MessageCircle className="mx-auto mb-3 opacity-50" /><p>Sélectionnez une demande pour voir les échanges.</p></div></div> : <>
            <div className="border-b border-white/10 pb-4 mb-4"><p className="text-xs text-gray-500">{selected.numero} · {statusLabel[selected.statut]}</p><h2 className="text-xl font-bold mt-1">{selected.sujet}</h2></div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {selected.messages.map(m => <div key={m._id} className={`rounded-2xl p-4 ${m.auteurType === 'admin' ? 'bg-[#d9524d]/10 border border-[#d9524d]/20' : 'bg-white/5'}`}><div className="flex justify-between gap-3 text-xs text-gray-500 mb-2"><span className="font-semibold">{m.auteurType === 'admin' ? 'Support Oryxa' : 'Vous'}</span><span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span></div><p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p></div>)}
            </div>
            {selected.statut !== 'ferme' && <div className="mt-4 flex gap-2"><textarea className="field min-h-[80px]" value={reply} onChange={e => setReply(e.target.value)} placeholder="Répondre au support…" /><button className="btn-primary self-end" disabled={busy || !reply.trim()} onClick={sendReply}><Send size={16} /></button></div>}
          </>}
        </div>
      </div>
    </div>
  );
}
