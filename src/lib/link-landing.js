// The words on the branded pages behind the app's links, for someone who opened one with no app:
// what it is (the invite card each screen already shows), that it runs right here in the browser,
// and how joining works, in three short steps a kind. Pure, so the tests can read them.

/** The line next to the app's name at the top of a link's page. */
export const BROWSER_LINE = 'No download needed';

/** Three steps for each kind of link: a round (join), a plan and a challenge. */
export const HOW_IT_WORKS = {
  join: [
    'Pick your seat, or just watch.',
    'Follow every hole and the money live, right here in your browser.',
    'Settle up after with the payment app you already use.',
  ],
  plan: [
    'Say if you’re in, maybe or out.',
    'Vote on the game and the bet.',
    'On the day, this same link follows the round live.',
  ],
  challenge: [
    'Accept, pass or name your own amount.',
    'Once you both agree, it goes in the round as a side bet.',
    'It all works here in your browser. Nothing to install.',
  ],
};

// A round played for points or a reward (with no side bet for money) has no money to follow or
// settle, so its steps say the scores instead
const JOIN_NO_MONEY = [
  'Pick your seat, or just watch.',
  'Follow every hole and the scores live, right here in your browser.',
  'See who won the moment the round is done.',
];

/**
 * The steps for a kind of link, or none. `money`: false for a round with nothing on the Tab
 * (play-for.js onTab), so a points or lunch round never talks about settling up.
 */
export const howItWorks = (kind, money = true) => (kind === 'join' && !money ? JOIN_NO_MONEY : HOW_IT_WORKS[kind] || []);
