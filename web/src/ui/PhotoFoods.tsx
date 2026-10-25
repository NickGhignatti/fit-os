import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { searchFoods } from '../domain/catalog';
import { withEntry } from '../domain/foodLog';
import { newId } from '../domain/id';
import { portionOf, type FoodItem } from '../domain/nutrition';
import {
  findFoods, itemGrams, itemNutrients, partsOf, plateNutrients, roundGrams, withPartGrams, withTotalGrams,
  type PlateItem, type RecogniserModel,
} from '../domain/photoFoods';
import { observeCalorieDay } from '../domain/useCases';
import { DEFAULT_MEALS, formatKcal, formatMacros, parseNumber } from './format';
import { useAsync } from './hooks';
import { Empty, EnergyCard, Icons, Modal, PageHeader, useDebounced } from './kit';
import { mealNamesOf } from './Tracker';

type Phase =
  | { kind: 'pick' }
  | { kind: 'working'; progress: number | null }
  | { kind: 'ready'; model: RecogniserModel }
  | { kind: 'failed'; message: string };

/** A grams box that keeps what is being typed and reports only valid amounts. */
const GramsField = ({ label, grams, onChange }: { label: string; grams: number; onChange: (grams: number) => void }) => {
  const [text, setText] = useState(String(Math.round(grams)));
  useEffect(() => {
    if (parseNumber(text) !== Math.round(grams)) setText(String(Math.round(grams)));
    // Only an outside change (a swapped food, a resized dish) rewrites what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grams]);
  return (
    <label className="grams-field">
      <input className="field" inputMode="decimal" aria-label={label} value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          if (n !== null && n > 0 && n <= 10_000) onChange(n);
        }} />
      <span className="muted">g</span>
    </label>
  );
};

/** The two ways in, each a full-width tile with a picture: the camera, or a photo already taken. */
const PhotoTiles = ({ again, onFile }: { again: boolean; onFile: (e: ChangeEvent<HTMLInputElement>) => void }) => (
  <div className="photo-tiles">
    <label className="photo-tile primary">
      <span className="photo-tile-icon">{Icons.camera}</span>
      <span className="grow">
        <span className="photo-tile-title">{again ? 'Take another photo' : 'Take a photo'}</span>
        <span className="photo-tile-hint">Point the camera at your plate</span>
      </span>
      <input type="file" accept="image/*" capture="environment" hidden aria-label="Take a photo" onChange={onFile} />
    </label>
    <label className="photo-tile">
      <span className="photo-tile-icon">{Icons.gallery}</span>
      <span className="grow">
        <span className="photo-tile-title">Choose a photo</span>
        <span className="photo-tile-hint">One you already took, from your gallery</span>
      </span>
      <input type="file" accept="image/*" hidden aria-label="Choose a photo" onChange={onFile} />
    </label>
  </div>
);

/** Finds a food to add by hand, among the ones available offline. */
const AddFoodDialog = ({ onPick, onClose }: { onPick: (food: FoodItem) => void; onClose: () => void }) => {
  const { repos } = useContainer();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const found = useAsync(() => (debounced ? searchFoods(repos, debounced) : Promise.resolve([])), [debounced]);
  return (
    <Modal title="Add a food" onClose={onClose}>
      <div className="stack">
        <input className="field" type="search" autoFocus value={query} placeholder="Search, e.g. pane, mela" aria-label="Search foods"
          onChange={(e) => setQuery(e.target.value)} />
        {found.state === 'ready' && found.value.length > 0 && (
          <div className="card">
            {found.value.slice(0, 20).map((food) => (
              <button key={food.id} className="menu-item" onClick={() => { onPick(food); onClose(); }}>
                <span className="title">{food.name}</span><br />
                <span className="small muted">{formatKcal(food.per100g.kcal)} per 100 g</span>
              </button>
            ))}
          </div>
        )}
        {found.state === 'ready' && debounced && found.value.length === 0 && <p className="muted">No foods match.</p>}
      </div>
    </Modal>
  );
};

/** One food found in the photo: its weight, its nutrition, what else it might be, and its ingredients. */
const PlateRow = ({ item, model, onChange, onSwap, onRemove }: {
  item: PlateItem; model: RecogniserModel; onChange: (item: PlateItem) => void; onSwap: (classIndex: number) => void; onRemove: () => void;
}) => {
  const nutrients = itemNutrients(item);
  const single = item.parts.length === 1;
  return (
    <section className="card plate-item" aria-label={item.name}>
      <div className="row between">
        <div className="grow">
          <div className="title">{item.name}</div>
          <div className="small muted">{single ? item.parts[0]!.food.name : `${item.parts.length} ingredients`}</div>
        </div>
        <button className="icon-btn" aria-label={`Remove ${item.name}`} onClick={onRemove}>{Icons.close}</button>
      </div>
      <div className="row between plate-amount">
        <GramsField label={`Grams of ${item.name}`} grams={itemGrams(item)} onChange={(g) => onChange(withTotalGrams(item, g))} />
        <span className="small"><span className="title">{formatKcal(nutrients.kcal)}</span> <span className="muted">· {formatMacros(nutrients)}</span></span>
      </div>
      {!single && (
        <details className="plate-parts">
          <summary className="small muted">Ingredients</summary>
          {item.parts.map((part, i) => (
            <div key={part.food.id} className="row between">
              <span className="small grow">{part.food.name}</span>
              <GramsField label={`Grams of ${part.food.name}`} grams={part.grams} onChange={(g) => onChange(withPartGrams(item, i, g))} />
            </div>
          ))}
        </details>
      )}
      {item.alternatives.length > 0 && (
        <div className="pills plate-alternatives" role="group" aria-label={`Not ${item.name}?`}>
          <span className="small muted">Not right?</span>
          {item.alternatives.map((c) => (
            <button key={c} className="pill" onClick={() => onSwap(c)}>{model.classes[c]!.name}</button>
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * Logs a meal from a photo. The recogniser, running on this device, lists the foods it sees with
 * a suggested weight; every weight can be changed, a wrong food swapped or removed, a missing one
 * added, and the totals follow. `?date=…&meal=…` says where the foods are logged.
 */
export const PhotoFoods = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { repos, foodRecognizer } = useContainer();
  const date = params.get('date');
  const meal = params.get('meal') ?? '';
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<PlateItem[]>([]);
  const [adding, setAdding] = useState(false);
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const names = profile ? mealNamesOf(profile) : DEFAULT_MEALS;
  const day = useStream((c) => observeCalorieDay(c.repos, date ?? '1970-01-01', names), [date, names.join('\n')]);
  const meals = day ? [...day.meals.map((m) => m.name), ...(day.meals.some((m) => m.name === meal) || !meal ? [] : [meal])] : [];

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!date) return <Empty>Choose a day to log the meal on from the Tracker.</Empty>;

  const itemOf = async (model: RecogniserModel, classIndex: number, scale: number, alternatives: readonly number[], key = newId()): Promise<PlateItem | null> => {
    const foodClass = model.classes[classIndex]!;
    const foods = new Map(await Promise.all(foodClass.foods.map(async (f) => [f.code, await repos.basicFoods.byCode(f.code)] as const)));
    const parts = partsOf(foodClass, scale, (code) => foods.get(code));
    return parts && { key, name: foodClass.name, classIndex, alternatives, parts };
  };

  const look = async (photo: File) => {
    setPreview(URL.createObjectURL(photo));
    setPhase({ kind: 'working', progress: null });
    try {
      const { model, recognition } = await foodRecognizer.recognize(photo, (progress) => setPhase({ kind: 'working', progress }));
      const found = await Promise.all(findFoods(model, recognition).map((f) => itemOf(model, f.classIndex, f.scale, f.alternatives)));
      setItems(found.filter((i): i is PlateItem => i !== null));
      setPhase({ kind: 'ready', model });
    } catch {
      setPhase({ kind: 'failed', message: "Couldn't look at the photo. The first time needs a connection; then try again." });
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const photo = e.target.files?.[0];
    e.target.value = '';
    if (photo) void look(photo);
  };

  const swap = async (model: RecogniserModel, item: PlateItem, classIndex: number) => {
    const alternatives = [item.classIndex, ...item.alternatives].filter((c): c is number => c !== null && c !== classIndex);
    const next = await itemOf(model, classIndex, 1, alternatives, item.key);
    if (next) setItems((list) => list.map((i) => (i.key === item.key ? next : i)));
  };

  const save = async () => {
    await repos.transaction.run(async () => {
      let logDay = await repos.foodLog.getDay(date);
      for (const part of items.flatMap((i) => i.parts)) {
        logDay = withEntry(logDay, { id: newId(), meal, portion: portionOf(part.food, Math.max(1, Math.round(part.grams))) });
      }
      await repos.foodLog.saveDay(logDay);
    });
    navigate(-1);
  };

  const count = items.reduce((n, i) => n + i.parts.length, 0);

  return (
    <>
      <PageHeader back title={`Photo of ${meal || 'a meal'}`} />
      {meals.length > 1 && (
        <div className="pills" role="radiogroup" aria-label="Meal">
          {meals.map((name) => (
            <button key={name} role="radio" aria-checked={name === meal} className={`pill ${name === meal ? 'on' : ''}`}
              onClick={() => setParams({ date, meal: name }, { replace: true })}>
              {name}
            </button>
          ))}
        </div>
      )}

      {preview && <img className="photo-preview" src={preview} alt="Your meal" />}

      {(phase.kind === 'pick' || phase.kind === 'failed') && <PhotoTiles again={phase.kind === 'failed'} onFile={onFile} />}
      {phase.kind === 'pick' && (
        <p className="small muted">
          The photo is looked at on this phone and never sent anywhere. You check every food and weight before anything is logged.
        </p>
      )}
      {phase.kind === 'working' && (
        <p className="muted" role="status">
          {phase.progress === null || phase.progress >= 1 ? 'Looking at your meal…' : `Getting the food recogniser ready, once only… ${Math.round(phase.progress * 100)}%`}
        </p>
      )}
      {phase.kind === 'failed' && <p className="muted" role="alert">{phase.message}</p>}

      {phase.kind === 'ready' && (
        <>
          <EnergyCard label="This meal" eaten={plateNutrients(items)} goal={undefined}>
            <span>The weights are a guess from the photo: check them below.</span>
          </EnergyCard>
          <h2>Found in the photo</h2>
          {items.length === 0 && <p className="muted">No food recognised. Add what you ate by hand.</p>}
          {items.map((item) => (
            <PlateRow key={item.key} item={item} model={phase.model}
              onChange={(next) => setItems((list) => list.map((i) => (i.key === item.key ? next : i)))}
              onSwap={(c) => void swap(phase.model, item, c)}
              onRemove={() => setItems((list) => list.filter((i) => i.key !== item.key))} />
          ))}
          <button className="btn secondary plate-add" onClick={() => setAdding(true)}>{Icons.plus} Add a food</button>
          <p className="small muted">Nutrition: CREA tables.</p>
          <div className="actions">
            <button className="btn" disabled={count === 0} onClick={() => void save()}>
              Log {count} {count === 1 ? 'food' : 'foods'}{meal ? ` to ${meal}` : ''}
            </button>
          </div>
          <PhotoTiles again onFile={onFile} />
        </>
      )}

      {adding && (
        <AddFoodDialog onClose={() => setAdding(false)} onPick={(food) => setItems((list) => [...list, {
          key: newId(), name: food.name, classIndex: null, alternatives: [], parts: [{ food, grams: roundGrams(food.servingGrams ?? 100) }],
        }])} />
      )}
    </>
  );
};
