import { useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, Segmented, Toggle, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { DEFAULT_SETTINGS, exportJSON, importJSON, resetAll, update, uid, useStore } from '../lib/store.js';
import { allCourses, coursePar, findCourse } from '../lib/courses.js';
import { COURSES } from '../data/courses.js';
import { GAMES } from '../lib/round.js';
import { GameOptions } from '../components/GameOptions.jsx';
import { money } from '../lib/golf.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { formatIndex } from '../lib/format.js';

export default function Settings() {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  const me = state.players[state.me];

  const backup = async () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const name = `birdie-bank-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'Birdie Bank backup' }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('Backup saved');
  };
  const restore = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!(await ask({ title: 'Restore this backup?', text: 'Everything on this phone will be replaced with the backup.', confirmLabel: 'Restore', danger: true }))) return;
    try { importJSON(await f.text()); showToast('Backup restored'); }
    catch { showToast('That file isn’t a Birdie Bank backup'); }
  };
  const reset = async () => {
    if (!(await ask({ title: 'Erase everything?', text: 'All players, crews, rounds and payments on this phone will be deleted. Make a backup first if you might want them.', confirmLabel: 'Erase all data', danger: true }))) return;
    resetAll();
  };

  const row = (icon, title, sub, onClick) => (
    <button className="set-row" onClick={onClick}>
      <div className="set-icon"><Icon name={icon} fill /></div>
      <div className="row-main"><div className="set-name">{title}</div>{sub && <div className="set-sub">{sub}</div>}</div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );

  return (
    <Screen>
      <Header title="Settings" />
      <div className="scroll">
        <div className="sec-label">You</div>
        {me && row('user-circle', me.name, me.index == null ? 'No handicap index' : `Index ${formatIndex(me.index)}`, () => nav.push('playerEdit', { id: me.id }))}
        <div className="sec-label">Appearance</div>
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Theme</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={state.settings.theme} onChange={v => update(s => { s.settings.theme = v; })}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
        <div className="sec-label">Games</div>
        {row('sliders-horizontal', 'Game defaults', 'Stakes, presses, ties and handicaps', () => nav.push('defaults'))}
        {row('map-trifold', 'Courses', `${allCourses(state).length} courses · add or fix a scorecard`, () => nav.push('courses'))}
        <div className="sec-label">Your data</div>
        {row('export', 'Back up', 'Save everything to a file', backup)}
        <label className="set-row" htmlFor="restore-file" role="button" tabIndex={0}>
          <div className="set-icon"><Icon name="download-simple" fill /></div>
          <div className="row-main"><div className="set-name">Restore from backup</div><div className="set-sub">Replace this phone’s data with a backup file</div></div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </label>
        <input id="restore-file" type="file" accept="application/json,.json" hidden onChange={restore} />
        <div className="sec-label">About</div>
        {row('info', 'About Birdie Bank', 'Rules, handicaps and the fine print', () => nav.push('about'))}
        <button className="danger-link" onClick={reset}><Icon name="trash" /> Erase all data</button>
      </div>
      <BottomNav />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

export function Defaults() {
  const nav = useNav();
  const s = useStore(st => st.settings);
  const [pad, setPad] = useState(null);
  const set = (path, v) => update(st => { const k = path.split('.'); let t = st.settings; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], s);
  const amount = (path, label, min = 1, max = 999) => (
    <div className="nassau-bet-row">
      <div className="nassau-bet-lbl">{label}</div>
      <button className="nassau-bet-btn" onClick={() => setPad({ path, label, min, max })}>{money(get(path))}</button>
    </div>
  );
  const bankerBad = s.banker.min > s.banker.max || s.banker.defaultBet < s.banker.min || s.banker.defaultBet > s.banker.max;
  return (
    <Screen>
      <Header title="Game defaults" onBack={nav.pop} />
      <div className="scroll">
        <p className="hint-card">These fill in each new round. You can still change them when you set a round up.</p>
        <div className="sec-label">Handicaps</div>
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Strokes given off the low player</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.hcPct} onChange={v => set('hcPct', v)} options={[100, 90, 80].map(n => ({ value: n, label: `${n}%` }))} />
        </div>
        <div className="sec-label">Banker</div>
        {amount('banker.defaultBet', 'Default bet')}
        {amount('banker.min', 'Minimum bet')}
        {amount('banker.max', 'Maximum bet')}
        {bankerBad && <p className="field-error" style={{ margin: '0 20px 8px' }}>Default bet has to sit between the minimum and maximum.</p>}
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Rotation</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.banker.rotation} onChange={v => set('banker.rotation', v)}
            options={[{ value: 'rotate', label: 'Each hole' }, { value: 'nine', label: 'Each 9' }, { value: 'fixed', label: 'Fixed' }, { value: 'choice', label: 'Pick' }]} />
          <div className="eyebrow" style={{ margin: '14px 0 10px' }}>Ties</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.banker.ties} onChange={v => set('banker.ties', v)}
            options={[{ value: 'push', label: 'Push' }, { value: 'banker', label: 'Banker wins' }]} />
        </div>
        <div className="sec-label">Nassau</div>
        {amount('nassau.front', 'Front 9')}
        {amount('nassau.back', 'Back 9')}
        {amount('nassau.total', 'Total 18')}
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Presses</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.nassau.pressMode} onChange={v => set('nassau.pressMode', v)}
            options={[{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }]} />
          <div className="eyebrow" style={{ margin: '14px 0 10px' }}>Down by</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.nassau.threshold} onChange={v => set('nassau.threshold', v)}
            options={[1, 2, 3].map(n => ({ value: n, label: String(n) }))} />
        </div>
        <div className="sec-label">Skins</div>
        {amount('skins.value', 'Per skin')}
        <div className="toggle-row">
          <div><div className="toggle-lbl">Carryovers</div><div className="toggle-sub">Tied holes roll over</div></div>
          <Toggle on={s.skins.carryover} onChange={v => set('skins.carryover', v)} label="Carryovers" />
        </div>
        <div className="sec-label">Wolf</div>
        {amount('wolf.point', 'Per point')}
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Lone wolf</div>
          <Segmented className="press-mode-row" btn="pm-btn" value={s.wolf.loneMultiplier} onChange={v => set('wolf.loneMultiplier', v)} options={[2, 3].map(n => ({ value: n, label: `${n}×` }))} />
        </div>
        {['match', 'vegas', 'sixes', 'scramble', 'stroke', 'stableford', 'quota', 'nines', 'aces', 'bbb', 'dots', 'rabbit'].map(g => (
          <div key={g}>
            <div className="sec-label">{GAMES[g].name}</div>
            <GameOptions game={g} get={get} set={set} onAmount={(path, label, o) => setPad({ path, label, ...o })} compact />
          </div>
        ))}
        <button className="danger-link" onClick={() => update(st => { st.settings = { ...structuredClone(DEFAULT_SETTINGS), theme: st.settings.theme }; })}><Icon name="arrow-counter-clockwise" /> Reset to defaults</button>
      </div>
      <Numpad open={!!pad} title={pad?.label} prefix="$" initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

export function Courses() {
  const nav = useNav();
  const state = useStore();
  const custom = Object.values(state.customCourses);
  const row = c => (
    <button key={c.id} className="set-row" onClick={() => nav.push('courseEdit', { id: c.id })}>
      <div className="row-main">
        <div className="set-name">{c.name}</div>
        <div className="set-sub">{[c.city, `${c.holes.length} holes`, `Par ${coursePar(c)}`].filter(Boolean).join(' · ')}</div>
        {!c.custom && !c.verified && <div className="warn-tag"><Icon name="warning" fill /> Not verified. Check against the card</div>}
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  return (
    <Screen>
      <Header title="Courses" onBack={nav.pop} />
      <div className="scroll">
        <div className="sec-label">Your courses</div>
        {custom.length === 0 && <p className="hint-card"><Icon name="map-pin" fill /> Playing somewhere new? Add it from the scorecard. Par and handicap for each hole are all you need.</p>}
        {custom.map(row)}
        <button className="add-row" onClick={() => nav.push('courseEdit', {})}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a course</span></button>
        <div className="sec-label">Built in</div>
        {COURSES.filter(c => !custom.some(x => x.replaces === c.id)).map(row)}
      </div>
    </Screen>
  );
}

/** Show a source URL as its host name; anything else (e.g. "Scorecard from the user") as written. */
function sourceLabel(s) {
  try { return /^https?:\/\//i.test(s) ? new URL(s).hostname.replace(/^www\./, '') : s; } catch { return s; }
}

const TEE_COLORS = ['#1a1a1a', '#2f6fd6', '#f2f2f2', '#e8b94a', '#d64545', '#2c8c66'];

function blankCourse(n = 18) {
  return {
    name: '', city: '', custom: true, verified: false,
    holes: Array.from({ length: n }, () => ({ par: 4, hdcp: null })),
    tees: [{ name: 'White', color: '#f2f2f2', rating: null, slope: null }],
  };
}

export function CourseEdit({ id }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  const existing = id ? findCourse(state, id) : null;
  const builtIn = existing && !existing.custom;
  const [c, setC] = useState(() => (existing ? structuredClone(existing) : blankCourse()));
  const [pad, setPad] = useState(null); // { kind, i, t, title, min, max, decimal }

  const n = c.holes.length;
  const setHoles = count => setC(x => ({
    ...x,
    holes: Array.from({ length: count }, (_, i) => x.holes[i] || { par: 4, hdcp: null }),
  }));
  const hdcps = c.holes.map(h => h.hdcp);
  const dupHdcp = hdcps.filter((h, i) => h != null && hdcps.indexOf(h) !== i);
  const missingHdcp = hdcps.some(h => h == null);
  const errors = [];
  if (!c.name.trim()) errors.push('Add the course name');
  if (missingHdcp) errors.push('Every hole needs a handicap');
  if (dupHdcp.length) errors.push(`Handicap ${[...new Set(dupHdcp)].join(', ')} is used twice`);
  if (!c.tees.length) errors.push('Add at least one tee');
  if (c.tees.some(t => !t.name.trim())) errors.push('Every tee needs a name');

  const save = () => {
    const cid = builtIn ? `${existing.id}-custom` : (id || uid('course_'));
    update(s => {
      s.customCourses[cid] = { ...c, id: cid, custom: true, verified: false, replaces: builtIn ? existing.id : c.replaces, name: c.name.trim(), city: c.city.trim() };
      if (builtIn) s.favorites = s.favorites.map(f => (f === existing.id ? cid : f));
    });
    showToast(builtIn ? 'Saved your corrected copy' : 'Course saved');
    nav.pop();
  };
  const remove = async () => {
    if (!(await ask({ title: `Delete ${existing.name}?`, text: existing.replaces ? 'The built-in version comes back.' : 'Past rounds keep their scorecards.', confirmLabel: 'Delete course', danger: true }))) return;
    update(s => { delete s.customCourses[id]; s.favorites = s.favorites.filter(f => f !== id); });
    nav.pop();
  };

  const onPad = v => {
    const p = pad;
    setC(x => {
      const y = structuredClone(x);
      if (p.kind === 'hdcp') y.holes[p.i].hdcp = v;
      if (p.kind === 'rating') y.tees[p.t].rating = v;
      if (p.kind === 'slope') y.tees[p.t].slope = v;
      return y;
    });
    // Advance to the next hole for fast entry
    if (p.kind === 'hdcp' && p.i < n - 1) setPad({ ...p, i: p.i + 1, title: p.title.replace(/Hole \d+/, `Hole ${p.i + 2}`) });
    else setPad(null);
  };

  return (
    <Screen>
      <Header title={builtIn ? 'Course details' : existing ? 'Edit course' : 'Add a course'} onBack={nav.pop} />
      <div className="scroll">
        {builtIn && (
          <p className="hint-card"><Icon name={existing.verified ? 'seal-check' : 'warning'} fill /> {existing.verified ? 'Par and hole handicaps are confirmed from a real scorecard.' : 'We couldn’t double-check this scorecard. Compare it with the card at the course and fix anything that’s off.'} Changes save as your own copy.</p>
        )}
        <div className="block">
          <label className="field-label" htmlFor="cn">Course name</label>
          <input id="cn" className="name-input" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} placeholder="e.g. Birch Creek GC" />
          <label className="field-label" htmlFor="cc">City</label>
          <input id="cc" className="text-input" value={c.city || ''} onChange={e => setC({ ...c, city: e.target.value })} placeholder="City, State" />
          <label className="field-label">Holes</label>
          <Segmented value={n} onChange={setHoles} options={[{ value: 9, label: '9' }, { value: 18, label: '18' }]} />
        </div>

        <div className="sec-label">Par &amp; handicap · Par {coursePar(c)}</div>
        <div className="hole-grid">
          {c.holes.map((h, i) => (
            <div key={i} className={`hole-cell ${dupHdcp.includes(h.hdcp) ? 'bad' : ''}`}>
              <div className="hc-no">{i + 1}</div>
              <div className="par-pick" role="radiogroup" aria-label={`Hole ${i + 1} par`}>
                {[3, 4, 5].map(p => (
                  <button key={p} role="radio" aria-checked={h.par === p} className={h.par === p ? 'on' : ''}
                    onClick={() => setC(x => { const y = structuredClone(x); y.holes[i].par = p; return y; })}>{p}</button>
                ))}
              </div>
              <button className="hdcp-btn" onClick={() => setPad({ kind: 'hdcp', i, title: `Hole ${i + 1} handicap`, min: 1, max: 18 })}>
                HCP {h.hdcp ?? '–'}
              </button>
            </div>
          ))}
        </div>

        <div className="sec-label">Tees</div>
        {c.tees.map((t, ti) => (
          <div key={ti} className="block tee-block">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="text-input" style={{ flex: 1 }} value={t.name} aria-label="Tee name" placeholder="Tee name"
                onChange={e => setC(x => { const y = structuredClone(x); y.tees[ti].name = e.target.value; return y; })} />
              <button className="icon-btn sm" aria-label="Remove tee" disabled={c.tees.length === 1}
                onClick={() => setC(x => ({ ...x, tees: x.tees.filter((_, k) => k !== ti) }))}><Icon name="trash" /></button>
            </div>
            <div className="color-row" role="radiogroup" aria-label="Tee colour">
              {TEE_COLORS.map(col => (
                <button key={col} role="radio" aria-checked={t.color === col} aria-label={col} className={`swatch ${t.color === col ? 'on' : ''}`} style={{ background: col }}
                  onClick={() => setC(x => { const y = structuredClone(x); y.tees[ti].color = col; return y; })} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pill-btn" onClick={() => setPad({ kind: 'rating', t: ti, title: `${t.name} course rating`, min: 25, max: 80, decimal: true })}>Rating {t.rating ?? '–'}</button>
              <button className="pill-btn" onClick={() => setPad({ kind: 'slope', t: ti, title: `${t.name} slope`, min: 55, max: 155 })}>Slope {t.slope ?? '–'}</button>
            </div>
            {(t.rating == null || t.slope == null) && <p className="field-help">Without rating and slope, course handicaps fall back to each player’s index.</p>}
          </div>
        ))}
        <button className="add-row" onClick={() => setC(x => ({ ...x, tees: [...x.tees, { name: '', color: TEE_COLORS[x.tees.length % TEE_COLORS.length], rating: null, slope: null }] }))}>
          <div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add tee</span>
        </button>
        {existing && !builtIn && <button className="danger-link" onClick={remove}><Icon name="trash" /> Delete course</button>}
        {existing?.sources?.length > 0 && <p className="field-help" style={{ padding: '0 20px' }}>Sources: {existing.sources.map(sourceLabel).join(', ')}</p>}
      </div>
      <div className="cta-wrap">
        {errors.length > 0 && <p className="field-error" style={{ margin: 0, textAlign: 'center' }}>{errors[0]}</p>}
        <button className="full-btn" disabled={errors.length > 0} onClick={save}>{builtIn ? 'Save my corrections' : 'Save course'}</button>
      </div>
      <Numpad key={pad ? `${pad.kind}-${pad.i ?? pad.t}` : 'none'} open={!!pad} title={pad?.title} min={pad?.min} max={pad?.max} allowDecimal={!!pad?.decimal}
        initial={pad ? (pad.kind === 'hdcp' ? c.holes[pad.i].hdcp : c.tees[pad.t][pad.kind]) ?? '' : ''}
        onClose={() => setPad(null)} onDone={onPad} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

export function About() {
  const nav = useNav();
  const [rules, setRules] = useState(null);
  return (
    <Screen>
      <Header title="About" onBack={nav.pop} />
      <div className="scroll">
        <div className="sec-label">Game rules</div>
        {Object.entries(GAMES).map(([k, g]) => (
          <button key={k} className="set-row" onClick={() => setRules(k)}>
            <div className="row-main"><div className="set-name">{g.name}</div><div className="set-sub">{g.players}</div></div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        ))}
        <div className="sec-label">Handicaps</div>
        <div className="block rules-body">
          <p>Course handicap = index × slope ÷ 113 + (course rating − par), rounded. For 9 holes it’s half of the 18-hole figure.</p>
          <p style={{ marginTop: 8 }}>In every game the lowest player plays off zero and everyone else gets the difference (or the percentage you choose), taken on the hardest holes first. Picked-up holes count as net double bogey.</p>
        </div>
        <div className="sec-label">The fine print</div>
        <div className="block rules-body">
          <p>Birdie Bank is a scorekeeper for friendly games. It doesn’t hold, move or collect money, and it isn’t a gambling service. Make sure betting on golf is legal where you play.</p>
          <p style={{ marginTop: 8 }}>Your data stays on this phone. Back it up from Settings if you switch phones.</p>
        </div>
        <Empty illo title="Birdie Bank" text="Made for the Saturday group." />
      </div>
      <RulesSheet game={rules} open={!!rules} onClose={() => setRules(null)} />
    </Screen>
  );
}
