import { useEffect, useRef, useState } from 'react';
import Crm from '../crm/Crm.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import { applyTheme, initialTheme, saveTheme } from '../lib/theme.js';

// Owners' area. The sign-in form is real UI, but this environment runs with password
// bypass on: any attempt explains that and lets the person in. In production the form
// talks to an auth server and requests come from a database only owners can read.
const KEY = 'paletcheck.admin.session';

const read = () => {
  try {
    return sessionStorage.getItem(KEY) === 'bypass';
  } catch {
    return false;
  }
};
const write = (on) => {
  try {
    if (on) sessionStorage.setItem(KEY, 'bypass');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lasts until the page closes */
  }
};

function SignIn({ onEnter, toggle }) {
  const heading = useRef(null);
  const [notice, setNotice] = useState(false);
  const continueBtn = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (notice) continueBtn.current?.focus();
  }, [notice]);

  return (
    <main className="gate">
      <section className="gate-card" aria-labelledby="gate-title">
        {toggle}
        <p className="brand-inline">Tech-Con</p>
        <h1 id="gate-title" ref={heading} tabIndex={-1}>
          Zona proprietarilor
        </h1>
        <p className="reason">Cererile de evaluare, etapele de vânzare și follow-up-ul pentru celulele UR20.</p>

        <form
          className="gate-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(true);
          }}
        >
          <div className="field">
            <label htmlFor="gate-email">E-mail</label>
            <input id="gate-email" type="email" autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="gate-pass">Parolă</label>
            <input id="gate-pass" type="password" autoComplete="current-password" />
          </div>
          <button type="submit" className="primary">
            Autentificare
          </button>
        </form>

        {notice && (
          <div className="access-alert" role="alert">
            <p className="access-title">Acces securizat · ocolire parolă activă</p>
            <p>
              Zona proprietarilor cere autentificare. Pe acest mediu de prezentare verificarea parolei este dezactivată, așa că
              intri fără ea.
            </p>
            <div className="access-actions">
              <button ref={continueBtn} type="button" className="chip-btn chip-primary" onClick={onEnter}>
                Continuă
              </button>
              <button type="button" className="chip-btn" onClick={() => setNotice(false)}>
                Anulează
              </button>
            </div>
          </div>
        )}

        <p className="fine">
          <a href="../">Înapoi la verificarea liniei</a>
        </p>
      </section>
    </main>
  );
}

export default function AdminApp() {
  const [inside, setInside] = useState(read);
  const [theme, setTheme] = useState(initialTheme);
  const changeTheme = (t) => {
    setTheme(t);
    applyTheme(t);
    saveTheme(t);
  };
  if (!inside)
    return (
      <SignIn
        toggle={<ThemeToggle theme={theme} onChange={changeTheme} className="gate-toggle" />}
        onEnter={() => {
          write(true);
          setInside(true);
        }}
      />
    );
  return (
    <Crm
      toolbarExtra={<ThemeToggle theme={theme} onChange={changeTheme} />}
      badge={
        <span className="bypass-badge" title="Verificarea parolei este dezactivată pe acest mediu">
          ocolire parolă activă
        </span>
      }
      onSignOut={() => {
        write(false);
        setInside(false);
      }}
    />
  );
}
