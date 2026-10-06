// The terms of service at /terms.html, next to the privacy policy (public/privacy.html) and in its
// look. The build (vite.config.js legalPages) writes it from here, so the app’s name comes from
// app-name.js and the contact address from support.js: the rename and a new support inbox are
// one-line changes. The body says "the app" and "we", so it reads the same whatever the name.
// It’s a draft for a lawyer to review, and the banner at the top says so until they have.
// Pure, so the tests can check what it promises.
import { APP_NAME, SITE_URL } from './app-name.js';
import { escapeHtml } from './og.js';
import { MONEY_AGE } from './age.js';
import { SUPPORT_EMAIL } from './support.js';

/** Where the page is written in dist, and its address. */
export const TERMS_FILE = 'terms.html';
export const TERMS_PATH = '/terms.html';

/** The date at the top. Change it with any real change to the terms. */
export const TERMS_EFFECTIVE = 'October 6, 2026';

/** True until a lawyer has read it: the page shows the draft banner while this is on. */
export const TERMS_DRAFT = true;

// The look of privacy.html, plus the draft banner
const CSS = `
  :root { --canvas: #fffaf0; --card: #ffffff; --ink: #0a0a0a; --body: #3a3a3a; --mute: #6a6a6a; --line: #ebe6d6; --pink: #d6336c; --warn-bg: #fff1d6; --warn-line: #f0c97a; }
  @media (prefers-color-scheme: dark) {
    :root { --canvas: #141716; --card: #1d2120; --ink: #f4efe2; --body: #d6d1c4; --mute: #a39e92; --line: #2c312f; --pink: #ff6fa0; --warn-bg: #2e2716; --warn-line: #6b5524; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--body); font: 16px/1.6 Inter, system-ui, sans-serif; text-wrap: pretty; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 20px 64px; }
  a { color: var(--pink); }
  .back { display: inline-block; font-weight: 600; text-decoration: none; margin-bottom: 24px; }
  h1, h2 { font-family: "Bricolage Grotesque", Inter, sans-serif; font-weight: 800; color: var(--ink); letter-spacing: -.02em; text-wrap: balance; }
  h1 { font-size: 40px; line-height: 1.05; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 36px 0 8px; }
  .meta { color: var(--mute); margin: 0 0 24px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 20px; margin: 16px 0; }
  .card > p:first-child { margin-top: 0; } .card > p:last-child { margin-bottom: 0; }
  .draft { background: var(--warn-bg); border: 1px solid var(--warn-line); border-radius: 18px; padding: 12px 20px; margin: 0 0 24px; color: var(--ink); }
  ul { padding-left: 20px; }
  li { margin: 6px 0; }
  strong { color: var(--ink); }
  .foot { margin-top: 40px; color: var(--mute); }
`;

/**
 * The page’s sections, as [heading, html] pairs, so the tests can look for what each one says.
 * `mail` is the contact address, already a link.
 */
export function termsSections(mail) {
  const age = MONEY_AGE;
  return [
    ['Who these terms are with', `<p>These terms are an agreement between you and Trevor Nielsen ("we," "us"), who runs the app at ${escapeHtml(SITE_URL.replace(/^https?:\/\//, ''))}. By using the app you agree to them. If you don’t agree, please don’t use it.</p>`],
    ['What the app does', `<p>The app keeps score for golf rounds with your friends, works out the results of the games you pick, and keeps a running tab of who owes whom. It’s a scorekeeper and a notebook. It isn’t a bank, a bookmaker, a casino or a payment service.</p>`],
    ['Friendly wagers, and the money', `<ul>
      <li><strong>We never hold, move or collect money.</strong> There’s no wallet, no deposit and no balance kept by us. We never ask for bank or card details.</li>
      <li><strong>We take no cut.</strong> We don’t charge a fee on any bet, pot or settle-up, and we don’t make money from who wins or loses.</li>
      <li><strong>You settle up between yourselves.</strong> The Tab shows what the app worked out from the scores you entered. Paying is up to the people involved, outside the app, in cash or in a payment app of your choosing. A request or payment link only opens that app, and what happens there is between you, the other person and that app.</li>
      <li><strong>The numbers are a record, not a debt we enforce.</strong> Scores can be entered wrong and rules can be set up differently from what your group meant. Check the results with your group before anyone pays. We aren’t a party to any bet and can’t settle disputes between players.</li>
      <li><strong>Points and reward rounds</strong> keep score the same way with no money at all.</li>
    </ul>`],
    ['Age, and where you play', `<p>Playing for money is for people ${age} or older. The app asks before money rounds and keeps money off for anyone who says they’re under ${age}. Some places set a higher age, or don’t allow betting on golf at all, even between friends: it’s up to you to know and follow the laws where you live and play. Don’t use the app for any bet that’s against the law where you are.</p>`],
    ['Your account', `<ul>
      <li>You can use the app without an account. If you sign in, keep access to your email or Google account safe: anyone who can sign in as you can see and change your rounds.</li>
      <li>Give accurate information, including your handicap index, so games are fair for your group.</li>
      <li>You can delete your account at any time from Settings, or by emailing ${mail}.</li>
    </ul>`],
    ['What you put in the app', `<p>Your names, scores, photos, comments, suggestions and everything else you add stay yours. You give us permission to store, copy and show them only as needed to run the app: to save your rounds, sync your devices and show a shared round, plan or challenge to the people you share it with, following your privacy setting. If you send us a suggestion or bug report, we may use the idea to improve the app without owing you anything for it.</p><p>How we handle your information is in the <a href="/privacy.html">privacy policy</a>.</p>`],
    ['Using the app fairly', `<p>Please don’t:</p><ul>
      <li>Use the app to run a betting business, take a cut of other people’s bets, or arrange bets for people you don’t play with.</li>
      <li>Use it for anything against the law where you are, including bets with anyone under the legal age.</li>
      <li>Harass, threaten or impersonate anyone, or post anything hateful, sexual or that you don’t have the right to share. Trash talk is welcome, so keep it friendly.</li>
      <li>Try to get into rounds, accounts or data you weren’t invited to, overload or break the service, or copy it with bots or scrapers.</li>
    </ul>`],
    ['If we have to stop your access', `<p>You can stop using the app at any time. We may suspend or close an account, or remove something it shared, if it breaks these terms or puts other people or the service at risk. Where it’s reasonable we’ll tell you first and say why. The parts of these terms about money, disclaimers and liability still apply after that.</p>`],
    ['The app as it is', `<p>We work hard to get the scoring and the money right, but the app is provided "as is" and "as available," without warranties of any kind, as far as the law allows. We don’t promise it will always be available, free of mistakes, or that every game or handicap is worked out exactly the way your group plays it. Course details come from outside sources and may be out of date.</p>`],
    ['Limits on our liability', `<p>As far as the law allows, we aren’t liable for any indirect or consequential loss, or for any money won, lost, owed or paid between players, including because of a scoring mistake, a wrong result or a payment made in another app. If we are found liable for anything else, our total liability is limited to the greater of what you paid us in the last 12 months or 50 US dollars. Some places don’t allow these limits, so they may not all apply to you.</p>`],
    ['Changes', `<p>The app will change as we build it, and these terms may too. When they change we’ll update the date at the top, and if a change matters we’ll let you know in the app before it applies. Using the app after that means you accept the new terms.</p>`],
    ['Contact', `<p>Questions about these terms, or anything else: ${mail}.</p>`],
  ];
}

/** The whole page, written to dist/terms.html by the build. */
export function renderTermsPage({ appName = APP_NAME, email = SUPPORT_EMAIL, effective = TERMS_EFFECTIVE, draft = TERMS_DRAFT } = {}) {
  const name = escapeHtml(appName);
  const mail = `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
  const body = termsSections(mail).map(([h, html]) => `  <h2>${escapeHtml(h)}</h2>\n  ${html}`).join('\n\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#fffaf0">
<meta name="description" content="The terms for using ${name}: a scorekeeper for friendly golf games that never holds or moves money.">
${draft ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="/icon.svg" type="image/svg+xml">
<title>Terms of Service · ${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<main>
  <a class="back" href="/">${name}</a>
${draft ? '  <div class="draft" role="note"><strong>Draft for legal review.</strong> These terms haven’t been reviewed by a lawyer yet and may change before they do.</div>\n' : ''}  <h1>Terms of Service</h1>
  <p class="meta">Effective ${escapeHtml(effective)}</p>

  <div class="card">
    <p><strong>The short version.</strong> The app keeps score of friendly bets between friends. We never hold, move or collect money, and we take no cut: your group settles up between yourselves. Money rounds are for adults, ${MONEY_AGE} and older, where betting on golf is legal. Be fair, be kind, and check the results with your group before anyone pays.</p>
  </div>

${body}

  <p class="foot"><a href="/privacy.html">Privacy policy</a> · <a href="/rules">Game rules</a></p>
</main>
</body>
</html>
`;
}
