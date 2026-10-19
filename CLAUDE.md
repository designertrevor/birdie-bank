# Birdie Bank

## Roadmap

- `ROADMAP.md` is the product plan and progress checklist. Read its "Current focus" section at the start of any product or feature work.
- When a roadmap item ships, check it off with the date, and update "Current focus" and the progress log in the same change.
- New feature ideas from Trevor go into the matching area with a step tag (S1 to S5).

## Writing style

- Never use em dashes (U+2014) anywhere: UI copy, comments, docs, commit messages, or replies to the user.
  Use a comma, a period, a colon, or "so" / "and" instead. `npm run lint` fails if one slips in.
- An empty value in a table or stat uses an en dash (U+2013), not an em dash.

## Cloud sessions and overnight runs

- A cloud session is set up with its own branch (like `main-si9ums`). When an overnight brief names a branch (like `overnightN/next`), the brief wins: build and push there, and leave the session's branch alone.
- A check runs each time a cloud session stops and asks for any unpushed commits to be pushed. Every push to a `main`, `overnight*` or `feedback*` branch is a paid Vercel build, so stop only when a batch of merges is ready to push, not after each merge.
