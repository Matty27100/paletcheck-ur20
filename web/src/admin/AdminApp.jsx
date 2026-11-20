import { useEffect, useRef, useState } from 'react';
import Crm from '../crm/Crm.jsx';

// Owners' area. Proof of concept: the jury enters without a password. In production this
// screen is a real sign-in (owner accounts, server-side session) and requests come from a
// server database that only signed-in owners can read; here they stay in this browser.
const KEY = 'paletcheck.admin.session';

const read = () => {
  try {
    return sessionStorage.getItem(KEY) === 'demo';
  } catch {
    return false;
  }
};
const write = (on) => {
  try {
    if (on) sessionStorage.setItem(KEY, 'demo');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lasts until the page closes */
  }
};

function Gate({ onEnter }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <main className="gate">
      <section className="gate-card" aria-labelledby="gate-title">
        <p className="brand-inline">Tech-Con</p>
        <h1 id="gate-title" ref={heading} tabIndex={-1}>
          Zona proprietarilor
        </h1>
        <p className="reason">Cererile de evaluare, etapele de vânzare și pașii de follow-up pentru celulele UR20.</p>

        <form className="gate-form" aria-describedby="gate-note" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="gate-email">E-mail</label>
            <input id="gate-email" type="email" autoComplete="username" disabled placeholder="proprietar@tech-con.ro" />
          </div>
          <div className="field">
            <label htmlFor="gate-pass">Parolă</label>
            <input id="gate-pass" type="password" autoComplete="current-password" disabled />
          </div>
          <button type="submit" className="primary" disabled>
            Autentificare
          </button>
        </form>
        <p id="gate-note" className="gate-note">
          În versiunea finală intră doar conturile de proprietar, iar cererile stau pe server. Prototipul nu are conturi,
          așa că autentificarea e dezactivată.
        </p>

        <button type="button" className="primary gate-demo" onClick={onEnter}>
          Intră ca juriu (demo, fără parolă)
        </button>
        <p className="fine">
          Vezi cererile trimise din instrument în acest browser sau încarcă cereri demo. <a href="../">Înapoi la instrument</a>
        </p>
      </section>
    </main>
  );
}

export default function AdminApp() {
  const [inside, setInside] = useState(read);
  if (!inside)
    return (
      <Gate
        onEnter={() => {
          write(true);
          setInside(true);
        }}
      />
    );
  return (
    <>
      <p className="demo-banner" role="note">
        Mod demonstrativ pentru juriu: fără autentificare, datele rămân în acest browser.
      </p>
      <Crm
        onSignOut={() => {
          write(false);
          setInside(false);
        }}
      />
    </>
  );
}
