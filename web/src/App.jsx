import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { assess, validate } from './lib/calc.js';
import { fromQuery } from './lib/share.js';
import { loadAnswers, saveAnswers } from './lib/store.js';
import Questions, { QUESTIONS } from './ui/Questions.jsx';
import Checking from './ui/Checking.jsx';
import Result from './ui/Result.jsx';
import EditForm from './ui/EditForm.jsx';
import Request from './ui/Request.jsx';
import Impact from './ui/Impact.jsx';
import Assistant from './ui/Assistant.jsx';
import { IMPACT_DEFAULTS, cellsNeeded } from './lib/impact.js';
import PrintSheet from './ui/PrintSheet.jsx';
import { EXAMPLES, Examples, Faq, Sent } from './ui/Extras.jsx';

// The CRM is a separate chunk, opened at #crm.
const Crm = lazy(() => import('./crm/Crm.jsx'));

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

// The 3D scene is a separate chunk: the questions render before three.js arrives.
const CellStage = lazy(() => import('./scene/CellStage.jsx'));

const SPEED = 4; // the animation runs four times faster than the line
const DEFAULTS = {
  weight: 13,
  rate: 6,
  perPallet: 44,
  shifts: 2,
  handle: 'da',
  shiftHours: 8,
  separators: null,
  network: null,
  county: null,
  cells: null, // null = as many as the line needs
};

function initialState() {
  const shared = fromQuery(window.location.search);
  if (shared) return { answers: { ...DEFAULTS, ...shared }, screen: { name: 'result' } };
  const saved = loadAnswers();
  const ok = saved && validate(saved).ok;
  return { answers: { ...DEFAULTS, ...(ok ? saved : {}) }, screen: { name: 'q', i: 0 } };
}

export default function App() {
  const hash = useHash();
  if (hash === '#crm')
    return (
      <Suspense fallback={<p className="crm-loading">Se încarcă CRM-ul…</p>}>
        <Crm />
      </Suspense>
    );
  return <Tool />;
}

function Tool() {
  const [init] = useState(initialState);
  const [answers, setAnswers] = useState(init.answers);
  const [screen, setScreen] = useState(init.screen);
  const [sent, setSent] = useState(null);
  const [impactOptions, setImpactOptions] = useState({ operatorsBefore: IMPACT_DEFAULTS.operatorsBefore, monthlyCostEur: IMPACT_DEFAULTS.monthlyCostEur });
  const [stats, setStats] = useState({ counts: [0, 0], status: ['filling', 'filling'], active: 0 });
  const onStats = useCallback((s) => setStats(s), []);

  // Screens are history entries, so the phone's back gesture steps back instead of leaving.
  const go = useCallback((next) => {
    window.history.pushState({ screen: next }, '');
    setScreen(next);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    window.history.replaceState({ screen: init.screen }, '');
    const onPop = (e) => setScreen(e.state?.screen || { name: 'q', i: 0 });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [init.screen]);

  useEffect(() => saveAnswers(answers), [answers]);

  const assessment = useMemo(() => assess(answers), [answers]);
  const setAnswer = useCallback((key, value) => setAnswers((a) => ({ ...a, [key]: value })), []);
  const restart = () => {
    setAnswers(DEFAULTS);
    go({ name: 'q', i: 0 });
  };
  const toChecking = useCallback(() => go({ name: 'checking' }), [go]);
  const toResult = useCallback(() => {
    window.history.replaceState({ screen: { name: 'result' } }, '');
    setScreen({ name: 'result' });
  }, []);

  const pickExample = (id) => {
    if (id === 'wrong') return go({ name: 'edit', raw: EXAMPLES.wrong, showErrors: true });
    setAnswers({ ...DEFAULTS, ...EXAMPLES[id] });
    go({ name: 'checking' });
  };

  const swapping = stats.status.some((s) => s !== 'filling');
  let body;
  switch (screen.name) {
    case 'checking':
      body = <Checking onDone={toResult} />;
      break;
    case 'result':
      body = (
        <Result
          answers={answers}
          assessment={assessment}
          onChange={setAnswer}
          onRequest={() => go({ name: 'request' })}
          onEdit={() => go({ name: 'edit' })}
          onImpact={() => go({ name: 'impact' })}
          onRestart={restart}
        />
      );
      break;
    case 'impact':
      body = (
        <Impact
          answers={answers}
          options={impactOptions}
          onOptions={(o) => setImpactOptions((x) => ({ ...x, ...o }))}
          onCells={(n) => setAnswer('cells', n)}
          onBack={() => window.history.back()}
          onRequest={() => go({ name: 'request' })}
        />
      );
      break;
    case 'edit':
      body = (
        <EditForm
          initial={screen.raw || answers}
          showErrors={screen.showErrors}
          onSubmit={(values) => {
            setAnswers((a) => ({ ...a, ...values }));
            go({ name: 'checking' });
          }}
          onCancel={() => window.history.back()}
        />
      );
      break;
    case 'request':
      body = (
        <Request
          answers={answers}
          assessment={assessment}
          onBack={() => window.history.back()}
          onSent={(lead, duplicate) => {
            setSent({ lead, duplicate });
            setAnswer('county', lead.countyCode);
            go({ name: 'sent' });
          }}
        />
      );
      break;
    case 'sent':
      body = sent ? (
        <Sent
          {...sent}
          answers={answers}
          title={assessment.verdict.title}
          onRestart={restart}
        />
      ) : null;
      break;
    case 'examples':
      body = <Examples onPick={pickExample} onBack={() => window.history.back()} />;
      break;
    default: {
      const i = screen.i || 0;
      body = (
        <>
          <Questions
            key={i}
            index={i}
            answers={answers}
            onAnswer={setAnswer}
            onNext={() => (i + 1 < QUESTIONS.length ? go({ name: 'q', i: i + 1 }) : toChecking())}
            onBack={() => window.history.back()}
            onExamples={() => go({ name: 'examples' })}
          />
          {i === 0 && <Faq />}
        </>
      );
    }
  }

  return (
    <>
      <main className="demo">
        <section className="stage" aria-label="Animație ilustrativă a celulei de paletizare UR20">
          <Suspense fallback={<div className="cell-stage cell-loading" />}>
            <CellStage
              weight={answers.weight}
              rate={answers.rate}
              perPallet={answers.perPallet}
              speed={SPEED}
              cells={answers.cells ?? cellsNeeded(answers.weight, answers.rate)}
              onStats={onStats}
            />
          </Suspense>
          <p className="brand">Tech-Con</p>
          <div className="pills">
            <span className="pill">
              Palet {'AB'[stats.active]}{' '}
              <b>
                {stats.counts[stats.active]}/{answers.perPallet}
              </b>
            </span>
            {swapping && <span className="pill pill-alert">schimb de palet, manual</span>}
          </div>
          <p className="note">animație ilustrativă, ×{SPEED}</p>
          <Assistant
            answers={answers}
            assessment={assessment}
            onApply={(values) => {
              setAnswers((a) => ({ ...a, ...values, cells: null }));
              go({ name: 'checking' });
            }}
          />
        </section>
        <section className="card">{body}</section>
      </main>
      <PrintSheet answers={answers} assessment={assessment} lead={sent?.lead} />
    </>
  );
}
