# Night 3: Trevor's notes and the final visual audit (2026-10-29)

Trevor's audit review (REVIEW-2-ANSWERS.md): hold for the name and logo; another night of fixes, then one
more full visual audit, with illustrations first ("centered when they need to be", "gaps between arms and
legs cut out").

## His notes, all fixed
Illustrations are die-cut stickers everywhere (an even white border sized to the drawing, both themes,
crisp on thin strokes; no colour plates or ovals behind drawings); the gaps between legs and arms, under
chairs and the car, inside handles are cut out (`<id>.holes.svg` keeps the border out of them); ink
outlines on every buddy and critter (head, glasses, every hat) and every avatar fits its circle; the
wizard's whole hat; the birdie centred; no oval on Round ready; podium steps square at the bottom; no
birdie and eagle on the scorecard key; par in ink from the start; trips lead with your place, then money.
Notes: n3-sticker.md, n3-gaps.md, n3-play.md, n4-art.md.

## Last night's leftovers
About 75 polish and should items on the shared pieces and non-round screens (n3-polish.md) and the round
screens' should items and polish (n3-play2.md): Settle up as one card, a team podium, the reward round,
the Wolf panel, Vegas by side, the handicaps sheet, scroll fades.

## The final audit
1,110 shots of every screen and state in both themes (`overnight/audit-shots-4/`), three auditors with the
illustration checklist: 280 findings (7 broken, 90 should, 183 polish) in auditor-4/5/6.json. Fixers:
round (70 of 71 fixed, one needed no change), trips (52 of 53), screens (every owned finding has a line),
art (all but three that need new drawings). Every broken one is fixed, including a regression from night 2
(a friend's plan showed the wrong faces) and content cut off above pinned buttons.

A merge found one more: the screens fixer's navigation transitions made the end-of-round test fail; the
cause was the reveal arriving during the hole screen's exit. Transitions are gone, a push waits only for
code that hasn't loaded, a leaving screen is inert, and the e2e passes in dev and the production build.

## Left
- New drawings needed: Match play, Vegas and Sixes read small; seven games still have the old flat art;
  the share card's winner buddy can't use the drawing files yet.
- The year in review and player card images still use Bricolage (the share images' face).
- One shared gone screen per kind, the public roadmap's header, the Banker amounts on Game defaults.
- Not seen in real iOS Safari: the sticker filter uses long-supported SVG primitives but needs a look on
  the phone.
