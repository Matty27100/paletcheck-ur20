import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import './crm.css';
import './impact.css';
import './assistant.css';
import './themes.css';
import App from './App.jsx';

import { applyTheme, initialTheme } from './lib/theme.js';

applyTheme(initialTheme());
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
