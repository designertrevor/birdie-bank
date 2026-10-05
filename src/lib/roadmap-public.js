// The public roadmap, made from ROADMAP.md when the app is built (vite.config.js, and
// `node scripts/roadmap-public.mjs` to see it). Trevor's file stays the one list: a checked line is
// Shipped (with its date), a "(partial)" line is In progress, anything else open is Planned.
// Only the parts golfers care about go out: games, rounds, the Tab, trips and the rest of the app.
// Business, legal, marketing, pricing, brand and creator lines never leave the file, and each line
// is cut down to a short friendly title, so working notes (dates, who asked, research) stay private.
// Pure: no browser or Node APIs, so the build, the script and the tests all share it.

/** The areas shown, by their number in ROADMAP.md, with the short name used on the roadmap. */
export const PUBLIC_AREAS = {
  1: 'Accounts',
  2: 'Profiles',
  3: 'Getting started',
  4: 'Joining a round',
  5: 'Games and rounds',
  6: 'Courses',
  7: 'The Tab',
  8: 'History and stats',
  9: 'Friends',
  10: 'Trips and leagues',
  12: 'Notifications',
  13: 'The app',
  17: 'Sharing',
  20: 'Feedback',
  21: 'Between rounds',
};

// A line about any of these stays private, whatever its area
const PRIVATE = /\bPro\b|paywall|free trial|\btrial\b|Stripe|RevenueCat|\bprice|pricing|billing|purchase|legal|creator|Slack|SMTP|Sentry|analytics|admin|branding|\blogo\b|domain|digest|referral|research|polish pass|Needs check|Record Book|\bTest\b|\bDecide\b|Talk to|Squabbit|GameBook|Reddit|GolfWRX|Apple requires|test groups/i;

/**
 * Titles written by hand, by item id, for lines that don't cut down well on their own, with an
 * optional blurb and kind ('game' for the "it shipped" note). null leaves a line off: a repeat of
 * another line, or one that isn't for the public. A line Trevor rewrites past its first seven words
 * gets a new id and falls back to the automatic title, so a stale entry here does no harm.
 */
export const TITLES = {
  'r-data-saved-on-the-phone-with-a': { title: 'Back up your data', blurb: 'One file with everything on your phone, and restore it any time' },
  'r-sign-in-with-apple-google-or-a': { title: 'Sign in with Apple, Google or email', blurb: 'Google and email work now. Apple comes with the App Store app' },
  'r-rounds-crews-and-the-tab-saved-to': { title: 'Your rounds and the Tab on every device' },
  'r-claim-your-seat-a-guest-player-becomes': { title: 'Claim your seat', blurb: 'Play as a guest, sign up later, and your rounds and Tab come with you' },
  'r-move-each-phones-existing-local-data-into': { title: 'Bring your rounds into your account' },
  'r-offline-first-scoring-keeps-working-with-no': { title: 'Scoring with no signal', blurb: 'Scores save on the phone and sync when you’re back in range' },
  'r-delete-your-account-apple-requires-it-built': { title: 'Delete your account' },
  'r-players-have-a-name-handicap-index-and': { title: 'Players with a handicap and how they get paid' },
  'r-your-own-profile-photo-home-course-handicap': { title: 'Your own profile', blurb: 'Photo or avatar, home course, handicap and payment app' },
  'r-player-cards-each-person-shows-your-record': { title: 'Player cards', blurb: 'Your record and honest net with each friend' },
  'r-merge-duplicate-players-same-person-as-someone': { title: 'Merge duplicate players' },
  'r-when-a-player-signs-up-offer-to': { title: 'Signing up links you to your old rounds' },
  'r-profile-foundation-from-trevor-2026-09-30': { title: 'Profiles everyone sees the same', blurb: 'Avatars, photos, home course and privacy on every phone' },
  'r-profile-stats-rounds-net-winnings-record-against': { title: 'Profile stats', blurb: 'Rounds, record against each friend and your favorite game' },
  'r-privacy-settings-with-money-hidden-by-default': { title: 'Privacy, with money hidden by default' },
  'r-avatars-a-library-of-illustrated-avatars-to': { title: 'Ball buddies avatars', blurb: 'Pick an illustrated buddy or use your own photo' },
  'r-three-step-first-run-welcome-the-friendly': { title: 'A quick first run', blurb: 'Your name and handicap, and you’re in' },
  'r-two-paths-the-organizer-setting-up-a': { title: 'Join a round from a link', blurb: 'Pick your name and you’re in' },
  'r-guests-play-without-an-account-then-you': { title: 'Play as a guest, save it later' },
  'r-organizer-onboarding-as-a-series-of-questions': { title: 'Setup that asks about your group' },
  'r-onboarding-ends-with-set-up-your-next': { title: 'Plan your first round from the start' },
  'r-ask-for-notification-permission-at-the-right': { title: 'Notifications asked for at the right time' },
  'r-live-shared-rounds-with-a-code-and': { title: 'Live rounds everyone follows' },
  'r-turn-on-live-sharing-in-production-2026': null,
  'r-join-from-the-web-without-installing-anything': { title: 'Join from the web, no install' },
  'r-joining-from-a-link-starts-on-an': { title: 'An invite card when you join', blurb: 'Who invited you, the game, the bets and who’s in' },
  'r-one-scorekeeper-who-can-hand-off-the': { title: 'One scorekeeper, hand off any time' },
  'r-a-link-preview-card-for-group-texts': { title: 'Link previews in the group text' },
  'r-16-games-with-the-setup-wizard-game': { title: '16 games, crews and bets that change mid-round' },
  'r-rules-check-fixes-every-money-rule-from': { title: 'Every money rule checked and fixed' },
  'r-snake-three-putts-fixed-growing-or-doubling': { title: 'Snake and Hammer', kind: 'game' },
  'r-money-on-screen-from-the-first-hole': { title: 'Money on screen from the first hole' },
  'r-setup-asks-one-question-per-step-puts': { title: 'Setup one question at a time' },
  'r-several-games-at-once-in-one-round': { title: 'Several games in one round', blurb: 'Nassau plus skins plus greenies, one money bar' },
  'r-side-games-on-planned-rounds-the-organizer': { title: 'Side games on planned rounds' },
  'r-change-a-side-games-bet-mid-round': { title: 'Change a side game’s bet mid-round' },
  'r-add-a-side-game-mid-round-add': { title: 'Add a side game mid-round' },
  'r-snake-and-rabbit-as-side-games-up': { title: 'Snake and Rabbit as side games', kind: 'game' },
  'r-our-usual-game-saved-crew-games-and': { title: '“Our usual game” in one tap' },
  'r-usuals-when-planning-ahead-a-saved-usual': { title: 'Usuals when planning ahead' },
  'r-skins-house-rules-net-gross-or-both': { title: 'Skins house rules' },
  'r-nassau-house-rules-press-at-the-turn': { title: 'Nassau house rules' },
  'r-banker-house-rules-low-rotation-lowest-score': { title: 'Banker house rules' },
  'r-round-menu-in-groups-this-hole-games': { title: 'A tidier round menu' },
  'r-more-house-rules-blind-wolf-called-before': { title: 'Blind wolf and the Hogan dot' },
  'r-bragging-rights-mode-play-any-game-for': { title: 'Play for points', blurb: 'Bragging rights only, nothing on the Tab' },
  'r-play-for-a-reward-lunch-a-drink': { title: 'Play for lunch or a drink' },
  'r-only-the-players-in-a-round-and': { title: 'Only the people in a round edit its scores' },
  'r-suggested-handicap-for-each-game-the-whs': { title: 'Suggested handicap % for each game' },
  'r-handicaps-are-a-choice-from-trevors-banker': { title: 'Play with or without handicaps' },
  'r-handicaps-mid-round-handicaps-in-the-round': { title: 'Change handicaps mid-round' },
  'r-every-setup-setting-changeable-once-the-round': { title: 'Change any setting mid-round' },
  'r-faster-banker-bets-trevor-2026-09-30': { title: 'Faster Banker bets' },
  'r-whats-on-the-line-stays-in-view': { title: 'What’s on the line, always in view' },
  'r-new-games-closest-to-the-pin-and': { title: 'Closest to the pin and long drive' },
  'r-new-game-team-best-ball-best-1': { title: 'Team best ball' },
  'r-new-games-alternate-shot-shamble-and-chapman': { title: 'Alternate shot, Shamble and Chapman' },
  'r-new-game-ryder-cup-team-points-across': { title: 'Ryder Cup team points' },
  'r-new-games-field-skins-across-several-groups': { title: 'Field skins, Calcutta and rolling quota' },
  'r-house-rules-for-every-game-the-variations': { title: 'House rules for every game' },
  'r-ending-a-round-is-one-tap-and': { title: 'Ending a round is one tap' },
  'r-the-killer-end-of-round-moment-every': { title: 'The end-of-round reveal', blurb: 'Every bet totals up, then the fewest payments' },
  'r-big-moments-during-a-match-from-trevors': { title: 'Big moments during a match', blurb: 'Lead changes, dormie and match over' },
  'r-moments-for-the-other-games-2026-09': { title: 'Big moments in every game' },
  'r-a-no-pressure-way-in-for-friends': { title: 'Play along with no bet' },
  'r-more-than-one-round-in-progress-starting': { title: 'More than one round at a time' },
  'r-add-a-player-in-the-round-menu': { title: 'Add a player mid-round' },
  'r-adding-a-player-picks-their-games-after': { title: 'Late joiners pick their games' },
  'r-side-bets-between-two-players-inside-a': { title: 'Side bets between two players' },
  'r-any-side-bets-on-this-hole-a': { title: '“Any side bets on this hole?”' },
  'r-several-groups-one-game-the-big-game': { title: 'The Big Game', kind: 'game', blurb: 'Several foursomes, one pot and one leaderboard' },
  'r-allowances-by-format-free-for-everyone-a': { title: 'Handicap allowances by game' },
  'r-half-pops-free-a-stroke-counts-as': { title: 'Half strokes' },
  'r-skins-fairness-options-free-canadian-skins-a': { title: 'Canadian skins and skin validation' },
  'r-first-tee-rules-card-free-strokes-allowances': { title: 'The first-tee rules card', blurb: 'Gimmes, mulligans and presses agreed before hole 1' },
  'r-three-bundled-courses-plus-custom-courses-you': { title: 'Add and edit your own courses' },
  'r-search-every-course-golfcourseapi-pro-was-the': { title: 'Search every course' },
  'r-courses-from-the-database-show-a-soft': { title: 'Course database tags and middle tees' },
  'r-favorite-courses-and-courses-near-you-built': { title: 'Favorite courses and courses near you' },
  'r-fix-a-hole-on-the-spot-the': { title: 'Fix a hole’s par or HCP on the spot' },
  'r-request-this-course-when-a-search-finds': { title: '“Request this course”' },
  'r-share-reviewed-hole-fixes-with-every-group': { title: 'Course fixes shared with every group' },
  'r-debts-netted-across-every-round-recording-payments': { title: 'The Tab: every round netted, payments recorded' },
  'r-settle-up-right-from-the-end-of': { title: 'Settle up at the end of the round' },
  'r-one-shared-tab-for-the-group-both': { title: 'One shared Tab for the group' },
  'r-the-group-can-see-whos-settled-up': { title: 'See who’s settled up' },
  'r-carry-it-over-instead-of-i-paid': { title: 'Carry it over to next time' },
  'r-where-each-amount-comes-from-the-settle': { title: 'Where each amount comes from' },
  'r-fewest-payments-for-the-whole-group-not': { title: 'Fewest payments for the whole group' },
  'r-cash-app-paypal-and-zelle-alongside-venmo': { title: 'Cash App, PayPal and Zelle' },
  'r-the-tab-by-person-your-net-with': { title: 'The Tab by person' },
  'r-request-links-on-the-tab-for-every': { title: 'Request links for every payment app' },
  'r-a-trip-tab-one-tab-across-the': { title: 'A trip Tab', blurb: 'One Tab across a trip’s rounds, settled once' },
  'r-gentle-payment-reminders-mike-still-owes-18': { title: 'Gentle payment reminders' },
  'r-a-separate-tab-for-each-crew-or': { title: 'A Tab for each crew or trip, and close the books' },
  'r-trip-expenses-on-the-same-tab-as': { title: 'Trip expenses on the Tab', blurb: 'Gas, dinner and the house, split any way' },
  'r-the-bank-collects-for-you-pro-idea': { title: 'Automatic nudges for what’s owed' },
  'r-round-history-season-stats-head-to-head': { title: 'History, season stats and head to head' },
  'r-honest-head-to-head-each-pairs-result': { title: 'Honest head to head' },
  'r-history-by-month-each-month-shows-its': { title: 'History by month' },
  'r-deeper-stats-for-pro-press-win-rate': { title: 'Your stats', blurb: 'Press win rate, results by game and by course' },
  'r-handicap-trend-from-your-rounds-as-a': { title: 'Your handicap trend' },
  'r-year-in-review-birdie-bank-wrapped-a': { title: 'Your year in review' },
  'r-rivalry-cards-for-every-pair-all-time': { title: 'Rivalry cards', blurb: 'All-time money, record, streak and your nemesis' },
  'r-group-champions-and-a-hall-of-fame': { title: 'Group champions and a hall of fame' },
  'r-the-groups-feed-between-rounds-upcoming-round': { title: 'Lately: the group’s week' },
  'r-follow-friends-rounds-live-even-ones-youre': { title: 'Follow friends’ rounds live' },
  'r-friends-list-beyond-your-groups-suggested-from': { title: 'A friends list' },
  'r-wider-activity-feed-big-wins-birdie-streaks': { title: 'A wider feed: big wins and streaks' },
  'r-a-money-list-for-each-crews-season': { title: 'A money list for each crew' },
  'r-a-reputation-that-travels-with-you-pays': { title: 'A reputation that travels with you' },
  'r-find-a-game-join-an-open-spot': { title: 'Find a game near you' },
  'r-league-season-weekly-schedule-sign-ups-standings': { title: 'Leagues', blurb: 'Schedules, sign-ups, standings, flights and weekly pots' },
  'r-event-or-trip-multiple-days-and-rounds': { title: 'Events', blurb: 'Several days, team formats and a clubhouse leaderboard' },
  'r-trip-mode-set-up-in-minutes-a': { title: 'Trip Mode', blurb: 'Ryder Cup templates, a captains’ draft and flights' },
  'r-trip-formats-day-by-day-team-points': { title: 'Trip formats and a trip leaderboard' },
  'r-printable-pairings-cart-signs-and-results-sheets': { title: 'Printable pairings and cart signs' },
  'r-push-invited-to-a-round-whos-in': { title: 'Push notifications', blurb: 'Invites, who’s in, trash talk, results and payments' },
  'r-email-receipts-and-a-welcome-email': null,
  'r-the-spring-comeback-email-your-crews-first': null,
  'r-live-activity-on-the-lock-screen-your': { title: 'Your money on the lock screen' },
  'r-already-an-installable-web-app-manifest-and': { title: 'Install it on your home screen' },
  'r-app-store-and-google-play-apps-capacitor': { title: 'App Store and Google Play apps' },
  'r-links-that-open-straight-into-the-app': { title: 'Links that open straight into the app' },
  'r-never-force-an-update-before-or-during': { title: 'Never an update mid-round' },
  'r-plays-nicely-next-to-other-apps-switching': { title: 'Plays nicely with your GPS and music' },
  'r-round-results-can-be-shared-as-an': { title: 'Share your results' },
  'r-round-results-image-course-game-winner-a': { title: 'A results card with a character' },
  'r-link-preview-images-for-join-and-share': { title: 'Preview images for links' },
  'r-saturday-preview-card-to-post-in-the': { title: 'A preview card for the group text' },
  'r-profile-card-handicap-season-record-nemesis-favorite': { title: 'A profile card to share' },
  'r-year-in-review-cards-sized-for-instagram': { title: 'Year in review cards for Stories' },
  'r-suggest-something-in-the-app-with-four': { title: '“Suggest something”' },
  'r-each-form-asks-for-whats-useful-a': null,
  'r-show-it-in-natural-places-course-search': null,
  'r-make-feedback-impossible-to-miss-a-pink': { title: 'Report a bug from the round menu' },
  'r-after-a-round-how-was-birdie-bank': { title: 'A quick “How was it?” after a round' },
  'r-public-roadmap-in-the-app-and-on': { title: 'This roadmap', blurb: 'Vote, comment and send in ideas' },
  'r-after-submitting-a-request-people-land-on': { title: 'Land on the roadmap after sending an idea' },
  'r-tell-requesters-when-their-idea-ships-the': { title: 'Hear when your idea ships' },
  'r-whats-new-screen-for-release-notes': { title: 'What’s new' },
  'r-up-next-home-tab-and-new-bottom': { title: 'Up next, your home screen' },
  'r-run-it-back-on-a-finished-round': { title: '“Run it back”' },
  'r-upcoming-rounds-date-course-tee-time-and': { title: 'Plan rounds ahead' },
  'r-whos-in-each-player-answers-in-out': { title: 'Who’s in, and vote on the game' },
  'r-bets-set-ahead-of-time-so-the': { title: 'Tee off in one tap with a roll call' },
  'r-edit-an-upcoming-round-the-organizer-changes': { title: 'Edit an upcoming round' },
  'r-schedule-for-later-at-the-end-of': { title: '“Schedule for later” from setup' },
  'r-a-plan-keeps-the-rest-of-the': { title: 'Plans keep the whole setup' },
  'r-lock-down-plans-before-the-creator-test': null,
  'r-push-reminders-for-upcoming-rounds-the-morning': { title: 'Push reminders for upcoming rounds' },
  'r-tee-time-reminder-book-your-tee-time': { title: 'Tee time reminders' },
  'r-countdown-and-a-saturday-preview-whos-in': { title: 'The countdown and the preview', blurb: 'Who’s in, strokes and head-to-head records' },
  'r-comments-and-reactions-on-rounds-challenges-and': { title: 'Comments and reactions everywhere' },
  'r-easy-sharing-into-the-groups-own-text': { title: 'Easy sharing into the group text' },
  'r-challenges-dave-challenges-mike-to-a-20': { title: 'Challenges', blurb: '“Dave challenges Mike to a $20 match”' },
  'r-callouts-from-the-tab-and-stats-still': { title: 'Callouts for the group text' },
  'r-group-sees-who-has-paid-from-last': null,
  'r-carry-over-proposals-propose-rolling-a-balance': null,
  'r-monday-recap-last-rounds-results-whos-paid': { title: 'The day-after recap' },
  'r-friends-rounds-during-the-week-show-up': null,
};

/** A line's id: 'r-' and its first seven words, so votes stay with it when Trevor checks it off. */
export function itemId(text) {
  const words = cleanStart(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return `r-${words.slice(0, 7).join('-')}`.slice(0, 80).replace(/-+$/, '');
}

/** The line without its markdown, its "(partial)" and its leading quote marks or bold. */
function cleanStart(text) {
  return String(text).replace(/\*\*/g, '').replace(/^\(partial\)\s*/i, '').trim();
}

const DATE = /\d{4}-\d{2}-\d{2}/;

/**
 * The day a checked line shipped: the date after "shipped", else the last date standing on its own
 * in brackets, else the first date anywhere. Null when the line has none.
 */
export function shippedDate(text) {
  const s = String(text);
  const shipped = s.match(/shipped (?:to main )?(\d{4}-\d{2}-\d{2})/i);
  if (shipped) return shipped[1];
  const alone = [...s.matchAll(/\((\d{4}-\d{2}-\d{2})\)/g)];
  if (alone.length) return alone[alone.length - 1][1];
  return s.match(DATE)?.[0] || null;
}

/** Brackets and what's in them, nested ones too. */
function dropBrackets(s) {
  let out = s, prev;
  do { prev = out; out = out.replace(/\s*\([^()]*\)/g, ''); } while (out !== prev);
  return out;
}

/**
 * A short friendly title from a checklist line: the bit before the first colon or full stop,
 * without brackets, quote marks, step tags or the codename. Long ones stop at a comma.
 */
export function friendlyTitle(text) {
  let s = dropBrackets(cleanStart(text));
  s = s.replace(/\bBirdie Bank\b/g, 'the app');
  // Working notes Trevor adds as things ship
  s = s.split(/\s(?:Built|Moved|Replaced|Still to do|Shipped)\b/)[0];
  // "New game: team best ball" is about the game, not the label
  s = s.replace(/^New games?:\s+/i, '');
  s = s.split(/:\s|\.\s|;\s|\.$/)[0];
  s = s.replace(/^["“]([^"”]+)["”]$/, '$1').replace(/\s+/g, ' ').trim();
  if (s.length > 60) {
    const cut = s.slice(0, 60).lastIndexOf(', ');
    s = cut > 20 ? s.slice(0, cut) : s.slice(0, s.slice(0, 60).lastIndexOf(' '));
  }
  s = s.replace(/[,.;:\s]+$/, '');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The kind of thing a line is, for the "it shipped" note: a new game, or anything else. */
export function itemKind(text, area) {
  return area === 5 && /^(\(partial\)\s*)?New games?\b/i.test(String(text).trim()) ? 'game' : 'feature';
}

const STEP_ORDER = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, Later: 6 };

/**
 * Every checklist line in ROADMAP.md as { area, areaNo, done, partial, step, text, line }.
 * Notes and lines outside "The checklist by area" are skipped.
 */
export function checklistLines(md) {
  const out = [];
  let areaNo = null, area = null, inChecklist = false;
  String(md).split('\n').forEach((raw, i) => {
    const h2 = raw.match(/^##\s+(.+)/);
    if (h2 && !raw.startsWith('###')) { inChecklist = /checklist/i.test(h2[1]); areaNo = null; return; }
    const h3 = raw.match(/^###\s+(\d+)\.\s+(.+)/);
    if (h3) { areaNo = Number(h3[1]); area = h3[2].trim(); return; }
    if (!inChecklist || areaNo == null) return;
    const m = raw.match(/^\s*-\s+\[( |x|X)\]\s+(?:`([^`]+)`\s+)?(.+)$/);
    if (!m) return;
    const text = m[3].trim();
    out.push({ areaNo, area, done: m[1] !== ' ', partial: /^\(partial\)/i.test(text), step: m[2] || null, text, line: i + 1 });
  });
  return out;
}

/**
 * The public roadmap from ROADMAP.md: [{ id, title, blurb, area, status, shipped, step, kind, order }],
 * status 'planned' | 'progress' | 'shipped'. Hidden areas and private lines are left out, and an id
 * appears once (a repeated line keeps its first place).
 */
export function publicRoadmap(md) {
  const seen = new Set();
  const out = [];
  for (const l of checklistLines(md)) {
    const areaName = PUBLIC_AREAS[l.areaNo];
    if (!areaName) continue;
    const id = itemId(l.text);
    if (seen.has(id)) continue;
    const hand = Object.prototype.hasOwnProperty.call(TITLES, id) ? TITLES[id] : undefined;
    if (hand === null) continue; // left off by hand: a duplicate of another line, or not for the public
    const title = hand?.title || friendlyTitle(l.text);
    if (!title || title.length < 4) continue;
    // Private words in the line itself, unless the title was written by hand
    if (!hand && PRIVATE.test(l.text)) continue;
    if (PRIVATE.test(title) || PRIVATE.test(hand?.blurb || '')) continue;
    seen.add(id);
    const status = l.done ? 'shipped' : l.partial ? 'progress' : 'planned';
    out.push({
      id,
      title,
      blurb: hand?.blurb || null,
      area: areaName,
      status,
      shipped: status === 'shipped' ? shippedDate(l.text) : null,
      step: STEP_ORDER[l.step] ? l.step : null,
      kind: hand?.kind || itemKind(l.text, l.areaNo),
      order: out.length,
    });
  }
  return out;
}
