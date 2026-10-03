// Picking your avatar: a Ball buddy or a critter on a backdrop (two shelves), a photo, or your
// initials on a color. Opened from
// your profile. Every path ends on the same save, and friends see it on seats, the Tab and results.
import { useEffect, useRef, useState } from 'react';
import { Icon, Segmented, Sheet, useUI } from './ui.jsx';
import { AvatarArt } from './Avatar.jsx';
import { BuddyArt } from './BuddyArt.jsx';
import { BACKDROPS, BUDDIES, SHELVES, avatarModel, buddyAvatar, buddyOf, initialsAvatar, initialsOf, shelfOf } from '../lib/avatars.js';
import { removePhoto, setAvatar, uploadPhoto, useMyProfile } from '../lib/profiles.js';
import { useAccount } from '../lib/cloud.js';

const BACKDROP_NAMES = { mint: 'Mint', peach: 'Peach', lav: 'Lavender', ochre: 'Gold', pink: 'Pink', coral: 'Coral', blush: 'Blush', teal: 'Teal' };

/** The backdrop colors as a row of swatches. */
function Backdrops({ value, onChange, label }) {
  return (
    <div className="av-swatches" role="radiogroup" aria-label={label}>
      {BACKDROPS.map(b => (
        <button key={b.id} type="button" role="radio" aria-checked={value === b.id} aria-label={BACKDROP_NAMES[b.id]}
          className={`av-swatch ${value === b.id ? 'on' : ''}`} style={{ background: b.hex }} onClick={() => onChange(b.id)} />
      ))}
    </div>
  );
}

function PickerBody({ onClose }) {
  const { showToast } = useUI();
  const acct = useAccount();
  const me = useMyProfile();
  const cur = me.avatar;
  const [tab, setTab] = useState(cur?.kind === 'photo' ? 'photo' : cur?.kind === 'initials' ? 'initials' : 'buddy');
  // The buddy and the initials keep their own picks while you flip between tabs
  const [buddy, setBuddy] = useState(() => (cur?.kind === 'buddy' && buddyOf(cur.id) ? buddyAvatar(cur.id, cur.bg) : buddyAvatar(BUDDIES[0].id)));
  const [bgTouched, setBgTouched] = useState(cur?.kind === 'buddy');
  // The shelf showing: the one your buddy is on, Ball buddies to start
  const [shelf, setShelf] = useState(() => buddyOf(cur?.kind === 'buddy' ? cur.id : null)?.shelf || SHELVES[0].id);
  const [initials, setInitials] = useState(() => (cur?.kind === 'initials' ? initialsAvatar(cur.bg, cur.letters) : initialsAvatar('lav', 2)));
  const [photo, setPhoto] = useState(null); // { file, url } a picture picked here, not saved yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // The picked picture's preview link is let go when another is picked or the sheet closes
  const shown = useRef(null);
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current); }, []);
  const file = photo?.file || null;

  const name = me.name || 'You';
  const draft = tab === 'buddy' ? buddy : tab === 'initials' ? initials : cur?.kind === 'photo' ? cur : null;
  const model = tab === 'photo' && photo
    ? { kind: 'photo', url: photo.url, text: initialsOf(name, 2), bg: 'lav', preview: true }
    : avatarModel(draft, { name, key: me.playerId, letters: 2 });

  const pickBuddy = id => setBuddy(b => buddyAvatar(id, bgTouched ? b.bg : buddyOf(id).bg));
  const pickFile = e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type || '')) { setErr('That file isn’t a picture. Pick a photo instead.'); return; }
    setErr(null);
    if (shown.current) URL.revokeObjectURL(shown.current);
    shown.current = URL.createObjectURL(f);
    setPhoto({ file: f, url: shown.current });
  };

  const save = async () => {
    if (tab === 'photo') {
      if (!file) { onClose(); return; }
      setBusy(true);
      try {
        const res = await uploadPhoto(file);
        showToast(res.where === 'account' ? 'Photo saved' : acct.user ? 'Photo saved. It goes up to your account soon' : 'Photo saved on this phone');
        onClose();
      } catch {
        setErr('Couldn’t use that picture. Try another photo.');
      } finally { setBusy(false); }
      return;
    }
    // Leaving a photo for a buddy or initials takes the photo off your account too (in the background)
    if (cur?.kind === 'photo') removePhoto().catch(() => {});
    setAvatar(tab === 'buddy' ? buddy : initials);
    showToast('Avatar saved');
    onClose();
  };
  const dropPhoto = async () => {
    setBusy(true);
    try { await removePhoto(); setPhoto(null); showToast('Photo removed'); } finally { setBusy(false); }
  };

  const hasPhoto = cur?.kind === 'photo';
  const label = tab === 'photo' ? (file ? 'Use this photo' : 'Done') : 'Save';
  return (
    <>
      <div className="av-preview">
        <AvatarArt model={model} size="xl" />
        <p className="field-help">People you play with see this on seats, the Tab and results.</p>
      </div>
      <div style={{ padding: '0 16px 8px' }}>
        <Segmented label="Kind of avatar" className="press-mode-row" btn="pm-btn" value={tab} onChange={v => { setTab(v); setErr(null); }}
          options={[{ value: 'buddy', label: 'Characters' }, { value: 'photo', label: 'Photo' }, { value: 'initials', label: 'Initials' }]} />
      </div>
      {tab === 'buddy' && (
        <div className="av-pane">
          <div className="chip-row flush av-shelves" role="group" aria-label="Shelf">
            {SHELVES.map(x => (
              <button key={x.id} type="button" className={`pill-btn sm ${shelf === x.id ? 'on' : ''}`} aria-pressed={shelf === x.id} onClick={() => setShelf(x.id)}>
                {x.name}{buddyOf(buddy.id)?.shelf === x.id && shelf !== x.id ? <><span className="av-shelf-dot" aria-hidden="true" /><span className="sr-only">, your pick is here</span></> : null}
              </button>
            ))}
          </div>
          <div className="av-grid" role="radiogroup" aria-label={SHELVES.find(x => x.id === shelf)?.name}>
            {shelfOf(shelf).map(b => {
              const on = buddy.id === b.id;
              return (
                <button key={b.id} type="button" role="radio" aria-checked={on} aria-label={b.name} className={`av-pick ${on ? 'on' : ''}`} onClick={() => pickBuddy(b.id)}>
                  <span className="avatar av-buddy av-tile"><BuddyArt id={b.id} bg={on ? buddy.bg : b.bg} /></span>
                  {on && <span className="av-check" aria-hidden="true"><Icon name="check" /></span>}
                </button>
              );
            })}
          </div>
          <div className="eyebrow av-eyebrow">Backdrop</div>
          <Backdrops label="Backdrop" value={buddy.bg} onChange={bg => { setBgTouched(true); setBuddy(b => ({ ...b, bg })); }} />
        </div>
      )}
      {tab === 'photo' && (
        <div className="av-pane">
          <label className="full-btn outline av-file" htmlFor="av-file"><Icon name="camera" /> {file || hasPhoto ? 'Choose another photo' : 'Choose a photo'}</label>
          <input id="av-file" type="file" accept="image/*" hidden onChange={pickFile} />
          <p className="field-help">Any photo, cropped to the middle square. {acct.user ? 'People you play with see it.' : 'It stays on this phone until you sign in.'}</p>
          {hasPhoto && !file && <button type="button" className="link-btn av-remove" disabled={busy} onClick={dropPhoto}>Remove my photo</button>}
        </div>
      )}
      {tab === 'initials' && (
        <div className="av-pane">
          {/* A one-word name has one initial, so there's nothing to choose */}
          {initialsOf(name, 2) !== initialsOf(name, 1) && (
            <>
              <div className="eyebrow av-eyebrow">Letters</div>
              <Segmented label="Letters" className="press-mode-row" btn="pm-btn" value={initials.letters} onChange={n => setInitials(i => ({ ...i, letters: n }))}
                options={[1, 2].map(n => ({ value: n, label: initialsOf(name, n) }))} />
            </>
          )}
          <div className="eyebrow av-eyebrow">Color</div>
          <Backdrops label="Color" value={initials.bg} onChange={bg => setInitials(i => ({ ...i, bg }))} />
        </div>
      )}
      {err && <p className="field-error" role="alert" style={{ margin: '0 20px 8px' }}>{err}</p>}
      <div className="av-actions">
        <button className="full-btn" disabled={busy || (tab === 'photo' && !file && !hasPhoto)} onClick={save}>{busy ? 'Saving…' : label}</button>
      </div>
    </>
  );
}

/** The avatar picker as a sheet. */
export function AvatarPicker({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Your avatar">
      <PickerBody onClose={onClose} />
    </Sheet>
  );
}
