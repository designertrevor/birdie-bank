// Your profile: your avatar, name, handicap, home course and payment app, your stats, and who sees
// what. Opened from Settings (behind your avatar on every main tab) and from your row on Players.
// It all works on this phone first; people you've played with see it once your account has it.
import { useMemo, useState } from 'react';
import { Header, Icon, Numpad, Screen, Segmented, Toggle, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { AvatarPicker } from '../components/AvatarPicker.jsx';
import { HomeCourseSheet } from '../components/HomeCourseSheet.jsx';
import { update, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { formatIndex } from '../lib/format.js';
import { PAY_APPS, PAY_APP_IDS, handleText, payInfo } from '../lib/pay.js';
import { savePlayerCard } from '../lib/player-save.js';
import { avatarLabel } from '../lib/avatars.js';
import { refreshProfiles, setHomeCourse, setPrivacy, useMyProfile, useMyStats, useProfileServer } from '../lib/profiles.js';
import { MONEY_CHOICES, PRIVACY_ROWS, moneyHelp, privacySummary, profileSubline, sinceText, statTiles } from '../lib/profile-view.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import { money } from '../lib/golf.js';
import { bestOf, bestText, deepStats, pressText, skinsText, winRate } from '../lib/deep-stats.js';

/** Where your profile is, in one quiet line under your name. */
function whereLine(user, server) {
  if (!accountsEnabled) return 'Saved on this phone';
  if (!user) return 'Only on this phone until you sign in';
  if (server === 'ready') return 'People you’ve played with see this';
  if (server === 'offline') return 'Saved. It goes to your account when you’re back online';
  return 'Saved to your account. People you’ve played with see it soon';
}

export default function Profile() {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const state = useStore();
  const acct = useAccount();
  const server = useProfileServer();
  const me = useMyProfile();
  const stats = useMyStats();
  const card = state.players[state.me];
  const [name, setName] = useState(card?.name || '');
  const [index, setIndex] = useState(card?.index ?? null);
  const [payApp, setPayApp] = useState(payInfo(card)?.app || null);
  const [handle, setHandle] = useState(() => { const i = payInfo(card); return i ? handleText(i) : ''; });
  const [pad, setPad] = useState(false);
  const [picking, setPicking] = useState(false);
  const [home, setHome] = useState(false);
  // The deeper stats, all time, from your rounds on this phone (only you see them)
  const deep = useMemo(() => deepStats(state), [state]);

  if (!card) {
    return (
      <Screen>
        <Header title="Your profile" onBack={nav.pop} />
        <div className="scroll"><p className="hint-card"><Icon name="user-circle" fill /> Finish setting up first, then your profile lives here.</p></div>
      </Screen>
    );
  }

  const trimmed = name.trim();
  const duplicate = Object.values(state.players).some(p => p.id !== card.id && !p.mergedInto && p.name.toLowerCase() === trimmed.toLowerCase());
  const was = payInfo(card);
  const dirty = trimmed !== card.name || (index ?? null) !== (card.index ?? null) || (payApp || null) !== (was?.app || null) || (payApp && handle.trim() !== (was ? handleText(was) : ''));
  const save = () => {
    update(s => savePlayerCard(s, card.id, { name: trimmed, index, payApp, handle }));
    // Your name, handicap and payment app are on your account's profile too: send them now, not
    // at the next five-minute check (quiet when signed out, offline or before the SQL is run)
    refreshProfiles();
    showToast('Profile saved');
  };
  // Back with changes not saved: ask, rather than lose them or save a half-typed name
  const back = async () => {
    if (dirty && !(await ask({ title: 'Discard changes?', text: 'Your name, handicap and payment app go back to what’s saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    nav.pop();
  };
  const pickHome = c => {
    setHome(false);
    setHomeCourse(c);
    showToast(c ? `${c.name} is your home course` : 'Home course taken off');
  };

  const tiles = statTiles(stats, { mine: true, privacy: me.privacy });
  const since = sinceText(stats.since);
  const moneyLevel = me.privacy.money;

  return (
    <Screen>
      <Header title="Your profile" onBack={back} />
      <div className="scroll">
        <div className="profile-hero">
          <button className="pf-avatar" onClick={() => setPicking(true)} aria-label={`Your avatar: ${avatarLabel(me.avatar)}. Change it`}>
            <Avatar id={state.me} name={card.name} size="xl" letters={2} />
            <span className="pf-edit" aria-hidden="true"><Icon name="pencil-simple" fill /></span>
          </button>
          <div className="pf-name d">{card.name}</div>
          <div className="ph-sub">{profileSubline({ index: card.index, homeCourse: me.homeCourse }, formatIndex)}</div>
          <div className="pf-where"><Icon name={acct.user && server === 'ready' ? 'users-three' : 'device-mobile'} /> {whereLine(acct.user, server)}</div>
        </div>

        {stats.rounds > 0 ? (
          <>
            <div className="pf-tiles">
              {tiles.map(t => (
                <div key={t.key} className={`pf-tile ${t.key === 'net' || t.key === 'best' ? 'money' : ''}`}>
                  <div className="eyebrow">{t.label}</div>
                  <div className={`pf-v d ${t.tone || ''}`}>{t.value}</div>
                  {t.onlyYou ? <div className="pf-only"><Icon name="lock-simple" fill /> Only you</div> : t.sub ? <div className="st-s">{t.sub}</div> : null}
                </div>
              ))}
            </div>
            {since && <p className="field-help pad">{since} · {stats.friends} {stats.friends === 1 ? 'person' : 'people'} played with</p>}
            {deep.rounds > 0 && (
              <>
                <div className="sec-label">More stats</div>
                <div className="block kv-block pf-more">
                  <div className="kv-row"><span className="kv-k">Best game</span><span className="kv-v">{bestText(bestOf(deep.games), money)}</span></div>
                  <div className="kv-row"><span className="kv-k">Best course</span><span className="kv-v">{bestText(bestOf(deep.courses), money)}</span></div>
                  {deep.presses.rounds > 0 && <div className="kv-row"><span className="kv-k">Your presses</span><span className="kv-v">{pressText(deep.presses.made)}{winRate(deep.presses.made) == null ? '' : ` · ${winRate(deep.presses.made)}%`}</span></div>}
                  {deep.skins.rounds > 0 && <div className="kv-row"><span className="kv-k">Skins won</span><span className="kv-v">{skinsText(deep.skins.won)}</span></div>}
                  <button className="pf-home stats-open" onClick={() => nav.push('stats', { range: { kind: 'all' } })}>
                    <Icon name="chart-bar" fill />
                    <span className="row-main"><b>See all your stats</b><span>By game and course, presses, skins and biggest wins. Only you see them.</span></span>
                    <Icon name="caret-right" />
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="hint-card"><Icon name="flag-pennant" fill /> Your rounds, record and favorite game show up here after your first round.</p>
        )}

        <div className="sec-label">Your details</div>
        <div className="block">
          <label className="field-label" htmlFor="pf-name">Name</label>
          <input id="pf-name" className="name-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Your name" />
          {duplicate && <p className="field-error">Someone you play with has that name. Add an initial so scorecards stay clear.</p>}
          <label className="field-label">Handicap index <span className="opt">optional</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="amt-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
            {index != null && <button className="header-btn" onClick={() => setIndex(null)}>Clear</button>}
          </div>
          <div className="field-label" id="pf-home">Home course <span className="opt">optional</span></div>
          <button className="pf-home" aria-labelledby="pf-home" aria-describedby="pf-home-v" onClick={() => setHome(true)}>
            <Icon name="flag-pennant" fill />
            <span id="pf-home-v" className="row-main">{me.homeCourse ? <><b>{me.homeCourse.name}</b>{me.homeCourse.place ? <span>{me.homeCourse.place}</span> : null}</> : <span>Pick where you usually play</span>}</span>
            <Icon name="caret-right" />
          </button>
          <div className="field-label" id="pf-pay">How you get paid <span className="opt">optional</span></div>
          <div className="chip-row flush" role="group" aria-labelledby="pf-pay">
            {PAY_APP_IDS.map(app => (
              <button key={app} type="button" className={`pill-btn ${payApp === app ? 'on' : ''}`} aria-pressed={payApp === app}
                onClick={() => setPayApp(payApp === app ? null : app)}>{PAY_APPS[app].name}</button>
            ))}
          </div>
          {payApp && (
            <>
              <label className="sr-only" htmlFor="pf-handle">{PAY_APPS[payApp].label}</label>
              <input id="pf-handle" className="text-input" value={handle} onChange={e => setHandle(e.target.value)} placeholder={PAY_APPS[payApp].placeholder}
                autoCapitalize="none" autoCorrect="off" inputMode={payApp === 'zelle' ? 'email' : 'text'} />
            </>
          )}
          <p className="field-help">{payApp === 'zelle' ? 'Zelle has no pay link, so anyone who owes you sees this with a copy button.' : 'So people can pay you in one tap. The app never holds or moves money.'}</p>
        </div>

        <div className="sec-label">Privacy</div>
        <div className="block">
          <div className="eyebrow" id="pf-money" style={{ marginBottom: 10 }}>Who sees your money</div>
          <Segmented label="Who sees your money" className="press-mode-row ft-seg pf-money-seg" btn="pm-btn" value={moneyLevel} onChange={v => setPrivacy('money', v)}
            options={MONEY_CHOICES} />
          <p className="field-help">{moneyHelp(me.privacy)} What you owe each other always shows on the Tab, to the two of you.</p>
        </div>
        {PRIVACY_ROWS.filter(r => r.key !== 'money').map(r => (
          <div key={r.key} className="toggle-row">
            <div>
              <div className="toggle-lbl" id={`pf-p-${r.key}`}>Show {r.title.toLowerCase()}</div>
              <div className="toggle-sub" id={`pf-ps-${r.key}`}>{r.help} {me.privacy[r.key] === 'played' ? 'People you’ve played with see it.' : 'Only you see it.'}</div>
            </div>
            <Toggle on={me.privacy[r.key] === 'played'} onChange={on => setPrivacy(r.key, on ? 'played' : 'hidden')} labelledBy={`pf-p-${r.key}`} describedBy={`pf-ps-${r.key}`} />
          </div>
        ))}
        <p className="field-help pad">{privacySummary(me.privacy)} Your own phone always shows you everything.</p>
      </div>
      {dirty && (
        <div className="cta-wrap">
          <button className="full-btn" disabled={!trimmed || duplicate} onClick={save}>Save changes</button>
        </div>
      )}
      <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
      <AvatarPicker open={picking} onClose={() => setPicking(false)} />
      <HomeCourseSheet open={home} current={me.homeCourse} onPick={pickHome} onClose={() => setHome(false)} />
    </Screen>
  );
}
