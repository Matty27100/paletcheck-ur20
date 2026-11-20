import { useEffect, useRef, useState } from 'react';
import { COUNTIES } from '../lib/facts.js';
import { nearestHub, normalCUI, priority, validCUI, validEmail } from '../lib/calc.js';
import { trafficSource, upsertLead } from '../lib/store.js';
import { PREFERENCES } from '../lib/leads.js';

const ROLES = ['Director de producție', 'Director general sau investiții', 'Inginer de proces sau mentenanță', 'Alt rol'];
// Sample company for a quick walkthrough of the form (valid check digit, fictitious firm).
const SAMPLE_COMPANY = {
  company: 'Ingrediente Exemplu SRL',
  cui: '12345674',
  role: 'Director de producție',
  county: 'IS',
  preference: 'demo',
  phone: '0700 000 123',
  consent: true,
};

const SAMPLE_EMAIL = 'achizitii@ingrediente-exemplu.ro';

const DEMO_NOTE = 'Folosim datele doar ca să răspundem cererii tale.';

function useFocus() {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}

// Two short steps: the e-mail first, the company details after.
export default function Request({ answers, assessment, onBack, onSent }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    company: '',
    cui: '',
    role: '',
    county: answers.county || '',
    phone: '',
    preference: '',
    consent: false,
    consentMarketing: false,
  });
  const [touched, setTouched] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const blur = (k) => () => setTouched({ ...touched, [k]: true });

  const errors = {
    email: !validEmail(form.email) ? 'Introduceți o adresă de e-mail validă, de exemplu nume@firma.ro.' : null,
    company: form.company.trim().length < 2 ? 'Introduceți numele firmei.' : null,
    cui: !validCUI(form.cui) ? 'CUI invalid: verificați cifrele (cifra de control nu se potrivește).' : null,
    role: !form.role ? 'Alegeți rolul.' : null,
    county: !form.county ? 'Alegeți județul.' : null,
    phone: form.phone && !/^[+\d][\d\s.-]{8,}$/.test(form.phone.trim()) ? 'Număr de telefon incomplet.' : null,
    preference: !form.preference ? 'Alegeți pasul următor.' : null,
    consent: !form.consent ? 'Fără acord nu putem răspunde cererii.' : null,
  };
  const show = (k) => touched[k] && errors[k];

  if (step === 1) return <StepEmail {...{ form, set, blur, show, errors, setTouched, onBack, next: () => setStep(2) }} />;

  const submit = (e) => {
    e.preventDefault();
    const keys = ['company', 'cui', 'role', 'county', 'preference', 'phone', 'consent'];
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));
    if (keys.some((k) => errors[k])) return;
    const hub = nearestHub(form.county);
    const { consent, ...fields } = form;
    const lead = {
      ...fields,
      createdAt: new Date().toISOString(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      cui: normalCUI(form.cui),
      county: COUNTIES.find((c) => c[0] === form.county)?.[1] || form.county,
      countyCode: form.county,
      hub: hub?.name,
      verdict: assessment.verdict.title,
      verdictLevel: assessment.verdict.level,
      priority: priority(assessment.verdict.level, answers.shifts),
      answers: {
        weight: answers.weight,
        rate: answers.rate,
        perPallet: answers.perPallet,
        shifts: answers.shifts,
        handle: answers.handle,
        separators: answers.separators,
        network: answers.network || '',
        cells: answers.cells,
      },
      source: trafficSource(),
      consentAt: consent ? new Date().toISOString() : null,
    };
    const { duplicate } = upsertLead(lead);
    onSent(lead, duplicate);
  };

  return (
    <form className="screen request" noValidate onSubmit={submit}>
      <div className="progress">
        <button type="button" className="back" onClick={() => setStep(1)}>
          Înapoi
        </button>
        <span className="count">Pasul 2 din 2</span>
      </div>
      <div className="form-head">
        <Heading>Despre firma ta</Heading>
        <button
          type="button"
          className="chip-btn"
          onClick={() => {
            setForm((f) => ({ ...f, ...SAMPLE_COMPANY }));
            setTouched({});
          }}
        >
          Completează automat
        </button>
      </div>

      <Field id="company" label="Numele firmei" error={show('company')}>
        <input id="company" autoComplete="organization" value={form.company} onChange={set('company')} onBlur={blur('company')} aria-invalid={!!show('company')} />
      </Field>
      <Field id="cui" label="CUI" hint="O firmă se numără o singură dată, chiar dacă vine din mai multe canale." error={show('cui')}>
        <input id="cui" inputMode="numeric" autoComplete="off" value={form.cui} onChange={set('cui')} onBlur={blur('cui')} aria-invalid={!!show('cui')} />
      </Field>
      <fieldset className="field">
        <legend>Rolul tău</legend>
        <div className="seg seg-wrap">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={form.role === r}
              onClick={() => {
                setForm({ ...form, role: r });
                setTouched({ ...touched, role: true });
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="field-error">{show('role')}</p>
      </fieldset>
      <Field id="county" label="Județul fabricii" error={show('county')}>
        <select id="county" value={form.county} onChange={set('county')} onBlur={blur('county')} aria-invalid={!!show('county')}>
          <option value="">Alege județul</option>
          {COUNTIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="field">
        <legend>Ce pas următor preferi?</legend>
        <div className="seg seg-wrap">
          {PREFERENCES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={form.preference === p.id}
              onClick={() => {
                setForm({ ...form, preference: p.id });
                setTouched({ ...touched, preference: true });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="field-error">{show('preference')}</p>
      </fieldset>
      <Field id="phone" label="Telefon (opțional)" hint="Doar dacă vrei un apel de 15 minute cu un inginer." error={show('phone')}>
        <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} onBlur={blur('phone')} aria-invalid={!!show('phone')} />
      </Field>

      <div className="checks">
        <label className="check">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => {
              setForm({ ...form, consent: e.target.checked });
              setTouched({ ...touched, consent: true });
            }}
          />
          <span>
            Sunt de acord ca Tech-Con să folosească aceste date pentru a răspunde cererii mele de evaluare.
          </span>
        </label>
        <p className="field-error">{show('consent')}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={form.consentMarketing}
            onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })}
          />
          <span>Opțional: vreau să primesc studii de caz și invitații la demonstrații.</span>
        </label>
      </div>
      <button type="submit" className="primary">
        Trimite cererea
      </button>
      <p className="fine">{DEMO_NOTE}</p>
    </form>
  );
}

function Heading({ children }) {
  const ref = useFocus();
  return (
    <h1 ref={ref} tabIndex={-1}>
      {children}
    </h1>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function StepEmail({ form, set, blur, show, errors, setTouched, onBack, next }) {
  return (
    <form
      className="screen request"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched((t) => ({ ...t, email: true }));
        if (!errors.email) next();
      }}
    >
      <div className="progress">
        <button type="button" className="back" onClick={onBack}>
          Înapoi
        </button>
        <span className="count">Pasul 1 din 2</span>
      </div>
      <div className="form-head">
        <Heading>Unde trimitem fișa de pre-evaluare?</Heading>
        <button
          type="button"
          className="chip-btn"
          onClick={() => {
            set('email')({ target: { value: SAMPLE_EMAIL } });
            setTouched((t) => ({ ...t, email: false }));
          }}
        >
          Completează automat
        </button>
      </div>
      <p className="reason">Primești rezultatul și lista de verificat, iar un inginer analizează datele liniei tale.</p>
      <Field id="email" label="E-mail de serviciu" error={show('email')}>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="next"
          value={form.email}
          onChange={set('email')}
          onBlur={blur('email')} aria-invalid={!!show('email')}
        />
      </Field>
      <button type="submit" className="primary">
        Continuă
      </button>
      <p className="fine">{DEMO_NOTE}</p>
    </form>
  );
}
