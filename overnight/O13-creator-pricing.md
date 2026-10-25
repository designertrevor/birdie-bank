# Creator pricing: median views and cost per view

Roadmap area 22: "take the median views of their last 10 to 15 videos, leaving out any viral outlier, then compare cost per view across creators." Overnight 13, measured 2026-10-11. Source list: `overnight/O10-creators.md`.

## Summary

**Decided by Trevor (2026-10-25):** drop Bad Golf, Mully Golf, Mia Baker Golf, Andy Castell Golf, Skins Golf TV and Adequate Golf from the list. Keep the fee-by-views rule and the 3x outlier rule. Their codes stay in `src/lib/creator-codes.js` in case one starts posting again.

This time the real pages opened. YouTube channel pages gave real per-video view counts for 25 channels, so every YouTube median below is measured, not a tracker average. TikTok profiles showed follower counts but not the video grid (TikTok blocked it after one load), and Instagram was not tried, since it needs a login. At the roadmap's $300 to $500 flat fee, **the best-value 10 that look realistic at that price** are: Nick Voke ($3.83 per 1,000 views, thin sample), The DOD King, Carter Vynckier ($5.26), Short Game King ($5.75), Chance Taylor ($6.94), Cheeky Golf Club ($7.14), The Golf Mates Club ($8.16), Not A Scratch Golfer ($8.70), Sabrina Andolpho ($10.00), Josh Kelley ($11.11) and James Nicholas ($22.22, YouTube only; his TikTok has 398.5K followers). Three names are cheaper per view on paper but will not take $500: Ian Poulter ($1.76), Ryan Ruffels ($2.75) and Gabby Golf Girl ($4.78). Treat them as stretch deals with a real quote. Five names from the O10 list have stopped posting and should come off it: Bad Golf (last video 3 years ago), Mully Golf (last TikTok February 2022), Mia Baker Golf and Andy Castell Golf (no long video for a year), plus Skins Golf TV and Adequate Golf (under 2K subscribers and inactive). One surprise: The Golf Mates Club is a "best of" channel run by Golf Mates (251K), so that deal goes through the Golf Mates team.

## Method

- **Where the numbers come from.** Each creator's YouTube `/videos` page, read in the built-in browser on 2026-10-11. YouTube rounds view counts ("31K"), so each number can be off by a few percent.
- **Which videos.** The newest 15 long videos (fewer if the channel had fewer). Videos under 7 days old were skipped, since their views are still climbing. Where long videos were thin or dead, the newest 15 Shorts were used as a proxy, and the table says so.
- **Outlier rule.** Take the median of the sample. Drop any video over 3 times that median. Take the median again. That second number is the "median" in the table.
- **Fee rule (an assumption, not a quote).** Scaled by that median, inside the roadmap's $300 to $500 range: under 15,000 views is $300, 15,000 to 49,999 is $400, 50,000 and up is $500.
- **Cost per 1,000 views** = fee divided by (median views / 1,000). Lower is better.
- **Rank** is by cost per 1,000 views, only among channels that posted a long video in the last 6 months.
- **Caveat on age.** Older videos have had longer to collect views. A sponsored video will probably reach the median only after a few months, not in its first week.
- "Measured" means read off the creator's own page on 2026-10-11. "Estimated" means a tracker number from O10 or a guess. Unknown is an en dash (–).

## The table

All YouTube numbers measured 2026-10-11 on youtube.com unless the row says otherwise. Fit is from O10.

| Rank | Creator | Platform and handle | Followers | Sample (age range) | Views of the sample, newest first | Dropped as outliers | Median | Fee (assumed) | Per 1,000 views | Fit | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| (1) | Ian Poulter | YT @ipthepostman | 112K | 15 long (2 weeks to 10 months) | 314K, 521K, 137K, 236K, 176K, 279K, 230K, 340K, 421K, 265K, 402K, 145K, 369K, 967K, 288K | 967K | 283,500 | $500 | $1.76 | Med | Tour star. $500 is not realistic; get a real quote or skip |
| (2) | Ryan Ruffels | YT @RyanRuffelsGolf | 121K | 15 long (3 weeks to 4 months) | 495K, 317K, 238K, 469K, 158K, 35K, 196K, 61K, 73K, 79K, 182K, 480K, 82K, 269K, 180K | none | 182,000 | $500 | $2.75 | High | Above the 100K range now. Likely quotes well over $500 |
| 1 | Nick Voke | YT @NickVokeGolf | 43.1K | 4 long (2 weeks to 1 month); 4 Shorts | long: 81K, 229K, 180K, 81K; Shorts: 112K, 31K, 35K, 42K | none | 130,500 long (Shorts 38,500) | $500 | $3.83 | High | Only 9 videos on the channel. Thin sample: re-check before paying |
| (3) | Gabby Golf Girl | YT @gabbygolfgirl; TikTok @gabbygolfgirl | YT 289K; TikTok 301.8K (measured) | 15 long (2 weeks to 4 months) | 1.3M, 112K, 114K, 489K, 148K, 87K, 331K, 76K, 404K, 289K, 97K, 33K, 65K, 83K, 293K | 1.3M, 489K, 404K | 104,500 | $500 | $4.78 | High | Exact format, far above budget. Stretch deal only |
| 2 | The DOD King (Carter Vynckier) | YT @Thedodking | 126K | 15 long (3 weeks to 8 months) | 208K, 231K, 95K, 242K, 65K, 68K, 185K, 44K, 30K, 155K, 48K, 118K, 41K, 54K, 178K | none | 95,000 | $500 | $5.26 | Med to High | "War Against Weasels" confirmed on the channel. TikTok @cvagolf no longer exists. Above 100K subs |
| 3 | Short Game King | YT @shortgameking | 55.9K | 15 long (2 weeks to 4 months) | 137K, 63K, 127K, 142K, 65K, 51K, 91K, 112K, 64K, 77K, 87K, 36K, 161K, 21K, 96K | none | 87,000 | $500 | $5.75 | Med | Skill content more than matches |
| 4 | Chance Taylor | YT @chancetaylorgolf | 84.7K | 15 long (2 weeks to 7 months) | 90K, 94K, 72K, 103K, 124K, 61K, 52K, 149K, 194K, 90K, 37K, 36K, 35K, 16K, 4.6K | none | 72,000 | $500 | $6.94 | High | Steady. Good on-camera match fit |
| 5 | Cheeky Golf Club | YT @cheekygolfclub | 86.2K | 15 long (2 weeks to 6 months) | 71K, 70K, 58K, 25K, 24K, 106K, 83K, 72K, 10K, 75K, 22K, 96K, 39K, 24K, 82K | none | 70,000 | $500 | $7.14 | Med to High | Posts often (904 videos). Skipped one 9-hour-old video |
| 6 | The Golf Mates Club | YT @TheGolfMatesClub | 27K | 10 long (2 to 6 months) | 50K, 48K, 35K, 84K, 60K, 46K, 34K, 58K, 29K, 65K | none | 49,000 | $400 | $8.16 | High | A "best of" channel for Golf Mates. Main channel @GolfMates: 251K subs, median 60,000 (measured) |
| 7 | Not A Scratch Golfer | YT @notascratchgolfer | 71.7K | 15 long (4 months to 1 year) | 61K, 50K, 274K, 43K, 41K, 172K, 67K, 41K, 259K, 75K, 24K, 45K, 25K, 52K, 47K | 274K, 259K, 172K | 46,000 | $400 | $8.70 | Med | Newest long video is 4 months old. Ask if he's still posting |
| 8 | Sabrina Andolpho | YT @sabrinaandolpho | 59.1K (TikTok handle has 185 followers, so not her) | 15 long (4 months to 1 year) | 35K, 20K, 50K, 38K, 25K, 56K, 139K, 120K, 36K, 28K, 38K, 62K, 105K, 100K, 91K | none | 50,000 | $500 | $10.00 | Med | Also co-runs Golf Girl Games (299K). Newest long video 4 months old |
| 9 | Josh Kelley | YT @joshkelleygolf | 149K | 15 long (1 to 8 months) | 66K, 15K, 63K, 5K, 31K, 14K, 34K, 8.1K, 40K, 12K, 101K, 38K, 152K, 63K, 54K | 152K | 36,000 | $400 | $11.11 | High | 2v2 matches. Above the range in subs |
| 10 | James Nicholas | YT @jamesnicholasgolf; TikTok @jamesnicholasgolf | YT 36.9K; TikTok 398.5K (measured) | 15 long (1 to 5 months); 15 Shorts | long: 26K, 13K, 7.7K, 8.4K, 12K, 8.2K, 18K, 22K, 37K, 10K, 49K, 28K, 11K, 27K, 26K | none | 18,000 (Shorts also 18,000) | $400 | $22.22 | High | TikTok is his big platform and could not be measured. A TikTok deal would price very differently |
| 11 | Mason Greene | YT @MasonGreeneGolf | 14.8K (IG 84.6K, estimated from O10) | 6 long (2 months to 1 year); 15 Shorts | long: 40K, 16K, 9.5K, 19K, 6.7K, 41K | none | 17,500 long (Shorts 6,250) | $400 | $22.86 | High | Instagram is his main platform; not measured |
| 12 | Roger Steele | YT @rogersteelegolfs | 13.2K (IG about 189K, estimated) | 11 long (2 weeks to 1 year) | 74K, 58K, 51K, 39K, 9K, 17K, 9.2K, 20K, 13K, 11K, 6.6K | 74K, 58K | 13,000 | $300 | $23.08 | Med | Instagram is his main platform; not measured |
| 13 | New Nine Golf | YT @NewNineGolf | 83K | 15 long (1 to 7 months) | 4.2K, 1.6K, 3.9K, 10K, 236K, 6.5K, 92K, 20K, 8.8K, 12K, 35K, 61K, 35K, 78K, 71K | 236K, 92K, 78K, 71K, 61K | 9,400 | $300 | $31.91 | Med | Views have dropped sharply: recent videos 2K to 10K, older ones 35K to 90K |
| 14 | Zach Moore | TikTok @zachmoore01; YT @Zachmooregolf | TikTok 88.1K; YT 91.2K (measured) | 15 Shorts (proxy) | 29K, 16K, 40K, 1.8K, 12K, 28K, 5.4K, 17K, 17K, 4.1M, 1.9K, 2.1K, 1.4K, 2K, 2.3K | 4.1M, 40K | 5,400 (Shorts) | $300 | $55.56 | Unknown | Long videos dead (median 176, a year old). Orlando, FL. Content still not checked |
| 15 | Handicap Golf | YT @hcpgolf | 23.5K | 15 long (2 weeks to 2 months) | 3.1K, 4.3K, 7.8K, 7.1K, 19K, 2.9K, 2.8K, 6.3K, 2.7K, 2.2K, 1.2K, 21K, 2.5K, 4.9K, 22K | 22K, 21K, 19K | 3,000 | $300 | $100.00 | Med | Poor value |
| not ranked | Bad Golf | YT @badgolf | 61.1K | 15 long (3 to 4 years old) | 31K, 39K, 23K, 46K, 32K, 88K, 51K, 37K, 35K, 34K, 26K, 29K, 45K, 43K, 49K | none | 37,000 | $400 | $10.81 | High | **Inactive.** Last upload 3 years ago. O10 called this a top pick; drop it |
| not ranked | Mia Baker Golf | YT @miaellax | 88.6K | 15 long (1 to 2 years old) | 27K, 18K, 43K, 15K, 91K, 17K, 8.6K, 20K, 26K, 67K, 32K, 31K, 36K, 54K, 52K | none | 31,000 | $400 | $12.90 | Low to Med | No long video in a year |
| not ranked | Andy Castell Golf | YT @AndyCastellGolf; TikTok @andycastellgolf | YT 32.7K; TikTok 15.6K (measured) | 15 long (all about 1 year old); 10 Shorts | long: 9.5K, 5.8K, 19K, 12K, 10K, 14K, 13K, 30K, 5.6K, 9.4K, 12K, 19K, 15K, 13K, 35K | none | 13,000 (Shorts 10,000) | $300 | $23.08 | Med | No long video in a year. O10's TikTok avg of 58.4K (Modash, estimated) could not be checked |
| not ranked | Mully Golf | TikTok @mullygolf_ | 57.7K (measured) | 16 TikToks (Dec 2021 to Feb 2022) | 205K, 16.9K, 102.1K, 605.8K, 176.1K, 21.1K, 23.5K, 132.7K, 233K, 371.2K, 491K, 430.7K, 116.5K, 113.3K, 207.3K, 22.3K | 605.8K, 491K | 124,600 | $500 | $4.01 | Unknown | **Inactive.** Newest post is 2022-02-06 (read from the video ids). Drop it |
| not ranked | Skins Golf TV | YT @SkinsGolfTV | 1.66K | 15 long (2 to 5 years old) | mostly 150 to 800 | 157K, 12K, 3K, 2.8K | 324 | – | – | High | Tiny and inactive |
| not ranked | Adequate Golf | YT @adequategolf | 898 | 15 long (3 years old) | mostly 200 to 900 | 35K, 4.5K, 3.4K, 2.4K | 686 | – | – | High | Tiny and inactive |
| not ranked | Pavan Sagoo | YT @pavansagoo | 2.6K | newest 5 months old | 1.5K, 1.5K, 1.8K, 16K, 13K, 9.7K, then 700 to 21K | – | about 1,500 (recent) | – | – | Med | Appears in other creators' matches; own channel too small to sponsor |
| not ranked | Case Of The Shanks | TikTok @caseoftheshanks | 78.3K (measured) | grid blocked | – | – | – | – | – | Unknown | Bio says it's the personal account of @maxmarkelgolf |
| not ranked | Putt Buddies Golf | TikTok @puttbuddiesgolf | 10.4K (measured) | grid blocked | – | – | – | – | – | Low | Bio: "Officially Licensed and Collectible Golf Gear". A gear brand, not a creator. Drop it |

For reference (measured, too big for the budget): Fore Bros Golf @ForeBrosGolf, 315K subs, median 286,000 (2 weeks to 3 months).

Not measured tonight: TXG (no channel found under the handles tried), Jean-Philippe Mehu, Basic Bogeys (152 subs), WOLF Money, and the Instagram-only names (Just Go For It Golf, Cleeks Golf Club, Hannah Gregg, Cody McGinty), plus the remaining TikTok rows.

## What to re-check by hand on your phone

1. **TikTok views.** Open each TikTok and read the view counts on the last 15 posts (skip pinned ones): James Nicholas, Zach Moore, Case Of The Shanks, Gabby Golf Girl, Andy Castell, Carter Vynckier's new handle. TikTok showed follower counts but blocked the video grid.
2. **Instagram Reels** for Mason Greene, Roger Steele and Just Go For It Golf, whose main audience is there.
3. **Nick Voke.** Only 4 long videos. Look again in a month before ranking him first.
4. **The Golf Mates Club.** Find out who to talk to at Golf Mates, and whether a post on the "best of" channel is on offer.
5. **Real quotes.** The fee is my assumption. Ask each of the top 10 for a flat price for one video with reuse rights. If a quote is above $500, recompute: fee divided by (median / 1,000).
6. **Format check.** For the top 10, watch two recent videos and confirm they still film matches with stakes. Short Game King and Cheeky Golf Club are the least sure.
7. **Still posting.** Not A Scratch Golfer and Sabrina Andolpho have not posted a long video in 4 months.
