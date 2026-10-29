// The art manifest: every kind of drawing in the app, its box, and where each one shows. The art
// sheet (?art) reads it to label each drawing, and src/art/README.md repeats it for whoever makes
// the outside set. Pure data, so a test can hold it against the drawings in the components.

/** The kinds, in sheet order. `box` is the drawing's units; files go in src/art/<id>/. */
export const ART_KINDS = [
  { id: 'scenes', name: 'Scenes', box: '400 by 240', note: 'Full bleed across the top of a screen. The app crops from the sky down to fit, so keep the ground and the people inside the middle 290 units (x 56 to 344). The sky is cut out: the app adds the white sticker border round the silhouette in both themes.' },
  { id: 'spots', name: 'Spot illustrations', box: '120 by 120', note: 'The smiley ball with one prop, for empty states, callouts and small moments. No backdrop and no blob of colour: it sits on a white or dark card as a die-cut sticker, the app adding the white border round its silhouette.' },
  { id: 'games', name: 'Game art', box: '64 by 64', note: 'One sticker per game, on the page with no colour plate behind it: the app adds the white border round its silhouette. Leave room at the edges for that border.' },
  { id: 'buddies', name: 'Ball buddies', box: '64 by 64', note: 'The golf ball in a hat, each with its own face. The app draws the backdrop colour the player picked and clips to a circle, so keep the hat inside the circle. An ink outline goes round the whole head, the glasses and every hat, so nothing melts into a backdrop or the white page.' },
  { id: 'critters', name: 'Critters', box: '64 by 64', note: 'Golf in-jokes in the same palette, with the buddies’ ink outline, on the backdrop as an avatar. Birdie and eagle also pop up on scores as stickers with no backdrop, so they must read at 28px.' },
  { id: 'icons', name: 'Icons used as art', box: '24 by 24 (the ball 150 by 150)', note: 'Phosphor glyphs standing in for drawings: the game tags on the welcome, and the first ball on a tee from before the buddies.' },
];

/** Each scene and spot: its name, where it shows (and how big), for the sheet. */
export const ART_USES = {
  'scenes/course': { name: 'The first tee', used: ['Welcome, the hero'], px: 'whole, 16px in from each side, 200 to 330px tall; faces filled cream (2026-10-28), so no card behind it in dark' },
  'scenes/clubhouse': { name: 'The 19th hole', used: ['Set up: How do you settle up now?'], px: 'whole, 16px in from each side (about 358 by 205); faces filled cream, no card in dark' },
  'scenes/scorecard': { name: 'Doing the math', used: ['Set up: Who ends up doing the math?'], px: 'whole, 16px in from each side (about 358 by 205); faces filled cream, no card in dark' },
  'scenes/roadtrip': { name: 'The road trip', used: ['Trip screen, before the first round is played'], px: 'full width, 150px tall' },

  'spots/tee': { name: 'Ball on a tee', used: ['Up next, on the Start a round card when nothing is planned (104px)', 'The notifications ask (30px)'] },
  'spots/megaphone': { name: 'Feedback', used: ['Round menu, the feedback row (52px)'] },
  'spots/bulb': { name: 'An idea', used: ['Suggest something (120px)', 'Settings, the Help shape Birdie Bank callout (68px)', 'Roadmap, nothing in progress (96px)'] },
  'spots/link': { name: 'Invite link', used: ['Join invite, the link step (120px)', 'Round ready, the Let the group watch live callout (68px)', 'Set up, the settle payoff for a payment app (136px)'] },
  'spots/crown': { name: 'Winner', used: ['Results, the reveal when there’s no face to crown, more than four level on top (88px)'] },
  'spots/cup': { name: 'Trophy', used: ['Hall of fame with no champion yet (96px)', 'The paywall’s head, where the pink star was (112px)'] },
  'spots/sleep': { name: 'Nothing yet', used: ['Season, What’s new, Roadmap and Your plan empty states (88 to 150px)', 'The digest when it’s not yours (150px)'] },
  'spots/suitcase': { name: 'Golf trip', used: ['Up next, the Start a trip card (56px)', 'A trip that’s gone and Nobody packed yet (150px)'] },
  'spots/wallet': { name: 'Empty wallet', used: ['Set up, the settle payoff for cash (136px)'] },
  'spots/card': { name: 'Blank scorecard', used: ['History and Stats with no rounds (150px)', 'Join invite, the first step (120px)', 'Results of a solo round (120px)', 'Set up, the math payoff unless it’s you every time (136px)'] },
  'spots/calendar': { name: 'Plan ahead', used: ['Up next, the Get a round going card (76px)', 'A plan that’s gone (150px)'] },
  'spots/bell': { name: 'Heads-up', used: ['Lately with nothing in it (150px)'] },
  'spots/face-great': { name: 'Face: great', used: ['Results, How was it? (52px)'] },
  'spots/face-ok': { name: 'Face: just OK', used: ['Results, How was it? (52px)', 'Set up, the settle payoff when nobody settles (136px)'] },
  'spots/face-off': { name: 'Face: something was off', used: ['Results, How was it? (52px)'] },
  'spots/gift': { name: 'It shipped', used: ['What’s new, the hero (104px)', 'Up next, the It shipped card (56px)'] },
  'spots/shades': { name: 'Keeping it private', used: ['Join invite, the private step (140px)', 'Set up, the games payoff, Good taste (136px)'] },
  'spots/crowd': { name: 'The group', used: ['Round ready, the crew on the tee (220px)', 'Results hero for a tie (128px)', 'Up next, the Big Game card (56px)', 'Friends row (40px) and recap bubbles (34px)', 'Players with nobody yet (150px)', 'Set up, the group size question, as many as you pick (160px)', 'Set up, All set, your group with your buddy first (136px)'], note: 'Hand-drawn from the group’s own buddies; a file shows one picture for every group.' },
  'spots/highfive': { name: 'High five', used: ['First tee card when the bets lock (84px)', 'The Tab when all square (150px)'], note: 'Hand-drawn from the two players’ buddies; a file shows one picture for everyone.' },
  // Landed as outside files on 2026-10-26 (round 4), ahead of the screens that will show them
  'spots/podium': { name: 'Winner', used: ['Results, the winner’s block and the reveal while a Big Game waits on its other groups, the trophy still up for grabs (88px)'] },
  'spots/handshake': { name: 'All square', used: ['Results, the all square hero (120px) and the reveal when it’s all square (88px)', 'A reward round’s card when nobody won (64px)'] },
  'spots/piggy': { name: 'The pot', used: ['Results, the pot (new, not placed yet; the Tab took the calmer coin stack, since the pig is loud pink)'] },
  'spots/receipt': { name: 'The breakdown', used: ['Settle up, over the count of payments (76px)', 'Set up, the settle payoff for a running tab (136px)'] },
  'spots/clipboard': { name: 'The draft board', used: ['The draft, Start the draft (150px)', 'The draft’s head once every pick is in (76px)'] },
  'spots/whistle': { name: 'The captain', used: ['The draft’s head while the captains pick (76px)'] },
  'spots/pennant': { name: 'A team', used: ['Trip, the Cup view with no matches yet (96px)'] },
  'spots/coinflip': { name: 'Who picks first', used: ['The draft’s head before the first pick, who picks first (76px)'] },
  'spots/pin': { name: 'The course', used: ['Course picker, no courses near you (84px)'] },
  'spots/clock': { name: 'Tee times', used: ['Trip, the schedule before its rounds are planned and get tee times (72px)', 'Plan, the Lock in the day sheet, where the tee time is set (64px)'] },
  'spots/tees': { name: 'The rounds', used: ['Trip, the Rounds view with no rounds yet (96px)'] },
  'spots/tumbleweed': { name: 'Nothing here', used: ['Friends, the feed when nobody’s out playing (150px)'] },
  'spots/frame': { name: 'No photo yet', used: ['Your avatar, the Photo tab before there’s a photo (112px)'] },
  'spots/flagempty': { name: 'An empty green', used: ['Course picker, Can’t find it? when a search finds nothing (84px)'] },
  'spots/loneball': { name: 'A lone ball', used: ['Gone and not-found screens: a crew, a round, a challenge, a Big Game, Print, Share and Recently deleted (150px)'] },
  'spots/standings': { name: 'Trip standings', used: ['Trip, the Standings view before a round is finished (96px)'] },
  'spots/expenses': { name: 'Trip expenses', used: ['Trip, the Expenses view with nothing logged (96px)'] },
  'spots/bragging': { name: 'Bragging rights', used: ['Results of a points round, Bragging rights (96px)'] },
  'spots/buying': { name: 'Who is buying', used: ['A reward round’s card, who’s buying (64px)'] },
  'spots/agreed': { name: 'As agreed', used: ['Not placed yet (Round ready’s What we agreed is the setup builder’s)'] },
  'spots/hotstreak': { name: 'Hot streak', used: ['Hall of fame, the Longest win streak badge (48px)'] },
  'spots/skinsking': { name: 'Skins king', used: ['Hall of fame, the Most skins in a round badge (48px)', 'Set up, the So you’re the bank payoff (136px)'] },
  'spots/lowround': { name: 'Low round', used: ['Hall of fame, the Low round badge (48px)'] },
  'spots/nobirdies': { name: 'No net birdies', used: ['Results, the Birdie pot when nobody made a net birdie (96px)'] },
  'spots/mostrounds': { name: 'Most rounds', used: ['Hall of fame, the Most rounds badge (48px; redrawn 2026-10-28 as a ball and a tally of five)'] },
  'spots/coinstack': { name: 'The pot, as coins', used: ['The Tab with nothing owed yet (150px)'] },
  'spots/cards': { name: 'A hand of cards', used: ['Set up, the Add a side game sheet (88px)', 'Set up, the games question (160px)'] },
  'spots/ribbons': { name: 'The record book', used: ['Hall of fame with no rounds yet (150px)'] },
  'spots/punchcard': { name: 'A punch card', used: ['Season, before the rounds it needs (150px)'] },
  'spots/goldcrown': { name: 'The winner’s crown', used: ['On the winner’s buddy: the results podium and crowned face (35 to 45px wide), the reveal and its race rows (21px), Hall of fame’s champion; the results image draws the same crown from its paths in Podium.jsx'] },
};

/** The icons drawn as art: the welcome's game tags (Phosphor names) and the first ball. */
export const ART_ICONS = [
  { id: 'ball', name: 'The first ball on a tee', used: ['Join invite, Plan, Draft and Challenge link screens while they load or fail (180px); since 2026-10-28 its file is the round 4 ball on a tee (a copy of spots/tee.svg), not the old glossy ball'] },
  { id: 'bank', name: 'Banker tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'flag-pennant', name: 'Nassau tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'coins', name: 'Skins tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'paw-print', name: 'Wolf tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'dice-five', name: 'Vegas tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'sword', name: 'Match play tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'star', name: 'Stableford tag', used: ['Welcome, the game tags (13px)'] },
  { id: 'dots-three-circle', name: 'More games tag', used: ['Welcome, the game tags (13px)'] },
];

/** The palette every drawing uses, for the sheet and the README (the values live in art-palette.js). */
export { PALETTE } from './art-palette.js';
