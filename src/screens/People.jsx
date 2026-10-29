import { useState } from 'react';
import { Empty, Header, Icon, Numpad, PickChip, PickRow, Screen, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton } from '../components/Pay.jsx';
import { useRemind } from '../lib/useRemind.js';
import { update, uid, useStore } from '../lib/store.js';
import { useRecordBook } from '../lib/useRecordBook.js';
import { RecordBookNote } from '../components/RecordBookNote.jsx';
import { firstName, formatIndex, myIds, playerLabel, sortedPlayers } from '../lib/format.js';
import { mergePlayer, mergedInto, unmergePlayer } from '../lib/merge.js';
import { headToHeadSummary, nameOf, outstanding, tabWith } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { PAY_APPS, PAY_APP_IDS, handleText, payInfo, payInfoFor, profilePayInfo } from '../lib/pay.js';
import { theirName } from '../lib/their-profile.js';
import { savePlayerCard } from '../lib/player-save.js';
import { money } from '../lib/golf.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { roundsInProgress } from '../lib/rounds.js';
import './people.css';
import { useNav } from '../lib/nav.js';
import { useKept } from '../lib/kept.js';
import { RSVP_LABEL, dayLabel, rsvpFor } from '../lib/plans.js';
import { nemesis } from '../lib/rivalry.js';
import { NemesisCard } from '../components/Rivalry.jsx';

/** "today", "tomorrow" or the short weekday ("Sat") for the RSVP tag; a plan with no day yet (plan-open.js) reads "soon". */
const dayName = iso => { const d = dayLabel(iso); return !d ? 'soon' : d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : d.slice(0, 3); };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

// The row of big avatars on top: the people you've played with most, once the list is long
// enough to need it, and only those you've played a couple of rounds with
const REGULARS_MAX = 5;
const REGULARS_FROM = 6; // people in the list before the row shows
const SEARCH_FROM = 8;

/**
 * Players: you, then everyone you play with as compact rows (Layout Lab, none loved: the photo or
 * Ball buddy and the name first, the record kept to a quiet line, no crews first since most people
 * play with more than one). The money between you over every round is on their card (Person.jsx). Money on the Tab between you is a small pill on the row that opens
 * Remind, Request or Pay. Newest friends from joined rounds are here too.
 */
// "New" marks someone added in the last two weeks you haven't played with yet. Everyone you've never
// played with read "New" before, which on a long list was a tag on every other row
const NEW_FOR = 14 * 86400000;
const justAdded = p => !!p?.createdAt && Date.now() - p.createdAt < NEW_FOR;

export default function People() {
  const nav = useNav();
  const state = useStore();
  const mine = myIds(state);
  // Everyone you've played with, from every round, so nobody with money on the Tab drops off the list
  const everyone = headToHeadSummary(state, mine);
  // The Record Book limit (record-book.js): with the paywall flag on and no Pro, each row's record
  // and the nemesis read the last 10 finished rounds. With the flag off `view` is the store's state
  const { state: view, line } = useRecordBook();
  const h2h = view === state ? everyone : headToHeadSummary(view, mine);
  const plan = outstanding(state);
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState(null);
  const me = state.me && state.players[state.me];
  // Everyone you've added, plus people you've only met in a joined round. A friend with more than
  // one id (a claimed seat, "Same person as...") is one row, under the id kept for them
  const who = canonicalOf(state);
  const ids = new Set([...Object.keys(state.players), ...everyone.keys()].map(who));
  for (const id of mine) { ids.delete(id); ids.delete(who(id)); }
  const people = [...ids].map(id => ({ id, name: nameOf(state, id), h: h2h.get(id), older: !h2h.get(id) && !!everyone.get(id), p: state.players[id] }))
    .sort((a, b) => (b.h?.rounds || 0) - (a.h?.rounds || 0) || a.name.localeCompare(b.name));
  const crews = Object.values(state.crews).sort((a, b) => a.name.localeCompare(b.name));
  const myPay = me && payInfo(me);
  const needle = q.trim().toLowerCase();
  const shown = needle ? people.filter(x => x.name.toLowerCase().includes(needle)) : people;
  // New: the three most recent adds from the last two weeks you haven't played with, not every one
  const newest = new Set(people.filter(x => !x.h && !x.older && justAdded(x.p)).sort((a, b) => b.p.createdAt - a.p.createdAt).slice(0, 3).map(x => x.id));
  const regulars = people.length >= REGULARS_FROM ? people.filter(x => (x.h?.rounds || 0) >= 2).slice(0, REGULARS_MAX) : [];
  return (
    <Screen>
      <Header title="Players" right={<AvatarButton />} />
      <div className="scroll">
        {me && (
          <button className="pl-me" onClick={() => nav.push('profile')}>
            <Avatar id={me.id} name={me.name} />
            <div className="row-main">
              <div className="pl-name">{playerLabel(me, state.me)}</div>
              <div className="pl-sub">{me.index == null ? 'No handicap' : `HCP ${formatIndex(me.index)}`} · {myPay ? `${PAY_APPS[myPay.app].name} ${handleText(myPay)}` : 'Add how you get paid'}</div>
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}

        {/* The people you play with most, big and one tap away (the Roster idea, kept to one row) */}
        {regulars.length >= 3 && !needle && (
          <>
            <h2 className="sec-label">Played with most</h2>
            <div className="pl-regulars">
              {regulars.map(({ id, name }) => (
                <button key={id} className="pl-reg" onClick={() => nav.push('person', { id })}>
                  <Avatar id={id} name={name} className="pl-reg-av" />
                  <span className="pl-reg-name">{firstName(name)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {people.length > 0 && (
          <div className="pl-head">
            <h2 className="sec-label">Your people <span className="opt">{people.length}</span></h2>
            {people.length >= SEARCH_FROM && <button className="pl-add-btn" onClick={() => nav.push('playerEdit', {})} aria-label="Add a player"><Icon name="plus" /> Add</button>}
          </div>
        )}
        {people.length >= SEARCH_FROM && (
          <div className="pl-search">
            <label className="sr-only" htmlFor="pl-q">Search players</label>
            <input id="pl-q" className="search-box" type="search" placeholder="Search players" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" />
          </div>
        )}
        {people.length > 0 && (
          <div className="pl-list">
            {shown.map(({ id, name, h, older, p }) => {
              const tab = tabWith(plan, mine, id);
              const amount = Math.abs(tab);
              const rsvp = rsvpFor(state, id);
              const record = h ? `${h.rounds} round${h.rounds === 1 ? '' : 's'} · won ${h.won}, lost ${h.lost}${h.even ? `, even ${h.even}` : ''}`
                : older ? 'Your rounds together are older ones' : p?.index != null ? `HCP ${formatIndex(p.index)}` : 'No rounds together yet';
              return (
                <div key={id} className="pl-row">
                  <button className="pl-main" onClick={() => nav.push('person', { id })}>
                    <Avatar id={id} name={name} />
                    <div className="row-main">
                      <div className="pl-name">{name}{newest.has(id) && <span className="new-chip">New</span>}</div>
                      <div className="pl-sub">
                        {rsvp && <span className={`pl-rsvp ${rsvp.status || 'none'}`}>{rsvp.status ? `${RSVP_LABEL[rsvp.status]} ${dayName(rsvp.plan.date)}` : `${cap(dayName(rsvp.plan.date))}?`}</span>}
                        <span className="pl-record">{record}</span>
                      </div>
                    </div>
                  </button>
                  {/* Money on the Tab between you: one small pill, Remind and Request or Pay behind it */}
                  {tab ? (
                    <button className={`pl-owe ${tab > 0 ? 'pos' : 'neg'}`} onClick={() => setPaying({ id, name, tab })} aria-label={tab > 0 ? `${name} owes you ${money(amount)}. Remind or request` : `You owe ${name} ${money(amount)}. Pay`}>
                      {tab > 0 ? `+${money(amount)}` : `−${money(amount)}`}
                    </button>
                  ) : null}
                  {/* The chevron on every row, money or not, so the column lines up */}
                  <span className="chevron" aria-hidden="true"><Icon name="caret-right" /></span>
                </div>
              );
            })}
            {needle && !shown.length && <p className="pl-none">Nobody called “{q.trim()}”. <button className="pl-none-add" onClick={() => nav.push('playerEdit', {})}>Add them</button></p>}
            {/* Adding someone is the list's last row, not a dashed card of its own (players-2) */}
            {!needle && (
              <div className="pl-row pl-add-row">
                <button className="pl-main" onClick={() => nav.push('playerEdit', {})}>
                  <span className="pl-add-ci" aria-hidden="true"><Icon name="plus" /></span>
                  <span className="row-main pl-add-lbl">Add a player</span>
                </button>
              </div>
            )}
          </div>
        )}
        {people.length < 1 && (
          <div className="people-empty">
            <div className="pe-outlines" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className="pe-ghost"><Icon name="user" /></span>)}</div>
            <div className="pe-title d">Add the people you play with</div>
            <p className="pe-sub">Then pick them in one tap when you start a round. Everyone gets a Ball buddy.</p>
            {/* The card's own button, so the empty state carries its action (players-4) */}
            <button className="full-btn pe-add" onClick={() => nav.push('playerEdit', {})}><Icon name="plus" /> Add a player</button>
          </div>
        )}
        <RecordBookNote line={line} />
        {people.length > 0 && (
          <button className="text-link" onClick={() => nav.push('friends', { view: 'list' })}>
            <Icon name="users-three" fill /> All your friends, and people you might know
          </button>
        )}

        {/* The rivalry, kept below the list so the people come first */}
        <NemesisCard n={nemesis(view, mine)} />

        {crews.length > 0 ? (
          <>
            <div className="sec-label">Crews</div>
            {crews.map(c => (
              <button key={c.id} className="set-row" onClick={() => nav.push('crewEdit', { id: c.id })}>
                <div className="row-main">
                  <div className="set-name">{c.name}</div>
                  <div className="set-sub">{c.playerIds.map(id => state.players[id]?.name).filter(Boolean).join(', ') || 'No players'}</div>
                </div>
                <span className="chevron"><Icon name="caret-right" /></span>
              </button>
            ))}
            <button className="text-link" onClick={() => nav.push('crewEdit', {})}><Icon name="plus" /> Make a crew</button>
          </>
        ) : Object.keys(state.players).length > 2 && (
          <button className="text-link" onClick={() => nav.push('crewEdit', {})}>
            <Icon name="users-three" fill /> Play with the same group a lot? Save them as a crew
          </button>
        )}
      </div>
      <BottomNav />
      <PaySheet who={paying} onClose={() => setPaying(null)} />
    </Screen>
  );
}

/** What's on the Tab with one person: Remind and Request when they owe you, Pay when you owe them. */
function PaySheet({ who, onClose }) {
  const nav = useNav();
  const state = useStore();
  const remind = useRemind();
  if (!who) return null;
  const { id, name, tab } = who;
  const amount = Math.abs(tab);
  const first = firstName(name);
  return (
    <Sheet open onClose={onClose} title={tab > 0 ? `${first} owes you ${money(amount)}` : `You owe ${first} ${money(amount)}`}>
      <div className="pay-acts wrap pl-pay">
        {tab > 0 ? (
          <>
            <button className="pay-btn" onClick={() => { remind(id, amount); onClose(); }} aria-label={`Remind ${first} about ${money(amount)}`}><span className="pay-in"><Icon name="bell-ringing" fill /><span className="pay-lbl">Remind</span></span></button>
            <RequestButton payer={payInfoFor(state, id)} mine={payInfoFor(state, state.me)} amount={amount} note="Golf" who={id} />
          </>
        ) : <PayButton info={payInfoFor(state, id)} amount={amount} note="Golf" />}
      </div>
      {tab < 0 && !payInfoFor(state, id) && <p className="field-help pl-pay-help">{first} hasn’t added how they get paid yet.</p>}
      <button className="text-link" onClick={() => { onClose(); nav.push('person', { id }); }}><Icon name="user" /> {first}’s card and the rounds behind it</button>
    </Sheet>
  );
}

export function PlayerEdit({ id, onSaved }) {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const state = useStore();
  // Someone you only met in a joined round has no saved player yet; saving gives them one
  const existing = id ? state.players[id] || { id, name: nameOf(state, id), joined: true } : null;
  const [merging, setMerging] = useState(false);
  const [name, setName] = useKept('player:name', existing?.name || '');
  const [index, setIndex] = useKept('player:index', existing?.index ?? null);
  const [payApp, setPayApp] = useKept('player:payApp', payInfo(existing)?.app || null);
  const [handle, setHandle] = useKept('player:handle', () => { const i = payInfo(existing); return i ? handleText(i) : ''; });
  const isMe = !!id && id === state.me;
  const [pad, setPad] = useState(false);
  const trimmed = name.trim();
  const duplicate = Object.values(state.players).some(p => p.id !== id && !p.mergedInto && p.name.toLowerCase() === trimmed.toLowerCase());
  const mine = myIds(state);
  const h2h = headToHeadSummary(state, mine);
  const roundsWith = (id && h2h.get(id)?.rounds) || 0;
  const merged = id ? mergedInto(state, id) : [];
  // Everyone this player could be: saved players and people from joined rounds, same first name first
  const first = firstName(existing?.name).toLowerCase();
  const candidates = [...new Set([...Object.values(state.players).filter(p => !p.mergedInto).map(p => p.id), ...h2h.keys()])]
    .filter(x => x !== id && !mine.has(x))
    .map(x => ({ id: x, name: nameOf(state, x), rounds: h2h.get(x)?.rounds || 0, saved: !!state.players[x], pay: payInfoFor(state, x) }))
    .sort((a, b) => (firstName(b.name).toLowerCase() === first) - (firstName(a.name).toLowerCase() === first) || a.name.localeCompare(b.name));
  const inActive = id && roundsInProgress(state).some(r => r.players.some(p => p.id === id));
  // Their own profile's name and app win over what you save here; yours is used when theirs has none
  const profName = id && !isMe ? theirName(state, id) : null;
  const profPay = id && !isMe ? profilePayInfo(state, id) : null;
  const who = firstName(profName || existing?.name) || 'They';

  const save = () => {
    const pid = id || uid('p_');
    update(s => savePlayerCard(s, pid, { name: trimmed, index, payApp, handle }));
    showToast(id ? 'Player saved' : `${trimmed} added`);
    if (onSaved) onSaved(pid); else nav.pop();
  };

  const merge = async target => {
    setMerging(false);
    const same = target.name.toLowerCase() === existing.name.toLowerCase();
    const ok = await ask({
      title: same ? `Merge the two ${target.name}s?` : `Merge into ${target.name}?`,
      text: `${same ? 'Their' : `${existing.name}’s`} rounds, record and anything on the Tab add up under ${same ? `one ${target.name}` : target.name}. No rounds change, and you can undo it from ${target.name}’s card.`,
      confirmLabel: 'Merge',
    });
    if (!ok) return;
    update(s => {
      if (!s.players[target.id]) s.players[target.id] = { id: target.id, name: target.name, createdAt: Date.now() };
      mergePlayer(s, id, target.id, { name: existing.name });
    });
    showToast(`Merged into ${target.name}`);
    nav.pop();
  };

  const unmerge = p => {
    update(s => unmergePlayer(s, p.id));
    showToast(`${p.name} is separate again`);
  };

  const remove = async () => {
    const text = roundsWith
      ? `They played ${roundsWith} round${roundsWith === 1 ? '' : 's'} with you, so they’ll still show in Players while ${roundsWith === 1 ? 'that round is' : 'those rounds are'} in History. To clear out test rounds, delete them from History. If this is a second copy of someone, merge them instead.`
      : 'Past rounds keep their scores, and anything they owe stays on the Tab. They’ll be taken out of any crews.';
    const ok = await ask({ title: `Remove ${existing.name}?`, text, confirmLabel: 'Remove player', danger: true });
    if (!ok) return;
    update(s => {
      delete s.players[id];
      for (const c of Object.values(s.crews)) c.playerIds = c.playerIds.filter(x => x !== id);
    });
    nav.pop();
  };

  return (
    <Screen>
      <Header title={existing ? 'Edit player' : 'New player'} onBack={nav.pop} />
      <div className="scroll">
        <div className="block">
          <label className="field-label" htmlFor="pe-name">Name</label>
          <input id="pe-name" className="name-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus={!existing}
            aria-invalid={duplicate || undefined} aria-describedby={duplicate ? 'pe-name-err' : undefined} />
          {profName && profName !== trimmed && <p className="field-help">{who}’s own profile says “{profName}”, so that’s the name you see everywhere. The name here is used if they ever take theirs off.</p>}
          {duplicate && <p className="field-error" id="pe-name-err" role="status">Someone already has that name. Add an initial so scorecards stay clear, or merge them below if it’s the same person.</p>}
          <div className="field-label">Handicap <span className="opt">optional</span></div>
          {/* A field like the name above it, with an inline clear X once there's a number (players-6) */}
          <div className="pe-hc">
            <button className={`name-input pe-hc-btn ${index == null ? 'empty' : ''}`} onClick={() => setPad(true)} aria-label={index == null ? 'Handicap: add one' : `Handicap ${formatIndex(index)}. Change it`}>
              <span>{index == null ? 'Add a handicap' : formatIndex(index)}</span>{index == null && <Icon name="plus" />}
            </button>
            {index != null && <button className="pe-hc-clear" onClick={() => setIndex(null)} aria-label="Clear the handicap"><Icon name="x" /></button>}
          </div>
          <p className="field-help">Their usual 18-hole index. Strokes are worked out from it for each course and tee.</p>
          <div className="field-label" id="pe-pay">{isMe ? 'How you get paid' : `How ${trimmed.split(' ')[0] || 'they'} ${trimmed ? 'gets' : 'get'} paid`} <span className="opt">optional</span></div>
          <div className="chip-row flush" role="group" aria-labelledby="pe-pay">
            {PAY_APP_IDS.map(app => (
              <PickChip key={app} on={payApp === app} onClick={() => setPayApp(payApp === app ? null : app)}>{PAY_APPS[app].name}</PickChip>
            ))}
          </div>
          {payApp && (
            <>
              <label className="sr-only" htmlFor="pe-handle">{PAY_APPS[payApp].label}</label>
              <input id="pe-handle" className="text-input" value={handle} onChange={e => setHandle(e.target.value)} placeholder={PAY_APPS[payApp].placeholder}
                autoCapitalize="none" autoCorrect="off" inputMode={payApp === 'zelle' ? 'email' : 'text'} />
            </>
          )}
          {profPay && <p className="field-help">{who}’s own profile says {PAY_APPS[profPay.app].name} {handleText(profPay)}, so Pay buttons use that. What you pick here is used only if their profile has none.</p>}
          <p className="field-help">
            {payApp === 'zelle'
              ? `Zelle has no pay link, so anyone who owes ${isMe ? 'you' : trimmed.split(' ')[0] || 'them'} sees this with a copy button.`
              : `So ${isMe ? 'people can pay you' : 'you can pay them'} in one tap. Birdie Bank never holds or moves money.`}
          </p>
        </div>
        {merged.length > 0 && (
          <>
            <div className="sec-label">Merged in</div>
            {merged.map(p => (
              <div key={p.id} className="set-row static">
                <div className="row-main">
                  <div className="set-name">{p.name}</div>
                  <div className="set-sub">{p.stub ? 'From a round you joined' : 'A saved player'}</div>
                </div>
                <button className="header-btn" onClick={() => unmerge(p)}>Undo</button>
              </div>
            ))}
          </>
        )}
        {existing && id !== state.me && candidates.length > 0 && (
          <button className="quiet-row" onClick={() => setMerging(true)}>
            <Icon name="git-merge" /> <span>Same person as someone else? <u>Merge</u></span>
          </button>
        )}
        {existing && !existing.joined && id !== state.me && (
          <button className="danger-link" onClick={remove} disabled={inActive}>
            <Icon name="trash" /> {inActive ? 'Can’t remove during a round they’re in' : 'Remove player'}
          </button>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!trimmed || duplicate} onClick={save}>{existing ? 'Save' : 'Add player'}</button>
      </div>
      <Sheet open={merging} onClose={() => setMerging(false)} title={`Who is ${existing?.name || 'this'}?`}>
        <p className="field-help" style={{ margin: '0 20px 8px' }}>Pick the player to keep. Everything with {existing?.name} adds up under them.</p>
        {candidates.map(c => (
          <button key={c.id} className="list-item" onClick={() => merge(c)}>
            <Avatar id={c.id} name={c.name} />
            <div className="row-main">
              <div className="li-name">{c.name}</div>
              <div className="li-sub">{c.rounds ? `${c.rounds} round${c.rounds === 1 ? '' : 's'} together` : 'No rounds together yet'}{c.pay ? ` · ${PAY_APPS[c.pay.app].name} ${handleText(c.pay)}` : ''}{c.saved ? '' : ' · from a round you joined'}</div>
            </div>
          </button>
        ))}
      </Sheet>
      <Numpad open={pad} title="Handicap" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </Screen>
  );
}

export function CrewEdit({ id }) {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  const existing = id ? state.crews[id] : null;
  const [name, setName] = useKept('crew:name', existing?.name || '');
  const [sel, setSel] = useKept('crew:sel', existing?.playerIds || []);
  const players = sortedPlayers(state);
  const toggle = pid => setSel(s => (s.includes(pid) ? s.filter(x => x !== pid) : [...s, pid]));

  const save = () => {
    const cid = id || uid('c_');
    update(s => { s.crews[cid] = { id: cid, name: name.trim(), playerIds: sel }; });
    nav.pop();
  };
  const remove = async () => {
    if (!(await ask({ title: `Delete ${existing.name}?`, text: 'Players stay. Only the group is removed.', confirmLabel: 'Delete crew', danger: true }))) return;
    update(s => { delete s.crews[id]; });
    nav.pop();
  };

  return (
    <Screen>
      <Header title={existing ? 'Edit crew' : 'New crew'} onBack={nav.pop} />
      <div className="scroll">
        <div className="block">
          <label className="field-label" htmlFor="ce-name">Crew name</label>
          <input id="ce-name" className="name-input" value={name} maxLength={28} onChange={e => setName(e.target.value)} placeholder="e.g. Saturday group" />
        </div>
        <div className="sec-label">Who’s in it · {sel.length} selected</div>
        {/* One card of rows, like the Players list (tab-14) */}
        <div className={`pick-list ${players.length ? 'joined' : ''}`}>
          {players.length === 0 && <Empty illo="crowd" title="No players yet" text="Add players first, then group them into a crew." />}
          {players.map(p => (
            <PickRow key={p.id} on={sel.includes(p.id)} onClick={() => toggle(p.id)} lead={<Avatar id={p.id} name={p.name} />}
              title={playerLabel(p, state.me)} sub={p.index == null ? 'No handicap' : `HCP ${formatIndex(p.index)}`} />
          ))}
        </div>
        {existing && <button className="danger-link" onClick={remove}><Icon name="trash" /> Delete crew</button>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!name.trim() || sel.length < 2} onClick={save}>
          {sel.length < 2 ? 'Pick at least 2 players' : existing ? 'Save crew' : 'Create crew'}
        </button>
      </div>
    </Screen>
  );
}
