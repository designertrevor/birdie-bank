// The art manifest: every kind of drawing in the app, its box, and where each one shows. The art
// sheet (?art) reads it to label each drawing, and src/art/README.md repeats it for whoever makes
// the outside set. Pure data, so a test can hold it against the drawings in the components.

/** The kinds, in sheet order. `box` is the drawing's units; files go in src/art/<id>/. */
export const ART_KINDS = [
  { id: 'scenes', name: 'Scenes', box: '400 by 240', note: 'Full bleed across the top of a screen. The app crops from the sky down to fit, so keep the ground and the people inside the middle 290 units (x 56 to 344). Add <id>.dark.svg for dusk in the dark theme; without it the day drawing shows in both.' },
  { id: 'spots', name: 'Spot illustrations', box: '120 by 120', note: 'The smiley ball with one prop, for empty states, callouts and small moments. No backdrop: it sits on a white or dark card. Give it its own soft blob of colour if it needs one (the hand-drawn ones get a plate from the app, which a file replaces).' },
  { id: 'games', name: 'Game art', box: '64 by 64', note: 'One sticker per game. The app draws the rounded backdrop in the group colour (Classics ochre, Head to head pink, Team mint, Full round lavender, Points peach); draw only what sits on it, with room at the edges.' },
  { id: 'buddies', name: 'Ball buddies', box: '64 by 64', note: 'The golf ball in a hat, each with its own face. The app draws the backdrop colour and clips to a circle, so keep the hat inside the circle.' },
  { id: 'critters', name: 'Critters', box: '64 by 64', note: 'Golf in-jokes in the same palette, on the backdrop without the ball. Birdie and eagle also pop up on scores, so they must read at 28px.' },
  { id: 'icons', name: 'Icons used as art', box: '24 by 24 (the ball 150 by 150)', note: 'Phosphor glyphs standing in for drawings: the game tags on the welcome, and the first ball on a tee from before the buddies.' },
];

/** Each scene and spot: its name, where it shows (and how big), for the sheet. */
export const ART_USES = {
  'scenes/course': { name: 'The first tee', used: ['Welcome, the hero (pulled 2026-10-07)', 'Set up: What does your group play? and How many of you usually play? (pulled)'], px: 'full width, 176px tall on the questions, up to 320px on the welcome' },
  'scenes/clubhouse': { name: 'The 19th hole', used: ['Set up: How do you settle up now? and Who ends up doing the math? (pulled 2026-10-07)'], px: 'full width, 176px tall' },
  'scenes/roadtrip': { name: 'The road trip', used: ['Trip screen, before the first round is played'], px: 'full width, 150px tall' },

  'spots/tee': { name: 'Ball on a tee', used: ['Up next, peeking from the Start a round card (92px)', 'Set up, the games question (84px)', 'The notifications ask (30px)'] },
  'spots/megaphone': { name: 'Feedback', used: ['Round menu, the feedback row (52px)'] },
  'spots/bulb': { name: 'An idea', used: ['Suggest something (120px)', 'Settings, the Help shape Birdie Bank callout (68px)', 'Roadmap, nothing in progress (96px)'] },
  'spots/link': { name: 'Invite link', used: ['Join invite, the link step (120px)', 'Round ready, the Let the group watch live callout (68px)'] },
  'spots/crown': { name: 'Winner', used: ['Not placed yet (results crown the winner’s own buddy)'] },
  'spots/cup': { name: 'Trophy', used: ['Hall of fame with no champion yet (110px)', 'Hall of fame and Season empty states (150px)'] },
  'spots/sleep': { name: 'Nothing yet', used: ['Friends, Lately, Season, What’s new and Roadmap empty states (96 to 150px)'] },
  'spots/suitcase': { name: 'Golf trip', used: ['Up next, the Start a trip tile (64px)', 'A trip that’s gone and Nobody packed yet (150px)'] },
  'spots/wallet': { name: 'Empty wallet', used: ['The Tab with nothing owed (150px)', 'Set up, the settle question (84px)'] },
  'spots/card': { name: 'Blank scorecard', used: ['History and Stats with no rounds (150px)', 'Join invite, the first step (120px)', 'Results of a solo round (120px)', 'Set up, the math question (84px)'] },
  'spots/calendar': { name: 'Plan ahead', used: ['Up next, the Plan ahead tile (64px)', 'A plan that’s gone (150px)'] },
  'spots/bell': { name: 'Heads-up', used: ['Not placed yet'] },
  'spots/face-great': { name: 'Face: great', used: ['Results, How was it? (52px)', 'Set up, the games payoff (84px)'] },
  'spots/face-ok': { name: 'Face: just OK', used: ['Results, How was it? (52px)', 'Set up, the settle payoff when nobody settles (84px)'] },
  'spots/face-off': { name: 'Face: something was off', used: ['Results, How was it? (52px)'] },
  'spots/gift': { name: 'It shipped', used: ['What’s new, the hero (104px)', 'Up next, the It shipped card (56px)'] },
  'spots/shades': { name: 'Keeping it private', used: ['Join invite, the private step (140px)', 'Set up, the So you’re the bank payoff (84px)'] },
  'spots/crowd': { name: 'The group', used: ['Round ready, the crew on the tee (220px)', 'Results hero for a tie (128px)', 'Up next, the Big Game tile (64px)', 'Friends row (40px) and recap bubbles (34px)', 'Players with nobody yet (150px)', 'Set up, the group size question (84px)'], note: 'Hand-drawn from the group’s own buddies; a file shows one picture for every group.' },
  'spots/highfive': { name: 'High five', used: ['Results hero when all square (128px)', 'First tee card when the bets lock (84px)', 'The Tab when all square (150px)', 'Set up, the settle payoff (84px)'], note: 'Hand-drawn from the two players’ buddies; a file shows one picture for everyone.' },
};

/** The icons drawn as art: the welcome's game tags (Phosphor names) and the first ball. */
export const ART_ICONS = [
  { id: 'ball', name: 'The first ball on a tee', used: ['Join invite, Plan, Draft and Challenge link screens while they load or fail (180px)'] },
  { id: 'bank', name: 'Banker tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'flag-pennant', name: 'Nassau tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'coins', name: 'Skins tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'paw-print', name: 'Wolf tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'dice-five', name: 'Vegas tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'sword', name: 'Match play tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'star', name: 'Stableford tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'dots-three-circle', name: 'More games tag', used: ['Welcome, the game tags (13px)'] },
];

/** The palette every drawing uses, for the sheet and the README. */
export const PALETTE = [
  ['Ink', '#0a0a0a'], ['Ball', '#fbf7ec'], ['Pink', '#ff4d8b'], ['Deep pink', '#d42a6b'], ['Ochre', '#e8b94a'], ['Gold', '#c99a30'],
  ['Coin', '#ffd45c'], ['Teal', '#1a3a3a'], ['Mint', '#a4d4c5'], ['Coral', '#ff6b5a'], ['Lavender', '#b8a4ed'], ['Peach', '#ffb084'], ['Blush', '#ffd6e5'],
];
