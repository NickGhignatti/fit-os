import { useState } from 'react';
import { useContainer, useStream } from '../app/hooks';
import { targetsForProfile } from '../domain/nutritionTargets';
import { ageOn, type Profile } from '../domain/profile';
import { parseNumber, today } from './format';
import { Loading, Modal } from './kit';

interface Field {
  readonly key: 'customKcal' | 'customProtein' | 'customCarbs' | 'customFat';
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
}

const FIELDS: readonly Field[] = [
  { key: 'customKcal', label: 'Calories', unit: 'kcal', min: 500, max: 10_000 },
  { key: 'customProtein', label: 'Protein', unit: 'g', min: 0, max: 1_000 },
  { key: 'customCarbs', label: 'Carbs', unit: 'g', min: 0, max: 2_000 },
  { key: 'customFat', label: 'Fat', unit: 'g', min: 0, max: 1_000 },
];

const AUTO_VALUE = { customKcal: 'kcal', customProtein: 'protein', customCarbs: 'carbs', customFat: 'fat' } as const;

const text = (n: number | null) => (n === null ? '' : String(Math.round(n * 10) / 10));

const TargetsForm = ({ profile, weightKg, onClose }: { profile: Profile; weightKg: number | null; onClose: () => void }) => {
  const { repos } = useContainer();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, text(profile[f.key])])) as Record<Field['key'], string>);

  // What the app would pick on its own, to show as a hint next to each empty box.
  const automatic = targetsForProfile(
    { ...profile, customKcal: null, customProtein: null, customCarbs: null, customFat: null },
    weightKg,
    ageOn(profile, today()),
  )?.nutrients;

  const parsed = FIELDS.map((f) => {
    const raw = values[f.key].trim();
    if (raw === '') return { field: f, value: null, valid: true };
    const n = parseNumber(raw);
    return { field: f, value: n, valid: n !== null && n >= f.min && n <= f.max };
  });
  const valid = parsed.every((p) => p.valid);
  const get = (key: Field['key']) => parsed.find((p) => p.field.key === key)!.value;

  const [kcal, protein, carbs, fat] = [get('customKcal'), get('customProtein'), get('customCarbs'), get('customFat')];
  const macroKcal = protein !== null && carbs !== null && fat !== null ? Math.round(protein * 4 + carbs * 4 + fat * 9) : null;
  const hint =
    macroKcal === null ? null
    : kcal === null ? `Your calories will be ${macroKcal} kcal, from your macros.`
    : Math.abs(macroKcal - kcal) > kcal * 0.05 ? `Your macros add up to ${macroKcal} kcal, which differs from ${Math.round(kcal)} kcal.`
    : null;

  const save = (next: Pick<Profile, Field['key']>) => {
    void repos.profile.saveProfile({ ...profile, ...next });
    onClose();
  };

  return (
    <Modal title="Daily targets" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save({ customKcal: kcal, customProtein: protein, customCarbs: carbs, customFat: fat });
        }}
      >
        <p className="small muted">
          Set your own numbers, for example from a dietitian. Anything you leave empty stays automatic.
        </p>
        {FIELDS.map((f) => {
          const entry = parsed.find((p) => p.field.key === f.key)!;
          const auto = automatic?.[AUTO_VALUE[f.key]];
          return (
            <div key={f.key} className="stack">
              <label className="stack">
                <span className="small muted">{f.label} ({f.unit})</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={values[f.key]}
                  aria-invalid={!entry.valid}
                  aria-describedby={entry.valid ? undefined : `${f.key}-error`}
                  placeholder={auto === undefined ? 'automatic' : `automatic: ${Math.round(auto)}`}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              </label>
              {!entry.valid && <span id={`${f.key}-error`} className="danger-text small">Between {f.min} and {f.max} {f.unit}.</span>}
            </div>
          );
        })}
        {hint && <p className="small muted" role="status">{hint}</p>}
        <div className="actions">
          <button
            type="button"
            className="btn secondary"
            disabled={FIELDS.every((f) => profile[f.key] === null)}
            onClick={() => save({ customKcal: null, customProtein: null, customCarbs: null, customFat: null })}
          >
            Reset to automatic
          </button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

export const TargetsDialog = ({ onClose }: { onClose: () => void }) => {
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const weights = useStream((c) => c.repos.profile.observeWeights());
  if (!profile || !weights) {
    return <Modal title="Daily targets" onClose={onClose}><Loading /></Modal>;
  }
  return <TargetsForm profile={profile} weightKg={weights.at(-1)?.kg ?? null} onClose={onClose} />;
};
