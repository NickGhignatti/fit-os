import { configure, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../app/App';
import { readConfig } from '../app/config';
import { createContainer, type Container } from '../app/container';
import { ContainerProvider } from '../app/hooks';
import { ExerciseLibrary, OpenFoodFactsRepository, StaticBasicFoods, StaticExerciseCatalog } from '../data/catalog';
import { testStore } from '../data/testStore';
import type { Community } from '../community/ports';
import type { TransferGateway } from '../transfer/gateway';

// Each device opens a real SQLite database; the first screen of a test waits for it to start,
// which takes longer than testing-library's one-second default when many tests run at once.
configure({ asyncUtilTimeout: 5000 });

// Tests run from web/. (jsdom's URL class is not accepted by Node's file reader, so no `new URL` here.)
const catalog = (name: string) => async () => readFileSync(join(process.cwd(), 'public', 'catalog', name), 'utf8');

/** A "device": its own empty SQLite database, the real catalogue files, no internet, and an optional transfer server. */
export const makeDevice = (transfer: TransferGateway | null = null, community: Community | null = null): Container => {
  const base = createContainer(readConfig('', ''), testStore());
  const offline = async () => { throw new TypeError('offline'); };
  return {
    ...base,
    repos: {
      ...base.repos,
      exercises: new ExerciseLibrary(new StaticExerciseCatalog(catalog('exercises.json')), base.repos.customExercises),
      basicFoods: new StaticBasicFoods(catalog('crea_foods.csv')),
      products: new OpenFoodFactsRepository({ products: 'https://off.invalid', search: 'https://off.invalid' }, offline as unknown as typeof fetch),
    },
    transfer,
    community,
  };
};

/** Mounts the real application on [route] for [device]. */
export const renderApp = (route = '/', device: Container = makeDevice()) => ({
  device,
  ...render(
    <ContainerProvider container={device}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ContainerProvider>,
  ),
});

/** Unfolds the account card on Profile. */
export const openAccount = async (user: { click: (element: Element) => Promise<void> }) => {
  await user.click(await screen.findByRole('button', { name: 'Account options' }));
};
