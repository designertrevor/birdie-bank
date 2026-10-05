// Who can see your profile: one setting for all of it (Everyone, People you've played with, Only
// you), and Show my money on top while it isn't only you. On your profile and in Settings, the
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
        <p className="field-help">{profileHelp(privacy)}</p>
      </div>
      {privacy.profile !== 'hidden' && (
        <div className="toggle-row">
          <div>
            <div className="toggle-lbl" id={`${id}-money`}>Show my money</div>
            <div className="toggle-sub" id={`${id}-money-sub`}>{moneyHelp(privacy)} What you owe each other always shows on the Tab, to the two of you.</div>
          </div>
          <Toggle on={privacy.showMoney} onChange={setShowMoney} labelledBy={`${id}-money`} describedBy={`${id}-money-sub`} />
        </div>
      )}
    </>
  );
}
