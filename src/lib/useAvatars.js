// Avatars for a group shown together (a round's seats, the reveal, who's square), with twins sorted
// out (see noTwins in avatars.js). Returns a Map from player id to the model to draw.
import { useMemo } from 'react';
import { useStore } from './store.js';
import { avatarFor, avatarModel, noTwins, personKey } from './avatars.js';

/** `players`: [{ id, name, avatar? }] in the order they show (a round player can carry an avatar). */
export function useGroupAvatars(players) {
  const state = useStore();
  return useMemo(() => {
    const list = (players || []).filter(p => p?.id);
    const models = noTwins(list.map(p => avatarModel(avatarFor(state, p.id, p), { name: p.name, key: personKey(state, p.id) })));
    return new Map(list.map((p, i) => [p.id, models[i]]));
  }, [state, players]);
}
