import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../lib/calc.js';
import {
  PREFERENCES,
  RESPONSE_TARGET,
  STAGES,
  ago,
  demoLeads,
  draft,
  dueLabel,
  followups,
  mailto,
  nextAction,
  preferenceLabel,
  responseState,
  stageLabel,
  stats,
  withNote,
  withStage,
  withStepDone,
} from '../lib/leads.js';
import { downloadCsv, loadLeads, saveLeads, updateLead } from '../lib/store.js';

const FILTERS = [
  { id: 'all', label: 'Toate', test: () => true },
  { id: 'now', label: 'De făcut acum', test: (l, now) => ['due', 'overdue'].includes(nextAction(l, now)?.state) },
  { id: 'A', label: 'Prioritate A', test: (l) => l.priority === 'A' },
  { id: 'open', label: 'Deschise', test: (l) => !['won', 'lost'].includes(l.stage) },
];

const HANDLE = { da: 'cu mâner', nu: 'fără mâner', nustiu: 'mâner de confirmat' };

// Re-render every 30 s so timers ("acum 12 min", overdue) stay true while the page is open.
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Stats({ leads, now }) {
  const s = stats(leads, now);
  const sources = Object.entries(s.bySource).sort((a, b) => b[1] - a[1]);
  return (
    <section className="crm-stats" aria-label="Indicatori">
      <div>
        <b>{s.total}</b>
        <span>cereri relevante</span>
      </div>
      <div className={s.actionsNow ? 'is-alert' : ''}>
        <b>{s.actionsNow}</b>
        <span>de făcut acum</span>
      </div>
      <div>
        <b>{s.respondedOnTimeShare === null ? '–' : `${Math.round(s.respondedOnTimeShare * 100)}%`}</b>
        <span>contactate în sub {RESPONSE_TARGET / 60000} min</span>
      </div>
      <div>
        <b>{(s.byStage.evaluation || 0) + (s.byStage.offer || 0)}</b>
        <span>în evaluare sau ofertă</span>
      </div>
      <div className="crm-funnel">
        {STAGES.map((st) => (
          <span key={st.id}>
            {st.label} <b>{s.byStage[st.id] || 0}</b>
          </span>
        ))}
      </div>
      <div className="crm-sources">
        {sources.map(([src, n]) => (
          <span key={src}>
            {src} <b>{n}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function LeadRow({ lead, now, active, onOpen }) {
  const next = nextAction(lead, now);
  const resp = responseState(lead, now);
  return (
    <li>
      <button type="button" className={`lead-row ${active ? 'is-active' : ''}`} onClick={onOpen}>
        <span className={`prio prio-${lead.priority}`} aria-label={`Prioritate ${lead.priority}`}>
          {lead.priority}
        </span>
        <span className="lead-main">
          <b>{lead.company}</b>
          <span>
            {lead.county} · {lead.hub} · {ago(lead.createdAt, now)}
          </span>
          {next ? (
            <span className={`next next-${next.state}`}>
              {next.title} · {dueLabel(next.due, now)}
            </span>
          ) : (
            <span className="next">Fără pași deschiși</span>
          )}
        </span>
        <span className="lead-side">
          <span className={`stage-badge sb-${lead.stage}`}>{stageLabel(lead.stage)}</span>
          {!resp.contacted && lead.stage === 'new' && (
            <span className={resp.onTime ? 'sla' : 'sla is-late'}>{resp.onTime ? 'în termen' : 'peste 1 oră'}</span>
          )}
        </span>
      </button>
    </li>
  );
}

function Step({ lead, step, now, onDone }) {
  const d = draft(lead, step.id);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const stateText = {
    done: step.auto ? 'trimis automat' : `făcut ${ago(step.doneAt, now)}`,
    skipped: 'nu mai e necesar',
    overdue: dueLabel(step.due, now),
    due: dueLabel(step.due, now),
    upcoming: dueLabel(step.due, now),
  }[step.state];
  const actionable = step.state === 'due' || step.state === 'overdue' || step.state === 'upcoming';
  return (
    <li className={`step step-${step.state}`}>
      <span className="step-dot" aria-hidden="true" />
      <div className="step-body">
        <div className="step-head">
          <b>{step.title}</b>
          <span>{stateText}</span>
        </div>
        {actionable && (
          <div className="step-actions">
            {step.channel === 'phone' && lead.phone ? (
              <a className="chip-btn" href={`tel:${lead.phone.replace(/\s/g, '')}`}>
                Sună {lead.phone}
              </a>
            ) : (
              <a className="chip-btn" href={mailto(lead, d)}>
                Deschide e-mailul
              </a>
            )}
            <button type="button" className="chip-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
              {step.channel === 'phone' && lead.phone ? 'Ghid de apel' : 'Vezi mesajul'}
            </button>
            <button type="button" className="chip-btn chip-primary" onClick={onDone}>
              Marchează făcut
            </button>
          </div>
        )}
        {open && (
          <div className="draft">
            <p className="draft-subject">{d.subject}</p>
            <pre>{d.body}</pre>
            <button
              type="button"
              className="chip-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${d.subject}\n\n${d.body}`);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copiat' : 'Copiază textul'}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function LeadDetail({ lead, now, onChange, onClose }) {
  const [note, setNote] = useState('');
  const a = lead.answers || {};
  const resp = responseState(lead, now);
  const steps = followups(lead, now);
  return (
    <article className="lead-detail" aria-labelledby="lead-title">
      <button type="button" className="back crm-back" onClick={onClose}>
        Înapoi la listă
      </button>
      <header>
        <span className={`prio prio-${lead.priority}`}>{lead.priority}</span>
        <div>
          <h2 id="lead-title">{lead.company}</h2>
          <p>
            CUI {lead.cui} · {lead.role} · {lead.county}
          </p>
        </div>
      </header>

      <div className="contact">
        <a href={`mailto:${lead.email}`}>{lead.email}</a>
        {lead.phone ? <a href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a> : <span>fără telefon</span>}
        <span>sursa: {lead.source}</span>
      </div>

      <p className={`resp ${resp.onTime ? '' : 'is-late'}`}>
        {resp.contacted
          ? `Primul contact după ${resp.minutes < 120 ? `${resp.minutes} min` : `${fmt(resp.minutes / 60, 0)} h`}${resp.onTime ? ', în ținta de o oră.' : ', peste ținta de o oră.'}`
          : resp.onTime
            ? `Necontactat încă; au trecut ${resp.minutes} min din ținta de 60.`
            : `Necontactat de ${resp.minutes < 120 ? `${resp.minutes} min` : `${fmt(resp.minutes / 60, 0)} h`}: peste ținta de o oră.`}
      </p>

      <h3>Etapa</h3>
      <div className="stage-picker" role="group" aria-label="Etapa cererii">
        {STAGES.map((s) => (
          <button key={s.id} type="button" aria-pressed={lead.stage === s.id} onClick={() => onChange(withStage(lead, s.id))}>
            {s.label}
          </button>
        ))}
      </div>

      <h3>Follow-up</h3>
      <ol className="steps">
        {steps.map((s) => (
          <Step key={s.id} lead={lead} step={s} now={now} onDone={() => onChange(withStepDone(lead, s.id, s.title))} />
        ))}
      </ol>

      <h3>Linia</h3>
      <p className="line-data">
        <b>{lead.verdict}.</b> {fmt(a.weight)} kg, {fmt(a.rate)} găleți/min, {a.perPallet} pe palet, {a.shifts} schimburi, {HANDLE[a.handle] || ''}
        {a.network ? `, rețea ${a.network}` : ''}. Pas preferat: {preferenceLabel(lead.preference).toLowerCase()}.
      </p>

      <h3>Note</h3>
      <form
        className="note-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          onChange(withNote(lead, note.trim()));
          setNote('');
        }}
      >
        <label className="sr-only" htmlFor="note">
          Notă nouă
        </label>
        <textarea id="note" rows={2} value={note} placeholder="Ce s-a discutat, ce urmează" onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="chip-btn chip-primary" disabled={!note.trim()}>
          Adaugă nota
        </button>
      </form>
      <ul className="notes">
        {(lead.notes || []).map((n) => (
          <li key={n.at}>
            <span>{ago(n.at, now)}</span>
            {n.text}
          </li>
        ))}
      </ul>

      <h3>Istoric</h3>
      <ul className="history">
        {[...(lead.history || [])].reverse().map((h, i) => (
          <li key={`${h.at}-${i}`}>
            <span>{new Date(h.at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}</span> {h.text}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Crm({ onSignOut }) {
  const now = useNow();
  const [leads, setLeads] = useState(loadLeads);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    document.title = 'CRM cereri UR20 (demo) | Tech-Con';
    return () => {
      document.title = 'Verificare celulă de paletizare UR20 | Tech-Con';
    };
  }, []);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const urgency = (l) => ({ overdue: 0, due: 1, upcoming: 2 })[nextAction(l, now)?.state] ?? 3;
    return leads
      .filter((l) => f.test(l, now))
      .sort((x, y) => urgency(x) - urgency(y) || x.priority.localeCompare(y.priority) || new Date(y.createdAt) - new Date(x.createdAt));
  }, [leads, filter, now]);

  const open = leads.find((l) => l.cui === openId);
  const change = (updated) => setLeads(updateLead(updated));
  const loadDemo = () => {
    const mine = leads.filter((l) => !l.demo);
    const next = [...mine, ...demoLeads()];
    saveLeads(next);
    setLeads(next);
  };
  const clearDemo = () => {
    const next = leads.filter((l) => !l.demo);
    saveLeads(next);
    setLeads(next);
    setOpenId(null);
  };

  return (
    <div className={`crm ${open ? 'has-detail' : ''}`}>
      <header className="crm-top">
        <div>
          <p className="brand-inline">Tech-Con</p>
          <h1>Cereri de evaluare UR20</h1>
          <p className="fine">
            Demonstrație: datele rămân în acest browser. În producție, cererile ajung pe server și exportul CSV intră în CRM-ul existent.
          </p>
        </div>
        <nav className="crm-tools">
          <a className="chip-btn" href="../">
            Instrumentul
          </a>
          {onSignOut && (
            <button type="button" className="chip-btn" onClick={onSignOut}>
              Ieși
            </button>
          )}
          <button type="button" className="chip-btn" onClick={loadDemo}>
            Încarcă cereri demo
          </button>
          {leads.some((l) => l.demo) && (
            <button type="button" className="chip-btn" onClick={clearDemo}>
              Șterge cererile demo
            </button>
          )}
          <button type="button" className="chip-btn chip-primary" disabled={!leads.length} onClick={() => downloadCsv(shown)}>
            Export CSV
          </button>
        </nav>
      </header>

      {leads.length > 0 && <Stats leads={leads} now={now} />}

      <div className="crm-body">
        <section className="crm-list" aria-label="Cereri">
          <div className="filters" role="group" aria-label="Filtru">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {leads.length === 0 ? (
            <div className="empty">
              <p>Nicio cerere încă.</p>
              <p>
                Trimite o cerere din <a href="../">instrument</a> sau încarcă cererile demo ca să vezi pipeline-ul și follow-up-ul.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <p className="empty">Nicio cerere pentru acest filtru.</p>
          ) : (
            <ul className="lead-list">
              {shown.map((l) => (
                <LeadRow key={l.cui} lead={l} now={now} active={l.cui === openId} onOpen={() => setOpenId(l.cui)} />
              ))}
            </ul>
          )}
        </section>
        {open && <LeadDetail key={open.cui} lead={open} now={now} onChange={change} onClose={() => setOpenId(null)} />}
      </div>
      <p className="fine crm-foot">
        Pașii de follow-up: confirmare automată, apel în cel mult o oră, studiu de caz în ziua 2, pasul preferat de client în ziua 5
        ({PREFERENCES.map((p) => p.short).join(', ')}), revenire în ziua 14.
      </p>
    </div>
  );
}
