import { useState } from 'react';
import { BallIllo, Icon, Numpad, Screen } from '../components/ui.jsx';
import { update, uid } from '../lib/store.js';
import { formatIndex } from '../lib/format.js';
import { SignInSheet } from '../components/Account.jsx';
import { accountsEnabled } from '../lib/cloud.js';

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [index, setIndex] = useState(null);
  const [pad, setPad] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const finish = () => {
    update(s => {
      const id = uid('p_');
      s.players[id] = { id, name: name.trim(), index, venmo: '', createdAt: Date.now() };
      s.me = id;
      s.onboarded = true;
    });
  };

  if (step === 0) {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" />
          <h1 className="onboard-title">Birdie Bank</h1>
          <p className="onboard-text">Keep score, run the side games and settle up with your crew, without the napkin math.</p>
          <div className="onboard-games">
            {[['bank', 'Banker'], ['flag-pennant', 'Nassau'], ['coins', 'Skins'], ['paw-print', 'Wolf'], ['dice-five', 'Vegas'], ['sword', 'Match play'], ['star', 'Stableford'], ['dots-three-circle', '+ 9 more']].map(([i, n]) => (
              <span key={n} className="chip ochre"><Icon name={i} fill /> {n}</span>
            ))}
          </div>
        </div>
        <div className="cta-wrap">
          <button className="full-btn" onClick={() => setStep(1)}>Let’s go <Icon name="arrow-right" /></button>
          {accountsEnabled && <button className="full-btn outline" onClick={() => setSigningIn(true)}>I already have an account</button>}
        </div>
        {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} title="Welcome back" text="Sign in and your rounds, players and tab come right back." />}
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body" style={{ textAlign: 'left', alignItems: 'stretch' }}>
          <div className="onboard-badge"><Icon name="handshake" fill /></div>
          <h1 className="onboard-title" style={{ fontSize: 34 }}>Friendly wagers only</h1>
          <p className="onboard-text" style={{ textAlign: 'left' }}>Birdie Bank tracks bets between friends. It never holds, sends or collects money. You settle up yourselves.</p>
          <ul className="onboard-list">
            <li><Icon name="device-mobile" fill /> Everything is saved on this phone. One person keeps score for the group.</li>
            <li><Icon name="scales" fill /> Handicaps use the World Handicap System, so strokes go to everyone off the best player.</li>
            <li><Icon name="warning-circle" fill /> Check that betting on golf is legal where you play.</li>
          </ul>
        </div>
        <div className="cta-wrap">
          <button className="full-btn" onClick={() => setStep(2)}>I understand <Icon name="arrow-right" /></button>
          <button className="full-btn outline" onClick={() => setStep(0)}>Back</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="onboard">
      <div className="scroll onboard-body" style={{ textAlign: 'left', alignItems: 'stretch' }}>
        <h1 className="onboard-title" style={{ fontSize: 34 }}>Who’s keeping score?</h1>
        <p className="onboard-text" style={{ textAlign: 'left' }}>That’s you. Add your name and handicap. You can change these any time.</p>
        <label className="field-label" htmlFor="ob-name">Your name</label>
        <input id="ob-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Trevor" autoComplete="given-name" maxLength={24} />
        <label className="field-label">Handicap index <span className="opt">optional</span></label>
        <button className="amt-btn field-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
        <p className="field-help">Your usual 18-hole index. It’s halved automatically for 9-hole games. No handicap? Leave it blank and everyone plays straight up.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!name.trim()} onClick={finish}>Start playing <Icon name="golf" fill /></button>
        <button className="full-btn outline" onClick={() => setStep(1)}>Back</button>
      </div>
      <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </Screen>
  );
}
