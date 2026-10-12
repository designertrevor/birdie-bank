# Split Pro on the Tab (key: split, roadmap area 7)

Branch `o13/split`. Money item: needs the money check before merge.

## What I built

When an organizer picks a plan on the paywall (the preview trial; nothing is charged), a sheet asks
"Split it with your group?": everyone from their usuals, crews and saved players, the likely group
ticked, You ticked, each person's share, and "$12.50 each for your foursome" up top. "Put it on the
Tab" adds what each friend owes the organizer to the Tab; a toast offers Undo. Your plan shows
"Split it with your group" (same sheet) or, once split, "Sam, Jo and Al owe you $12.50 each on the
Tab, of $49.99" with Undo. On the Tab it reads like trip money: the person's card has a "Pro · split
with your group" line, and Where it comes from has "Sam's share of your Pro". Paying it is the
normal Tab flow (Paid on the person's line), which records a normal payment.

Everything is behind the paywall flag. With it off, nothing shows and no split's money counts, even a
split made while it was on.

## Files

- `src/lib/pro-split.js` (new): the share maths (`splitShares`), the split record, merge, Undo, the
  Tab money (`allSplitMoney`, `splitsBetween`, `splitPairs`), who to offer (`splitCandidates`).
- `src/lib/pro-split.test.js` (new): 18 tests (odd cents, 2 to 8 people, organizer in or out, Undo,
  flag off, never touching a round, settling up, crews' tabs still adding up, two phones, a friend's
  phone, backup).
- `src/components/SplitPro.jsx` (new): the sheet and the Your plan row.
- `src/lib/ledger.js`: split money in `tabBalances`, the trip-plan balances, `outstanding` (the
  organizer and each friend can pay each other directly) and `personStory`.
- `src/lib/where-from.js`, `src/components/WhereFrom.jsx`, `src/screens/Person.jsx`: the lines.
- `src/screens/Paywall.jsx`, `src/screens/YourPlan.jsx`: the offer and the row.
- `src/lib/store.js`, `src/lib/cloud-model.js`, `src/lib/backup.js`: `proSplits`, synced in the
  profile split by split (newer copy wins, an undone stub wins a tie), kept in backups.
- `src/styles.css`: a few lines at the end.

## How to see it

1. `?paywall=on` (and `?profile=b` for a second phone if you like), on an organizer with a few saved
   players (or a usual or crew).
2. Settings, Your plan, See what Pro adds, Start 14 days free. The split sheet opens. Untick or tick
   people, toggle You, Put it on the Tab.
3. The Tab: each friend owes you their share. Tap a person: the Pro line. Mark them paid: square.
4. Your plan: the split row with Undo. `?paywall=off`: the Tab is back to rounds only.

## Money decisions (made for you)

1. **Where the money lives.** Options: reuse trip expenses (they need a trip, so a fake trip),
   fake it as payments, or a small collection of its own read the way trip money is read. **Pick:
   its own collection** (`state.proSplits`), folded into the Tab exactly where trip expenses and
   the Big Game are. No round, transfer or payment is changed by a split.
2. **Odd cents.** Options: organizer absorbs them, first friends pay them, round up. **Pick:** the
   organizer first when they're in the split (no friend pays more than an even share, as trip
   expenses do with the payer), then friends in order of their id so the same people always get the
   same shares, whatever order they were ticked. Shares always add up to the price exactly.
   $49.99 for a foursome: you $12.50, two friends $12.50, one $12.49.
3. **Organizer in or out.** **Pick: in by default** (the roadmap's "$12.50 each for your
   foursome"), with a toggle. Out: the friends split the whole price between them.
4. **Group size.** **Pick: 2 to 8 people** in a split, the organizer counted when in.
5. **Only the organizer's phones carry it.** Options: a server table so friends see their share on
   their own phone, or organizer only. **Pick: organizer only tonight** (synced to their other
   phones through the profile). A split only moves money on a phone whose owner made it, so a
   friend's phone never counts it, even with a backup of the organizer's data. Friends see it once a
   server table exists (follow-up, needs SQL; no SQL tonight).
6. **Never twice.** The split's id is the purchase (the paywall answer's time), so two of the
   organizer's phones splitting the same purchase write one split, the newer copy winning. And one
   split stands at a time: while one does, the paywall doesn't offer another (a second trial answer
   from the Season preview would otherwise split the price again) and Your plan shows the standing
   one. Undo it to split again.
7. **Settling.** It nets across the group like the rest of the Tab (fewest payments), and the
   organizer and each friend in the split can pay each other directly even with no round together.
   A payment is a normal Tab payment.
8. **Undo.** Takes every share off at once (kept as a stub so the organizer's other phones drop it
   too). If a friend already paid, their payment stays, so the Tab then shows you owing it back,
   which is correct money.
9. **When it goes on the Tab.** **Pick: right when they confirm**, during the trial. At launch you
   may want shares to land on the first real charge instead; that's a one-line change in where the
   sheet is offered.
10. **Monthly plan.** Splits one month's price ("for this month"); it doesn't repeat monthly.
    Switching plan after splitting doesn't change the split (it shows the price it was split at).

## Not done

- Friends don't see their share on their own phone (decision 5).
- No browser check here (the QA agent does it after the merge).

## SQL or Vercel steps

None.
