import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { applyThemeId, readStoredThemeId } from './hooks/use-theme-id.js';
import './styles.css';
import './scrollbars.css';

void applyThemeId(readStoredThemeId());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
