// One avatar for every place a person shows: player cards, the Players list, seat tiles, the Tab,
// the reveal and the button that opens Settings. A photo, then a Ball buddy, then initials on a
// pastel. Other people's come from their profile once their seat is linked to their account.
import { useState } from 'react';
import { useStore } from '../lib/store.js';
import { avatarFor, avatarModel, avatarName, backdropOf, personKey, photoAllowed } from '../lib/avatars.js';
import { supabaseUrl } from '../lib/supabase.js';
import { BuddyArt } from './BuddyArt.jsx';

/** The circle for a model from avatarModel(). */
export function AvatarArt({ model, size = '', base = 'avatar', className = '' }) {
  const [brokenUrl, setBrokenUrl] = useState(null);
  // A link from outside the app's own photo bucket is never fetched (see photoAllowed). The picker's
  // preview of a picture picked on this phone is a blob: link this page made, so it can show
  const local = model.preview && /^blob:/.test(String(model.url || ''));
  const broken = model.kind === 'photo' && (brokenUrl === model.url || !(local || photoAllowed(model.url, supabaseUrl)));
  const cls = `${base} ${size} ${className}`.trim();
  if (model.kind === 'photo' && !broken) {
    return <span className={`${cls} av-photo`} aria-hidden="true"><img src={model.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBrokenUrl(model.url)} /></span>;
  }
  if (model.kind === 'buddy') {
    return <span className={`${cls} av-buddy`} aria-hidden="true"><BuddyArt id={model.buddy} bg={model.bg} /></span>;
  }
  // Initials (also a photo that won't load: a link that's gone, or no signal before it was cached)
  const b = backdropOf(model.bg);
  return <span className={`${cls} av-initials`} style={{ background: b.hex, color: b.ink }} aria-hidden="true">{model.text || '?'}</span>;
}

/**
 * A person's avatar. `id` is any of their player ids (it finds the avatar they picked); `name` gives
 * the initials. `seat` is a round player, for an avatar the round carried. `model` draws a ready
 * model instead (a group where twins were already sorted out, see noTwins).
 */
export function Avatar({ id = null, name = '', size = '', seat = null, model = null, letters = 1, base = 'avatar', className = '' }) {
  const state = useStore();
  const m = model || avatarModel(avatarFor(state, id, seat), { name: avatarName(state, id, name), key: personKey(state, id) || name, letters });
  return <AvatarArt model={m} size={size} base={base} className={className} />;
}
