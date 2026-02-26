import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithProviders } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithProviders />
  </StrictMode>,
);
