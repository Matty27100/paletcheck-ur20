import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../styles.css';
import '../crm.css';
import '../admin.css';
import '../themes.css';
import { applyTheme, initialTheme } from '../lib/theme.js';

applyTheme(initialTheme());
import AdminApp from './AdminApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
