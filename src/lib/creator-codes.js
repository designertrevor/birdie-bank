// A download code for each creator on the S4 creator list (overnight/O10-creators.md, the row
// number is `row`). A creator's link carries ?ref=CODE and attribution.js keeps it as the phone's
// first touch, so each creator's downloads and sign-ups can be counted (overnight/O13-creator-codes.md
// says where to read them). Edit this list by hand: a code is lower-case letters and digits with
// single dashes between them, unique, and never the app's name (it's a codename and will change,
// the codes won't). creator-codes.test.js checks every rule. Not wired into any screen.
// A creator who appears on two platforms in the research gets one code per platform (-yt, -tt,
// -ig), so the results say which platform worked.

export const CREATOR_CODES = [
  // YouTube
  { row: 1, code: 'golfmatesclub', creator: 'The Golf Mates Club', platform: 'YouTube' },
  { row: 2, code: 'badgolf', creator: 'Bad Golf (John Robins and Alex Horne)', platform: 'YouTube' },
  { row: 3, code: 'ruffs', creator: 'Ryan Ruffels (RUFFS)', platform: 'YouTube' },
  { row: 4, code: 'chancetaylor', creator: 'Chance Taylor', platform: 'YouTube' },
  { row: 5, code: 'voke', creator: 'Nick Voke', platform: 'YouTube' },
  { row: 6, code: 'jamesnicholas', creator: 'James Nicholas', platform: 'YouTube' },
  { row: 7, code: 'skinstv', creator: 'Skins Golf TV', platform: 'YouTube' },
  { row: 8, code: 'adequate', creator: 'Adequate Golf', platform: 'YouTube' },
  { row: 9, code: 'cheeky', creator: 'Cheeky Golf Club', platform: 'YouTube' },
  { row: 10, code: 'notascratch', creator: 'Not A Scratch Golfer (Adam Fine)', platform: 'YouTube' },
  { row: 11, code: 'newnine', creator: 'New Nine Golf (Brandon Cubitt)', platform: 'YouTube' },
  { row: 12, code: 'sgk', creator: 'Short Game King (Daniel Saloner)', platform: 'YouTube' },
  { row: 13, code: 'postman', creator: 'Ian Poulter, The Postman', platform: 'YouTube' },
  { row: 14, code: 'hcpgolf', creator: 'Handicap Golf', platform: 'YouTube' },
  { row: 15, code: 'txg', creator: 'Tour Experience Golf (TXG)', platform: 'YouTube' },
  { row: 16, code: 'sagoo', creator: 'Pavan Sagoo', platform: 'YouTube' },
  { row: 17, code: 'mehu', creator: 'Jean-Philippe Mehu', platform: 'YouTube' },
  { row: 18, code: 'steele-yt', creator: 'Roger Steele Golfs', platform: 'YouTube' },
  { row: 19, code: 'basicbogeys', creator: 'Basic Bogeys Podcast (TJ and Gary)', platform: 'YouTube' },
  { row: 20, code: 'wolfmoney', creator: 'WOLF Money', platform: 'YouTube' },
  { row: 21, code: 'miabaker', creator: 'Mia Baker Golf', platform: 'YouTube' },
  { row: 22, code: 'camirand', creator: 'Simon Camirand', platform: 'YouTube' },
  { row: 23, code: 'charlesm', creator: 'Charles M Golf', platform: 'YouTube' },
  { row: 24, code: 'sopure', creator: 'So Pure', platform: 'YouTube' },
  { row: 25, code: 'outofregs', creator: 'OutofRegsTV', platform: 'YouTube' },
  { row: 26, code: 'notperfect', creator: 'Not a Perfect Golfer', platform: 'YouTube' },
  // TikTok
  { row: 27, code: 'gabby', creator: 'Gabby Golf Girl (Gabriella DeGasperis)', platform: 'TikTok' },
  { row: 28, code: 'cva', creator: 'Carter Vynckier', platform: 'TikTok' },
  { row: 29, code: 'mully', creator: 'Mully Golf', platform: 'TikTok' },
  { row: 30, code: 'shanks', creator: 'Case Of The Shanks', platform: 'TikTok' },
  { row: 31, code: 'zachmoore', creator: 'Zach Moore', platform: 'TikTok' },
  { row: 32, code: 'castell', creator: 'AndyCastellGolf', platform: 'TikTok' },
  { row: 33, code: 'andolpho', creator: 'Sabrina Andolpho (Golf Girl Games)', platform: 'TikTok' },
  { row: 34, code: 'puttbuddies', creator: 'Putt Buddies Golf', platform: 'TikTok' },
  { row: 35, code: 'birchall', creator: 'Louis Birchall', platform: 'TikTok' },
  { row: 36, code: 'bito', creator: 'Birdies in the Outfield (B.I.T.O. Boys)', platform: 'TikTok' },
  { row: 37, code: 'matx', creator: 'Matxtricks', platform: 'TikTok' },
  { row: 38, code: 'visionquest', creator: 'visionquestgolf', platform: 'TikTok' },
  { row: 39, code: 'macintyre', creator: 'Bob MacIntyre', platform: 'TikTok' },
  { row: 40, code: 'golfontiktok', creator: 'Golf on TikTok', platform: 'TikTok' },
  { row: 41, code: 'topspeed', creator: 'Clay Ballard (Top Speed Golf)', platform: 'TikTok' },
  { row: 42, code: 'amfirst', creator: 'Americans First', platform: 'TikTok' },
  { row: 43, code: 'kelley-tt', creator: 'Josh Kelley', platform: 'TikTok' },
  // Instagram, plus Josh Kelley's YouTube (row 47)
  { row: 44, code: 'masongreene', creator: 'Mason Greene', platform: 'Instagram' },
  { row: 45, code: 'justgoforit', creator: 'Just Go For It Golf (Cam Widner)', platform: 'Instagram' },
  { row: 46, code: 'cleeks', creator: 'Cleeks Golf Club', platform: 'Instagram' },
  { row: 47, code: 'kelley-yt', creator: 'Josh Kelley Golf', platform: 'YouTube' },
  { row: 48, code: 'gregg', creator: 'Hannah Gregg', platform: 'Instagram' },
  { row: 49, code: 'steele-ig', creator: 'Roger Steele', platform: 'Instagram' },
  { row: 50, code: 'codysbogeys', creator: 'Cody McGinty', platform: 'Instagram' },
];

/** A creator's download link: the site's address with ?ref=CODE (pass the site, e.g. SITE_URL). */
export function creatorLink(code, site) {
  return `${String(site || '').replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`;
}

/** The creator entry for a code (as it arrives through cleanRef), or null. */
export function creatorOf(code) {
  return CREATOR_CODES.find(c => c.code === code) || null;
}
