# codes (task 9): creator download codes

**Built:** a code for each of the 50 creators in `overnight/O10-creators.md`, kept as data in `src/lib/creator-codes.js` (an array of `{ row, code, creator, platform }`, plus `creatorLink` and `creatorOf` helpers). `src/lib/creator-codes.test.js` checks each code is unique, passes `cleanRef` unchanged (also typed in capitals, and on `?ref` and `?via`), fits the `attribution` table's check in `supabase/2026-10-09-attribution.sql`, is 3 to 16 characters of lower-case letters, digits and single dashes, and never contains a word of `APP_NAME`. Not wired into any screen.

**Doc:** `overnight/O13-creator-codes.md`: how attribution works, where results land (PostHog events once the key is set; the `attribution` table once its SQL is run, which it hasn't been), the domain placeholder, and the full table of creator, platform, code and link.

**How to see it:** nothing on screen. Run `node --test src/lib/creator-codes.test.js`. To try a code end to end, open `https://<preview>/?ref=badgolf` on a fresh phone and check the `bb-ref` key in local storage.

**Decisions for Trevor:**
- Creators listed twice (Roger Steele, Josh Kelley): one code per platform or one per person. Picked per platform (`steele-yt`, `steele-ig`, `kelley-tt`, `kelley-yt`), so results show which platform worked.
- Codes from the creator's name or handle, dashes only, 16 characters max, so they can be said out loud.
- Every research row gets a code, even Low-fit ones. Delete freely.
- Brand-free: "Birdies in the Outfield" is `bito`, Louis Birchall is `birchall`.

**Heads-up for the lead:** the main checkout's `node_modules` (the one the brief says to symlink) has no `@sentry/browser`, so `npm run build` fails through the symlink. I ran `npm ci` in this worktree instead; the build then passes, first screen 379.78 kB of 481 kB.

**Left undone:** nothing. **SQL / Vercel:** none new. The existing `supabase/2026-10-09-attribution.sql` and the PostHog key are what make results readable.
