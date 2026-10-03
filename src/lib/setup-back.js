// What Back does in round setup. The course editor opens over the course step (so the game and
// everything picked stay put), and its Back button sits exactly where setup's own Back is. So:
//   - Back while the editor is open only closes the editor (that's the phone's back too),
//   - a second tap on the same spot just after the editor closed is a double tap, not a new Back,
//     so it stays on the course step instead of going on to the game step underneath,
//   - otherwise one step back, or out of setup from the first step (or when editing a plan).

export const TAP_THROUGH_MS = 600;
export const nowMs = () => Date.now();

/**
 * `step`: the setup step showing. `editing`: changing a plan (only the When step shows).
 * `editorOpen`: the course editor is over the step. `closedAt`: when it last closed (ms).
 * Returns { to: 'editor' } (close the editor), { to: 'stay' }, { to: 'close' } or { to: 'step', step }.
 */
export function setupBack({ step, editing = false, editorOpen = false, closedAt = -Infinity, now = nowMs() }) {
  if (editorOpen) return { to: 'editor' };
  const sinceEditor = now - closedAt;
  if (sinceEditor >= 0 && sinceEditor < TAP_THROUGH_MS) return { to: 'stay' };
  if (step === 0 || editing) return { to: 'close' };
  return { to: 'step', step: step - 1 };
}
