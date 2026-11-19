import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Trash2, Check } from 'lucide-react';
import { getServices } from '../api/services';
import { createVenteRapide } from '../api/invoices';
import type { Service, MethodePaiement } from '../types';
import PageHeader from '../components/ui/PageHeader';
import CountUp from '../components/ui/CountUp';
import { useToast } from '../contexts/ToastContext';
import { apiError, formatFCFA, METHODE_LABEL } from '../utils/format';

interface Ligne { key: string; service: string | null; description: string; quantite: number; prixUnitaire: number }

const METHODES: MethodePaiement[] = ['especes', 'mtn_money', 'moov_money', 'carte'];

export default function VenteRapide() {
  const [services, setServices] = useState<Service[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [methode, setMethode] = useState<MethodePaiement>('especes');
  const [libre, setLibre] = useState({ description: '', prix: 0 });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { getServices().then((r) => setServices(r.data)).catch((e) => toast(apiError(e), 'error')); /* eslint-disable-next-line */ }, []);

  const total = useMemo(() => lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0), [lignes]);

  const ajouter = (s: Service) => {
    setLignes((cur) => {
      const ex = cur.find((l) => l.service === s._id);
      if (ex) return cur.map((l) => (l === ex ? { ...l, quantite: l.quantite + 1 } : l));
      return [...cur, { key: s._id, service: s.suiviStock ? s._id : null, description: s.nom, quantite: 1, prixUnitaire: s.prix }];
    });
  };
  const changeQte = (key: string, d: number) =>
    setLignes((cur) => cur.map((l) => (l.key === key ? { ...l, quantite: Math.max(1, l.quantite + d) } : l)));

  const ajouterLibre = () => {
    if (!libre.description.trim() || libre.prix < 0) return;
    setLignes((cur) => [...cur, { key: `libre-${Date.now()}`, service: null, description: libre.description.trim(), quantite: 1, prixUnitaire: libre.prix }]);
    setLibre({ description: '', prix: 0 });
  };

  const encaisser = async () => {
    if (!lignes.length) return;
    setSaving(true);
    try {
      const res = await createVenteRapide({
        items: lignes.map((l) => ({ description: l.description, quantite: l.quantite, prixUnitaire: l.prixUnitaire, service: l.service })),
        methode,
      });
      toast(`Vente encaissée : ${formatFCFA(total)}`);
      navigate(`/app/invoices/${res.data.invoice._id}`);
    } catch (err) { toast(apiError(err), 'error'); } finally { setSaving(false); }
  };

  const filtres = services.filter((s) => s.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Vente comptoir" subtitle="Encaissez une vente en quelques secondes, sans créer de client" icon={<ShoppingCart size={20} />} />
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <input className="field" placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {services.length === 0 ? (
            <p className="glass-card p-8 text-center text-sm text-gray-500">Ajoutez des produits dans « Produits &amp; Services » pour les vendre d’un clic, ou saisissez une ligne libre ci-dessous.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 fx-stagger">
              {filtres.map((s) => (
                <button key={s._id} type="button" onClick={() => ajouter(s)} className="glass-card p-4 text-left hover:border-[#d9524d] transition-soft">
                  <p className="font-semibold text-[#0a0a0c] dark:text-white truncate">{s.nom}</p>
                  <p className="text-[#d9524d] font-extrabold mt-1">{formatFCFA(s.prix)}</p>
                  {s.suiviStock && <p className={`text-xs mt-1 ${(s.stock ?? 0) <= 0 ? 'text-[#d9524d]' : 'text-gray-500'}`}>{s.stock ?? 0} en stock</p>}
                </button>
              ))}
            </div>
          )}
          <div className="glass-card p-4 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="field-label">Ligne libre</label>
              <input className="field" placeholder="Description" value={libre.description} onChange={(e) => setLibre({ ...libre, description: e.target.value })} />
            </div>
            <div className="w-32">
              <label className="field-label">Prix</label>
              <input className="field" type="number" min={0} value={libre.prix} onChange={(e) => setLibre({ ...libre, prix: Number(e.target.value) })} />
            </div>
            <button type="button" className="btn-ghost" onClick={ajouterLibre}><Plus size={16} /> Ajouter</button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="glass-card p-5 lg:sticky lg:top-6">
            <h3 className="font-bold mb-4">Panier</h3>
            {lignes.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Touchez un produit pour l’ajouter.</p>
            ) : (
              <ul className="space-y-3 mb-4">
                {lignes.map((l) => (
                  <li key={l.key} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate">{l.description}</span>
                    <button type="button" className="btn-icon" onClick={() => changeQte(l.key, -1)}><Minus size={14} /></button>
                    <span className="w-6 text-center tabular-nums">{l.quantite}</span>
                    <button type="button" className="btn-icon" onClick={() => changeQte(l.key, 1)}><Plus size={14} /></button>
                    <span className="w-24 text-right font-semibold tabular-nums">{formatFCFA(l.quantite * l.prixUnitaire)}</span>
                    <button type="button" className="btn-icon" onClick={() => setLignes((c) => c.filter((x) => x.key !== l.key))}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end justify-between border-t border-gray-100 dark:border-white/10 pt-4">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-3xl font-extrabold tabular-nums"><CountUp value={formatFCFA(total)} duration={500} /></span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {METHODES.map((m) => (
                <button key={m} type="button" onClick={() => setMethode(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-soft ${methode === m ? 'bg-[#14151a] text-white border-[#14151a]' : 'border-gray-200 dark:border-white/15'}`}>{METHODE_LABEL[m]}</button>
              ))}
            </div>
            <button type="button" className="btn-primary w-full justify-center mt-4" disabled={!lignes.length || saving} onClick={encaisser}>
              <Check size={18} /> {saving ? 'Encaissement…' : 'Encaisser la vente'}
            </button>
            <p className="text-xs text-gray-500 mt-3">Une facture payée et un reçu sont créés. Le stock des produits suivis baisse automatiquement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
