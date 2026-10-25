# o13/pricing: creator deal pricing (task 7, area 22)

**Built:** `overnight/O13-creator-pricing.md`. A doc, no code changes.

**How:** read each creator's YouTube videos page in the built-in browser on 2026-10-11 (25 channels measured, real per-video views). TikTok showed follower counts but blocked the video grid after one load; Instagram not tried (needs a login).

**Decisions made for Trevor**
- Outlier rule. Options: drop the top video, drop over 2x median, drop over 3x median. Pick: drop any video over 3x the first median, then re-take the median.
- Fee rule. Options: flat $400 for everyone, scale by followers, scale by median views. Pick: scale by median views (under 15K $300, 15K to 49,999 $400, 50K and up $500), since views are what we pay for.
- Ranking. Options: rank everyone, rank only active channels. Pick: rank only channels with a long video in the last 6 months; Poulter, Ruffels and Gabby shown in brackets since $500 is unrealistic for them.
- Skip videos under 7 days old (views still climbing).

**Findings worth knowing:** Bad Golf (O10's top pick) has not posted in 3 years and Mully Golf not since 2022. The Golf Mates Club is a "best of" channel of Golf Mates (251K). Carter Vynckier's TikTok @cvagolf is gone; his YouTube is The DOD King (126K). Putt Buddies Golf is a gear brand.

**Left undone:** TikTok and Instagram per-post views (manual phone pass, listed in the doc). No SQL, no Vercel steps.
