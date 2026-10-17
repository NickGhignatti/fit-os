import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { appConfig } from './app/config';
import { createContainer } from './app/container';
import { ContainerProvider } from './app/hooks';
import './app/styles.css';

const container = createContainer(appConfig);

// Ask the browser not to evict our data under storage pressure. Not guaranteed; the backup
// file is the real safety net. Failure is harmless.
void navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContainerProvider container={container}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ContainerProvider>
  </StrictMode>,
);
