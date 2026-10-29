// Who can see your profile: one setting for all of it (Everyone, People you've played with, Only
// you), and Show my money on top (off with a reason while it's only you). On your profile and in Settings, the
// same block in both (profile-view.js has the words, profile-model.js the rules).
import { PickRow, Toggle } from './ui.jsx';
import { setProfilePrivacy, setShowMoney, useMyProfile } from '../lib/profiles.js';
import { PROFILE_CHOICES, moneyHelp, profileHelp } from '../lib/profile-view.js';

export function ProfilePrivacy({ id = 'pp' }) {
  const { privacy } = useMyProfile();
  return (
    <>
      <div className="block">
        <div className="eyebrow" id={`${id}-who`} style={{ marginBottom: 10 }}>Who can see your profile</div>
        {/* Three long choices read best as a list of selectable rows, each on one line */}
        <div className="pp-choices" role="radiogroup" aria-labelledby={`${id}-who`}>
          {PROFILE_CHOICES.map(c => (
            <PickRow key={c.value} radio on={privacy.profile === c.value} onClick={() => setProfilePrivacy(c.value)} title={c.label} />
          ))}
        </div>
        <details className="how"><summary>How this works</summary><p>{profileHelp(privacy)}</p></details>
      </div>
      {/* Only you: the card stays, switched off with a line saying why, so the page doesn't jump (more-18) */}
      <div className="toggle-row">
        <div>
          <div className="toggle-lbl" id={`${id}-money`}>Show my money</div>
          <div className="toggle-sub" id={`${id}-money-sub`}>{privacy.profile === 'hidden' ? 'Hidden while your profile is Only you.' : moneyHelp(privacy)}</div>
          {privacy.profile !== 'hidden' && <details className="how"><summary>And the Tab?</summary><p>What you owe each other always shows on the Tab, to the two of you.</p></details>}
        </div>
        <Toggle on={privacy.profile !== 'hidden' && privacy.showMoney} disabled={privacy.profile === 'hidden'} onChange={setShowMoney} labelledBy={`${id}-money`} describedBy={`${id}-money-sub`} />
      </div>
    </>
  );
}
