import Select from './ui/Select';
import { DEVISES, deviseInfo, normalizeDevise } from '../utils/format';

interface Props {
  devise: string;
  tauxChange: number;
  onChange: (next: { devise: string; tauxChange: number }) => void;
  /** Texte d'aide spécifique (ex. restrictions e-MECeF). */
  hint?: string;
}

/** Choix de la devise d'un document + taux de change figé (FCFA pour 1 unité). */
export default function DeviseField({ devise, tauxChange, onChange, hint }: Props) {
  const code = normalizeDevise(devise);
  const info = deviseInfo(code);
  const etrangere = code !== 'XOF';

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="field-label">Devise du document</label>
        <Select
          value={code}
          onChange={(v) => onChange({ devise: v, tauxChange: v === 'XOF' ? 1 : (v === code ? tauxChange : 0) })}
          options={DEVISES.map((d) => ({ value: d.code, label: `${d.nom} — ${d.label}` }))}
        />
      </div>
      {etrangere && (
        <div>
          <label className="field-label">Taux de change : 1 {info.label} = … FCFA *</label>
          <input
            type="number" min={0} step="any" className="field" required
            value={tauxChange || ''} placeholder="Ex : 656"
            onChange={(e) => onChange({ devise: code, tauxChange: Number(e.target.value) })}
          />
        </div>
      )}
      <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
        {etrangere
          ? 'Le taux est figé sur ce document : il sert uniquement à convertir vos statistiques en FCFA. Le paiement en ligne et la normalisation e-MECeF restent réservés aux factures en FCFA ; les autres se règlent par virement ou espèces, que vous enregistrez dans Oryxa.'
          : (hint || 'Les factures en FCFA gardent le paiement en ligne et la normalisation e-MECeF.')}
      </p>
    </div>
  );
}
