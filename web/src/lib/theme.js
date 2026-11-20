// Light or dark glass. Light by default; the visitor's choice is remembered.
// `?tema=light|dark` overrides both (used for screenshots).

const KEY = 'paletcheck.theme';
const ATTR = { light: 'glass', dark: 'glass-dark' };

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function initialTheme() {
  const param = new URLSearchParams(window.location.search).get('tema');
  if (param === 'light' || param === 'dark') return param;
  const saved = stored();
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = ATTR[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E1116' : '#D6DADE');
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this page */
  }
}
