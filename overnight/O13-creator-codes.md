# Creator download codes (Overnight 13, task 9)

One short code per creator on the S4 creator list (`overnight/O10-creators.md`). The list lives in one place, `src/lib/creator-codes.js`, so edit it there. `src/lib/creator-codes.test.js` checks that every code is unique, short, passes the cleaning rule unchanged, fits the attribution table, and never contains the app's name.

## How attribution works

A creator's link carries `?ref=CODE` (or `?via=CODE`), and the phone keeps the first code it ever sees, with the page it landed on. A later link never takes the credit (`src/lib/attribution.js`).
Codes are cleaned to lower-case letters, digits, `-` and `_`, at most 32 characters, so `?ref=BadGolf` still counts as `badgolf`. Every code below is already its own cleaned form.

## Reading the results

- **Usage events (PostHog).** Every usage event carries `ref` (the code), `ref_landing` (the page) and `ref_new` (the phone was new to the app). Break down `app_opened`, `round_finished` or `plan_picked` by `ref` to see installs, real rounds and upgrades per creator. This needs the PostHog key in Vercel, which is still on the to-do list. Until then nothing is collected.
- **The attribution table.** Once someone signs in, their first-touch code is saved to their account, one row each, in `public.attribution` from `supabase/2026-10-09-attribution.sql`. **That SQL hasn't been run yet**, so the table doesn't exist. Until it runs, the app keeps the code on the phone and retries the save on each launch, so nobody who arrives before then is lost. Once it's run, sign-ups per creator (new phones only), in the SQL Editor:

```sql
select code, count(*) as people, min(first_seen) as first, max(first_seen) as last
from public.attribution where new_phone group by code order by people desc;
```

## The domain

The links below use `{domain}` as a placeholder. Today it's `birdie-bank.vercel.app`, so Bad Golf's link is `https://birdie-bank.vercel.app/?ref=badgolf`. The domain changes with the rename; **the codes don't**, so the only edit then is the domain. A code also works on a rule page (for example `/rules/wolf?ref=badgolf`), since the rule pages carry it on every link back into the app.

## Decisions

- **One code per platform for the two creators listed twice** (Roger Steele: `steele-yt` and `steele-ig`; Josh Kelley: `kelley-tt` and `kelley-yt`), so the results say which platform worked. The options were one code per person or one per platform. Picked: per platform.
- **Short, readable codes from the creator's own name or handle**: no `golf` where it adds nothing, 16 characters at most, dashes only (no underscores), so a creator can say it out loud in a video.
- **Brand-free:** no code contains the app's name. That's why "Birdies in the Outfield" is `bito` and Louis Birchall (handle `birdieswithbirchall`) is `birchall`.
- **All 50 research rows get a code**, including the Low-fit and unverified ones, so a code is ready whoever gets picked. Delete rows freely.
- **Not wired into any screen.** `creatorOf(code)` and `creatorLink(code, site)` are there for a future admin view.

## The codes

The # is the row in `overnight/O10-creators.md`.

| # | Creator | Platform | Code | Link |
|---|---|---|---|---|
| 1 | The Golf Mates Club | YouTube | `golfmatesclub` | `https://{domain}/?ref=golfmatesclub` |
| 2 | Bad Golf (John Robins and Alex Horne) | YouTube | `badgolf` | `https://{domain}/?ref=badgolf` |
| 3 | Ryan Ruffels (RUFFS) | YouTube | `ruffs` | `https://{domain}/?ref=ruffs` |
| 4 | Chance Taylor | YouTube | `chancetaylor` | `https://{domain}/?ref=chancetaylor` |
| 5 | Nick Voke | YouTube | `voke` | `https://{domain}/?ref=voke` |
| 6 | James Nicholas | YouTube | `jamesnicholas` | `https://{domain}/?ref=jamesnicholas` |
| 7 | Skins Golf TV | YouTube | `skinstv` | `https://{domain}/?ref=skinstv` |
| 8 | Adequate Golf | YouTube | `adequate` | `https://{domain}/?ref=adequate` |
| 9 | Cheeky Golf Club | YouTube | `cheeky` | `https://{domain}/?ref=cheeky` |
| 10 | Not A Scratch Golfer (Adam Fine) | YouTube | `notascratch` | `https://{domain}/?ref=notascratch` |
| 11 | New Nine Golf (Brandon Cubitt) | YouTube | `newnine` | `https://{domain}/?ref=newnine` |
| 12 | Short Game King (Daniel Saloner) | YouTube | `sgk` | `https://{domain}/?ref=sgk` |
| 13 | Ian Poulter, The Postman | YouTube | `postman` | `https://{domain}/?ref=postman` |
| 14 | Handicap Golf | YouTube | `hcpgolf` | `https://{domain}/?ref=hcpgolf` |
| 15 | Tour Experience Golf (TXG) | YouTube | `txg` | `https://{domain}/?ref=txg` |
| 16 | Pavan Sagoo | YouTube | `sagoo` | `https://{domain}/?ref=sagoo` |
| 17 | Jean-Philippe Mehu | YouTube | `mehu` | `https://{domain}/?ref=mehu` |
| 18 | Roger Steele Golfs | YouTube | `steele-yt` | `https://{domain}/?ref=steele-yt` |
| 19 | Basic Bogeys Podcast (TJ and Gary) | YouTube | `basicbogeys` | `https://{domain}/?ref=basicbogeys` |
| 20 | WOLF Money | YouTube | `wolfmoney` | `https://{domain}/?ref=wolfmoney` |
| 21 | Mia Baker Golf | YouTube | `miabaker` | `https://{domain}/?ref=miabaker` |
| 22 | Simon Camirand | YouTube | `camirand` | `https://{domain}/?ref=camirand` |
| 23 | Charles M Golf | YouTube | `charlesm` | `https://{domain}/?ref=charlesm` |
| 24 | So Pure | YouTube | `sopure` | `https://{domain}/?ref=sopure` |
| 25 | OutofRegsTV | YouTube | `outofregs` | `https://{domain}/?ref=outofregs` |
| 26 | Not a Perfect Golfer | YouTube | `notperfect` | `https://{domain}/?ref=notperfect` |
| 27 | Gabby Golf Girl (Gabriella DeGasperis) | TikTok | `gabby` | `https://{domain}/?ref=gabby` |
| 28 | Carter Vynckier | TikTok | `cva` | `https://{domain}/?ref=cva` |
| 29 | Mully Golf | TikTok | `mully` | `https://{domain}/?ref=mully` |
| 30 | Case Of The Shanks | TikTok | `shanks` | `https://{domain}/?ref=shanks` |
| 31 | Zach Moore | TikTok | `zachmoore` | `https://{domain}/?ref=zachmoore` |
| 32 | AndyCastellGolf | TikTok | `castell` | `https://{domain}/?ref=castell` |
| 33 | Sabrina Andolpho (Golf Girl Games) | TikTok | `andolpho` | `https://{domain}/?ref=andolpho` |
| 34 | Putt Buddies Golf | TikTok | `puttbuddies` | `https://{domain}/?ref=puttbuddies` |
| 35 | Louis Birchall | TikTok | `birchall` | `https://{domain}/?ref=birchall` |
| 36 | Birdies in the Outfield (B.I.T.O. Boys) | TikTok | `bito` | `https://{domain}/?ref=bito` |
| 37 | Matxtricks | TikTok | `matx` | `https://{domain}/?ref=matx` |
| 38 | visionquestgolf | TikTok | `visionquest` | `https://{domain}/?ref=visionquest` |
| 39 | Bob MacIntyre | TikTok | `macintyre` | `https://{domain}/?ref=macintyre` |
| 40 | Golf on TikTok | TikTok | `golfontiktok` | `https://{domain}/?ref=golfontiktok` |
| 41 | Clay Ballard (Top Speed Golf) | TikTok | `topspeed` | `https://{domain}/?ref=topspeed` |
| 42 | Americans First | TikTok | `amfirst` | `https://{domain}/?ref=amfirst` |
| 43 | Josh Kelley | TikTok | `kelley-tt` | `https://{domain}/?ref=kelley-tt` |
| 44 | Mason Greene | Instagram | `masongreene` | `https://{domain}/?ref=masongreene` |
| 45 | Just Go For It Golf (Cam Widner) | Instagram | `justgoforit` | `https://{domain}/?ref=justgoforit` |
| 46 | Cleeks Golf Club | Instagram | `cleeks` | `https://{domain}/?ref=cleeks` |
| 47 | Josh Kelley Golf | YouTube | `kelley-yt` | `https://{domain}/?ref=kelley-yt` |
| 48 | Hannah Gregg | Instagram | `gregg` | `https://{domain}/?ref=gregg` |
| 49 | Roger Steele | Instagram | `steele-ig` | `https://{domain}/?ref=steele-ig` |
| 50 | Cody McGinty | Instagram | `codysbogeys` | `https://{domain}/?ref=codysbogeys` |
