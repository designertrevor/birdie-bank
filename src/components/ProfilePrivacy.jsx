// Who can see your profile: one setting for all of it (Everyone, People you've played with, Only
// you), and Show my money on top while it isn't only you. On your profile and in Settings, the
// same block in both (profile-view.js has the words, profile-model.js the rules).
import { Segmented, Toggle } from './ui.jsx';
import { setProfilePrivacy, setShowMoney, useMyProfile } from '../lib/profiles.js';
import { PROFILE_CHOICES, moneyHelp, profileHelp } from '../lib/profile-view.js';

export function ProfilePrivacy({ id = 'pp' }) {
  const { privacy } = useMyProfile();
  return (
    <>
      <div className="block">
        <div className="eyebrow" id={`${id}-who`} style={{ marginBottom: 10 }}>Who can see your profile</div>
        <Segmented label="Who can see your profile" className="press-mode-row ft-seg pf-money-seg" btn="pm-btn" value={privacy.profile}
          onChange={setProfilePrivacy} options={PROFILE_CHOICES} />
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
