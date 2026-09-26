// Made-up GolfCourseAPI responses, shaped like the v1.2.0 docs (api.golfcourseapi.com/docs/api/).
// Used by the unit tests and by the dev-only sample switch (VITE_COURSE_SAMPLES=1).
// The courses are fictional, so nobody plays a round off them by mistake.

/** Hole rows as the API sends them: { par, yardage, handicap }. A null handicap is left out. */
function holes(pars, hdcps, yards) {
  return pars.map((par, i) => {
    const h = { par, yardage: yards[i] };
    if (hdcps[i] != null) h.handicap = hdcps[i];
    return h;
  });
}
const sum = a => a.reduce((x, y) => x + y, 0);
function tee(name, rating, slope, pars, hdcps, yards) {
  return {
    tee_name: name, course_rating: rating, slope_rating: slope,
    total_yards: sum(yards), total_meters: Math.round(sum(yards) * 0.9144),
    number_of_holes: pars.length, par_total: sum(pars),
    holes: holes(pars, hdcps, yards),
  };
}

// Pine Hollow: 18 holes, men's and women's tees, women's hole handicaps differ from the men's.
const PH_PAR = [4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5];
const PH_HCP_M = [7, 3, 17, 1, 11, 15, 9, 5, 13, 8, 2, 18, 4, 12, 6, 16, 14, 10];
const PH_HCP_F = [5, 1, 17, 3, 11, 15, 9, 7, 13, 6, 4, 18, 2, 12, 8, 16, 14, 10];
const PH_BLACK = [412, 545, 188, 441, 380, 172, 402, 560, 395, 405, 438, 165, 552, 372, 420, 190, 388, 530];
const PH_BLUE = PH_BLACK.map(y => y - 22);
const PH_WHITE = PH_BLACK.map(y => y - 48);
const PH_RED = PH_BLACK.map(y => y - 90);

// Cedar Ridge: 9 holes, 9-hole ratings.
const CR_PAR = [4, 4, 3, 5, 4, 3, 4, 4, 5];
const CR_HCP = [3, 7, 15, 1, 11, 17, 5, 13, 9];
const CR_WHITE = [365, 340, 150, 480, 322, 138, 355, 310, 470];

// Lakeside: 18 holes, one tee, three holes with no handicap and a tee with no slope.
const LS_PAR = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 4];
const LS_HCP = [9, 3, null, 1, 13, 5, 17, 11, 7, 10, null, 2, 6, 14, 4, 18, null, 12];
const LS_BLUE = [380, 402, 165, 510, 350, 390, 140, 360, 495, 370, 155, 415, 520, 330, 400, 175, 340, 385];

export const SAMPLE_SEARCH = {
  courses: [
    {
      id: '7k2m9qb4', club_name: 'Pine Hollow Golf Club', course_name: 'Pine Hollow Golf Club',
      location: { address: '1800 Hollow Rd, Logan, UT 84321, USA', city: 'Logan', state: 'UT', country: 'United States', latitude: 41.7355, longitude: -111.8344 },
      tees: { male: 3, female: 2 },
    },
    {
      id: 'c3dr9h2x', club_name: 'Cedar Ridge', course_name: 'Cedar Ridge Golf Course',
      // Like the docs' search example: only an address, no city or state fields
      location: { address: '45 Ridge Loop, Heber City, UT 84032, USA', latitude: 40.5070, longitude: -111.4135 },
      tees: { male: 2, female: 1 },
    },
    {
      id: 'k8sd4m1v', club_name: 'Lakeside Municipal Golf Course', course_name: 'Lakeside Municipal Golf Course',
      location: { address: '900 Shore Dr, Provo, UT 84601, USA', city: 'Provo', state: 'UT', country: 'United States' },
      tees: { male: 1 },
    },
    {
      id: 'p9ncr3st', club_name: 'Pine Hollow Golf Club', course_name: 'Executive Course',
      location: { address: '1800 Hollow Rd, Logan, UT 84321, USA', city: 'Logan', state: 'UT', country: 'United States' },
      tees: { male: 1 },
    },
  ],
};

export const SAMPLE_COURSES = {
  '7k2m9qb4': {
    id: '7k2m9qb4', club_name: 'Pine Hollow Golf Club', course_name: 'Pine Hollow Golf Club',
    scorecard_url: 'https://example.com/scorecards/pine-hollow.pdf',
    location: SAMPLE_SEARCH.courses[0].location,
    tees: {
      male: [
        tee('Black', 73.4, 135, PH_PAR, PH_HCP_M, PH_BLACK),
        tee('Blue', 71.2, 129, PH_PAR, PH_HCP_M, PH_BLUE),
        tee('White', 69.0, 122, PH_PAR, PH_HCP_M, PH_WHITE),
      ],
      female: [
        tee('White', 74.6, 133, PH_PAR, PH_HCP_F, PH_WHITE),
        tee('Red', 71.8, 126, PH_PAR, PH_HCP_F, PH_RED),
      ],
    },
  },
  'c3dr9h2x': {
    id: 'c3dr9h2x', club_name: 'Cedar Ridge', course_name: 'Cedar Ridge Golf Course',
    location: SAMPLE_SEARCH.courses[1].location,
    tees: {
      male: [
        tee('White', 34.6, 118, CR_PAR, CR_HCP, CR_WHITE),
        tee('Gold', 33.1, 112, CR_PAR, CR_HCP, CR_WHITE.map(y => y - 30)),
      ],
      female: [tee('Red', 35.9, 121, CR_PAR, CR_HCP, CR_WHITE.map(y => y - 60))],
    },
  },
  'k8sd4m1v': {
    id: 'k8sd4m1v', club_name: 'Lakeside Municipal Golf Course', course_name: 'Lakeside Municipal Golf Course',
    location: SAMPLE_SEARCH.courses[2].location,
    tees: {
      male: [
        tee('Blue', 70.1, 124, LS_PAR, LS_HCP, LS_BLUE),
        tee('White', 68.4, undefined, LS_PAR, LS_HCP, LS_BLUE.map(y => y - 25)),
      ],
      female: [],
    },
  },
  // Listed in search but has no hole data yet, so it can't be used
  'p9ncr3st': {
    id: 'p9ncr3st', club_name: 'Pine Hollow Golf Club', course_name: 'Executive Course',
    location: SAMPLE_SEARCH.courses[3].location,
    tees: { male: [{ tee_name: 'White', course_rating: 58.2, slope_rating: 94, total_yards: 3100, number_of_holes: 18, par_total: 60, holes: [] }] },
  },
};
