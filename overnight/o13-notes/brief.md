# o13/brief: the two-minute creator brief (area 22)

**Built:** `overnight/O13-creator-brief.md`, a doc only, no code. About 500 words below the note to Trevor,
so a two-minute read. Sections: the problem, the moment to film, how to talk about it (a say / avoid
table), disclosure, what they get and their link, do and don't.

**Checked against the app:** the moment matches what `Finale.jsx` really does: the reveal (each bet
resolves, then `RaceBoard.jsx` races the totals and crowns the winner), Settle up (the fewest payments,
each with a button in the payee's own app: Venmo, Cash App, PayPal or Zelle, from `pay-fields.js`), and
the results card with the cheering winner (`ResultsArt.jsx`). The "never holds, sends or collects money"
line matches the onboarding's Friendly wagers note. Play for points or lunch is real (`play-for.js`).

**Decisions made for Trevor**
1. Placeholder name: options were "Birdie Bank" with a note, or [App name] throughout. Picked **[App name]**
   throughout, with a note at the top to swap it, so nothing goes out with the old name by accident.
2. What the creator gets: options were the flat fee only, or the fee plus Pro free for their group.
   Picked **fee plus Pro free for their group** (cheap, and it keeps them using it after the post). Cut
   the phrase if you'd rather not promise it. Reuse rights are mentioned, as the roadmap's deal terms say.
3. The link: written as `<link>?ref=<your code>`, pointing at `overnight/O13-creator-codes.md` (built by
   the codes agent tonight). The real link is the store or site link at outreach time.
4. Added "don't show payment handles or phone numbers on screen", since Settle up shows pay handles.

**Left undone:** nothing in scope. The one-time legal review of the betting wording (area 15) should read
the say / avoid table before outreach.

**SQL / Vercel:** none.

**For the lead:** the main checkout's `node_modules` (the one the brief says to symlink) is missing
`@sentry/browser`, so `npm run build` fails through the symlink. I ran `npm ci` in this worktree instead
(node_modules is gitignored). Checks: lint clean, 2,351 tests pass, build green, first screen 379.78 kB of 481.
