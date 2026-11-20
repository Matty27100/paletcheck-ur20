import { useEffect, useRef } from 'react';

const KEY = 'paletcheck.entry';

// Shown once, on a first visit: the same link serves clients and Tech-Con's owners.
export function entryChosen() {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return true; // storage blocked: go straight to the tool
  }
}

function remember(choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the choice lasts for this page */
  }
}

export default function Entry({ onClient }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="screen entry">
      <h1 ref={heading} tabIndex={-1}>
        Cum vrei să continui?
      </h1>
      <div className="options">
        <button
          type="button"
          onClick={() => {
            remember('client');
            onClient();
          }}
        >
          Sunt client
          <small>Verifică în două minute dacă un robot UR20 îți poate paletiza gălețile.</small>
        </button>
        <button
          type="button"
          onClick={() => {
            remember('admin');
            window.location.assign('admin/');
          }}
        >
          Sunt de la Tech-Con
          <small>Zona proprietarilor: cererile primite, etapele de vânzare și follow-up-ul.</small>
        </button>
      </div>
    </div>
  );
}
