import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { lookUpBarcode, searchFoods, type ProductSearch } from '../domain/catalog';
import { addFood } from '../domain/edit';
import { withEntry } from '../domain/foodLog';
import { newId } from '../domain/id';
import { isPackagedProduct, portionNutrients, portionOf, type FoodItem, type Portion } from '../domain/nutrition';
import { observeCalorieDay } from '../domain/useCases';
import { DEFAULT_MEALS, formatGrams, formatKcal, formatMacros, parseNumber } from './format';
import { useAsync } from './hooks';
import { Empty, Loading, Modal, PageHeader, useDebounced } from './kit';
import { ScannerDialog } from './Scanner';
import { mealNamesOf } from './Tracker';

const SOURCE_LABEL = { crea: 'CREA', off: 'Open Food Facts', usda: 'USDA', custom: 'Your food' } as const;
const sourceOf = (food: FoodItem) => SOURCE_LABEL[food.id.split(':')[0] as keyof typeof SOURCE_LABEL];

const FoodRow = ({ food, favorite, onPick, onToggleFavorite }: {
  food: FoodItem; favorite: boolean; onPick: () => void; onToggleFavorite: () => void;
}) => (
  <div className="list-item" style={{ cursor: 'default' }}>
    <button className="grow" style={{ appearance: 'none', border: 0, background: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'inherit' }} onClick={onPick}>
      <div className="title">{food.name}{food.brand ? <span className="muted"> · {food.brand}</span> : null}</div>
      <div className="small muted">{formatKcal(food.per100g.kcal)} per 100 g · {sourceOf(food)}</div>
    </button>
    <button className="icon-btn" aria-label={`${favorite ? 'Remove from favourites' : 'Add to favourites'}: ${food.name}`}
      aria-pressed={favorite} onClick={onToggleFavorite}>{favorite ? '★' : '☆'}</button>
  </div>
);

/** How much of a food: grams, or a serving, with the nutrition shown live. */
const AmountDialog = ({ food, onSubmit, onClose }: { food: FoodItem; onSubmit: (portion: Portion) => void; onClose: () => void }) => {
  const [text, setText] = useState(String(food.servingGrams ?? 100));
  const grams = parseNumber(text);
  const valid = grams !== null && grams > 0 && grams <= 100_000;
  const nutrients = valid ? portionNutrients(portionOf(food, grams)) : null;
  return (
    <Modal title={food.name} onClose={onClose}>
      <form className="stack" onSubmit={(e: FormEvent) => { e.preventDefault(); if (valid) { onSubmit(portionOf(food, grams)); onClose(); } }}>
        <p className="small muted">{formatKcal(food.per100g.kcal)} per 100 g · {formatMacros(food.per100g)}</p>
        <label className="stack"><span className="small muted">Grams</span>
          <input className="field" inputMode="decimal" value={text} autoFocus onChange={(e) => setText(e.target.value)} /></label>
        <div className="pills">
          <button type="button" className="pill" onClick={() => setText('100')}>100 g</button>
          {food.servingGrams && <button type="button" className="pill" onClick={() => setText(String(food.servingGrams))}>1 serving ({formatGrams(food.servingGrams)})</button>}
        </div>
        {nutrients && <p><span className="title">{formatKcal(nutrients.kcal)}</span> <span className="muted">· {formatMacros(nutrients)}</span></p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Add</button>
        </div>
      </form>
    </Modal>
  );
};

const CustomFoodDialog = ({ initialName, onCreate, onClose }: {
  initialName: string; onCreate: (food: { name: string; kcal: number; protein: number; carbs: number; fat: number; serving: number | null }) => void; onClose: () => void;
}) => {
  const [v, setV] = useState({ name: initialName, kcal: '', protein: '', carbs: '', fat: '', serving: '' });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const num = (t: string) => (t.trim() === '' ? 0 : parseNumber(t));
  const kcal = parseNumber(v.kcal);
  const [protein, carbs, fat] = [num(v.protein), num(v.carbs), num(v.fat)];
  const serving = v.serving.trim() === '' ? null : parseNumber(v.serving);
  const valid = v.name.trim() !== '' && kcal !== null && kcal >= 0 && [protein, carbs, fat].every((n) => n !== null && n >= 0) && (v.serving.trim() === '' || (serving !== null && serving > 0));
  const field = (label: string, key: keyof typeof v, mode: 'text' | 'decimal' = 'decimal') => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode={mode} value={v[key]} onChange={set(key)} /></label>
  );
  return (
    <Modal title="New food" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreate({ name: v.name.trim(), kcal, protein: protein!, carbs: carbs!, fat: fat!, serving });
        onClose();
      }}>
        <p className="small muted">Copy the values per 100 g from the label.</p>
        {field('Name', 'name', 'text')}
        <div className="row">{field('kcal', 'kcal')}{field('Protein g', 'protein')}</div>
        <div className="row">{field('Carbs g', 'carbs')}{field('Fat g', 'fat')}</div>
        {field('Serving in g (optional)', 'serving')}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Create</button>
        </div>
      </form>
    </Modal>
  );
};

const FreeTextDialog = ({ onSubmit, onClose }: { onSubmit: (name: string, quantity: string) => void; onClose: () => void }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  return (
    <Modal title="Add without nutrition data" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSubmit(name.trim(), quantity.trim()); onClose(); } }}>
        <label className="stack"><span className="small muted">Food</span>
          <input className="field" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Quantity (optional)</span>
          <input className="field" placeholder="80 g" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Add</button>
        </div>
      </form>
    </Modal>
  );
};

type Dialog =
  | { kind: 'amount'; food: FoodItem } | { kind: 'custom' } | { kind: 'text' } | { kind: 'scan' };

/**
 * Picks a food. `?date=…&meal=…` logs it as eaten; `?plan=ID&meal=MEALID` adds it to a diet plan's meal.
 */
export const FoodPicker = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const date = params.get('date');
  const planId = params.get('plan');
  const meal = params.get('meal') ?? '';
  const forPlan = planId !== null;

  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const [dialog, setDialog] = useState<Dialog | null>(params.get('scan') === '1' ? { kind: 'scan' } : null);
  const [notFound, setNotFound] = useState<string | null>(null);
  // When logging, the meals of that day, to move the food to another one before picking it.
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const names = profile ? mealNamesOf(profile) : DEFAULT_MEALS;
  const day = useStream((c) => observeCalorieDay(c.repos, date ?? '1970-01-01', names), [date, names.join('\n')]);
  const meals = day ? [...day.meals.map((m) => m.name), ...(day.meals.some((m) => m.name === meal) || !meal ? [] : [meal])] : [];
  const favorites = useStream((c) => c.repos.favorites.observeFavorites());
  const recent = useStream((c) => c.repos.foodLog.observeRecentFoods(10));
  const offline = useAsync(() => (debounced ? searchFoods(repos, debounced) : Promise.resolve([])), [debounced]);
  const online = useAsync<ProductSearch | null>(
    () => (debounced.length >= 3 ? repos.products.search(debounced) : Promise.resolve(null)),
    [debounced],
  );
  const favoriteIds = new Set((favorites ?? []).map((f) => f.id));

  // A typed barcode is looked up directly.
  const barcode = /^\d{8,14}$/.test(debounced) ? debounced : null;
  useEffect(() => {
    if (!barcode) return;
    let current = true;
    void lookUpBarcode(repos, barcode).then((r) => {
      if (!current) return;
      if (r.status === 'found') setDialog({ kind: 'amount', food: r.product });
      else setNotFound(r.status === 'not_found' ? `No product with barcode ${barcode}. Search by name or create the food.` : "Can't reach the product databases. Check your connection.");
    });
    return () => {
      current = false;
    };
  }, [barcode, repos]);

  if (!date && !forPlan) return <Empty>Choose where to add food from the Tracker or a diet.</Empty>;

  const pick = async (portion: Portion) => {
    if (isPackagedProduct(portion.food)) await repos.savedProducts.save(portion.food);
    await repos.transaction.run(async () => {
      if (forPlan) {
        const plan = await repos.dietPlans.getPlan(planId);
        if (plan) await repos.dietPlans.save(addFood(plan, meal, portion.food.name, '', portion));
      } else if (date) {
        const day = await repos.foodLog.getDay(date);
        await repos.foodLog.saveDay(withEntry(day, { id: newId(), meal, portion }));
      }
    });
    navigate(-1);
  };

  const addText = async (name: string, quantity: string) => {
    const plan = planId ? await repos.dietPlans.getPlan(planId) : undefined;
    if (plan) await repos.dietPlans.save(addFood(plan, meal, name, quantity, null));
    navigate(-1);
  };

  const row = (food: FoodItem) => (
    <FoodRow key={food.id} food={food} favorite={favoriteIds.has(food.id)} onPick={() => setDialog({ kind: 'amount', food })}
      onToggleFavorite={() => void repos.favorites.setFavorite(food, !favoriteIds.has(food.id))} />
  );

  return (
    <>
      <PageHeader back title={`Add to ${meal || 'meal'}`} />
      {date && !forPlan && meals.length > 1 && (
        <div className="pills" role="radiogroup" aria-label="Meal">
          {meals.map((name) => (
            <button key={name} role="radio" aria-checked={name === meal} className={`pill ${name === meal ? 'on' : ''}`}
              onClick={() => setParams({ date, meal: name }, { replace: true })}>
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <input className="field grow" type="search" value={query} placeholder="Search, e.g. pasta, mela, or type a barcode"
          aria-label="Search foods" onChange={(e) => { setQuery(e.target.value); setNotFound(null); }} />
        <button className="btn secondary" onClick={() => setDialog({ kind: 'scan' })}>Scan</button>
        {date && !forPlan && (
          <button className="btn secondary" onClick={() => navigate(`/food/photo?date=${date}&meal=${encodeURIComponent(meal)}`, { replace: true })}>Photo</button>
        )}
      </div>
      {notFound && <p className="muted" role="alert">{notFound}</p>}

      {debounced === '' ? (
        <>
          {favorites && favorites.length > 0 && (<><h2>Favourites</h2><section className="card">{favorites.map(row)}</section></>)}
          {recent && recent.length > 0 && (<><h2>Recent</h2><section className="card">{recent.map(row)}</section></>)}
          {favorites?.length === 0 && recent?.length === 0 && (
            <Empty>Type a food's name, scan a barcode, or type the barcode's digits.</Empty>
          )}
        </>
      ) : (
        <>
          <h2>Foods</h2>
          {offline.state === 'loading' && <Loading />}
          {offline.state === 'failed' && <Empty>Could not load the food tables. Check your connection and reload.</Empty>}
          {offline.state === 'ready' && offline.value.length === 0 && <p className="muted">No foods match.</p>}
          {offline.state === 'ready' && offline.value.length > 0 && <section className="card">{offline.value.slice(0, 50).map(row)}</section>}

          <h2>Packaged products</h2>
          {debounced.length < 3 && <p className="muted small">Type at least 3 letters to search packaged products.</p>}
          {online.state === 'loading' && debounced.length >= 3 && <Loading />}
          {online.state === 'ready' && online.value?.status === 'unavailable' && <p className="muted">Can't reach the product databases. Check your connection.</p>}
          {online.state === 'ready' && online.value?.status === 'results' && online.value.products.length === 0 && <p className="muted">No packaged products found.</p>}
          {online.state === 'ready' && online.value?.status === 'results' && online.value.products.length > 0 && (
            <section className="card">{online.value.products.map(row)}</section>
          )}
        </>
      )}

      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={() => setDialog({ kind: 'custom' })}>Create a food…</button>
        {forPlan && <button className="btn secondary" onClick={() => setDialog({ kind: 'text' })}>Add without nutrition data…</button>}
      </div>
      <p className="small muted">Basic foods: CREA, Tabelle di composizione degli alimenti. Packaged products: Open Food Facts (ODbL), and USDA FoodData Central for barcodes it does not know.</p>

      {dialog?.kind === 'amount' && <AmountDialog food={dialog.food} onClose={() => setDialog(null)} onSubmit={(p) => void pick(p)} />}
      {dialog?.kind === 'text' && <FreeTextDialog onClose={() => setDialog(null)} onSubmit={(n, q) => void addText(n, q)} />}
      {dialog?.kind === 'custom' && (
        <CustomFoodDialog initialName={query.trim()} onClose={() => setDialog(null)}
          onCreate={(f) => void repos.customFoods.create(f.name, { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }, null, f.serving)
            .then((food) => setDialog({ kind: 'amount', food }))} />
      )}
      {dialog?.kind === 'scan' && (
        <ScannerDialog title="Scan barcode" onClose={() => setDialog(null)} onResult={(code) => {
          setDialog(null);
          setQuery(code);
        }} />
      )}
    </>
  );
};
