// The Good Dog trial's drawing names and which one stands in for each game and spot. The drawings
// themselves are in gd-art-data.js, a chunk of their own that only the trial loads (GdArt.jsx).
// Each drawing's box, width by height
export const GD_BOXES = {
  bag: [220, 170],
  cup: [220, 170],
  receipt: [220, 170],
  calendar: [220, 170],
  flag: [220, 170],
  cart: [260, 180],
  banker: [64, 64],
  wolf: [64, 64],
  nassau: [64, 64],
  skins: [64, 64],
  match: [64, 64],
  hammer: [64, 64],
  bestball: [64, 64],
  scramble: [64, 64],
  vegas: [64, 64],
  stableford: [64, 64],
  stroke: [64, 64],
  roll: [168, 64],
};
// Games without a drawing of their own borrow the nearest one
const GAME_FALLBACK = { sixes: 'vegas', shamble: 'scramble', altshot: 'bestball', chapman: 'bestball', quota: 'stableford', nines: 'skins', aces: 'match', bbb: 'stableford', dots: 'stableford', rabbit: 'skins', snake: 'hammer' };
export const gdGameArt = game => (GD_BOXES[game] ? game : GAME_FALLBACK[game] || 'nassau');

// Spots (Spot.jsx) take the nearest drawing; anything else gets the flag
const SPOT_ART = { calendar: 'calendar', clock: 'calendar', suitcase: 'cart', crowd: 'bag', tee: 'flag', flagempty: 'flag', loneball: 'flag', cup: 'cup', crown: 'cup', podium: 'cup', gift: 'cup', receipt: 'receipt', card: 'receipt', cards: 'receipt', buying: 'receipt', handshake: 'roll', coinstack: 'skins' };
export const gdSpotArt = kind => SPOT_ART[kind] || 'flag';
