/* Where each week's dot sits on each step of the story. Pure: no DOM, so
 * test/story.test.mjs runs every layout at several plot sizes.
 *
 * One dot per week per season since 2016-17: x is the date within the season (day 0 =
 * Oct 1), y the share of flu tests that came back positive. The window and which dots
 * are drawn and coloured change by step.
 */
/* per-dataset memo: the colour of each dot asks these, and recomputing per dot is O(n^3) */
const memo = (f) => { const m = new WeakMap(); return (D) => { if (!m.has(D)) m.set(D, f(D)); return m.get(D); }; };
export const COL = { cur: '#b8322a', past: '#1f5f8b', dim: '#c9cbd1' };
export const WIN = { early: [0, 92], year: [0, 365] };
export const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
// day of Oct 1 .. Sep 1, in a non-leap season (Feb 28): the axis only
export const MSTART = [0, 31, 61, 92, 123, 151, 182, 212, 243, 273, 304, 335];

// from the rows, not from `check`: check is python's answer, which the test compares against
export const latest = memo((D) => D.rows.reduce((m, r) => (r.ew > m.ew ? r : m)));
export const cur = (D) => latest(D).s;
export const isCur = (D, r) => r.s === cur(D);
const sameWeek = (D, r) => r.ew % 100 === latest(D).ew % 100;
const early = (D, r) => r.ew % 100 >= D.early_weeks[0] && r.ew % 100 <= D.early_weeks[1];

/* each past season's first week at or above the latest value */
export const crossings = memo((D) => {
  const now = latest(D).pos, out = new Map();
  for (const r of D.rows) if (!isCur(D, r) && r.pos >= now && !out.has(r.s)) out.set(r.s, r);
  return out;
});
export const peaks = memo((D) => {
  const p = new Map();
  for (const r of D.rows) if (!isCur(D, r)) p.set(r.s, Math.max(p.get(r.s) ?? 0, r.pos));
  return p;
});

/* step -> [window, drawn(r), colour(r) -> key of COL, range bars from first report?] */
export const STEPS = {
  now: ['early', (D, r) => isCur(D, r), () => 'cur'],
  week: ['early', (D, r) => isCur(D, r) || sameWeek(D, r), (D, r) => (isCur(D, r) ? 'cur' : 'past')],
  autumn: ['early', () => true, (D, r) => (isCur(D, r) ? 'cur' : crossings(D).get(r.s) === r ? 'past' : 'dim')],
  year: ['year', () => true, (D, r) => (isCur(D, r) ? 'cur' : peaks(D).get(r.s) < latest(D).pos ? 'past' : 'dim')],
  control: ['early', (D, r) => early(D, r), (D, r) => (isCur(D, r) ? 'cur' : r.s === looMaxSeason(D) ? 'past' : 'dim'), true],
};

/* the past season with the biggest leave-one-out same-week margin, weeks early_weeks */
export const looMaxSeason = memo((D) => {
  let best = [-1, null];
  for (const r of D.rows) {
    const w = r.ew % 100;
    if (isCur(D, r) || w < D.early_weeks[0] || w > D.early_weeks[1]) continue;
    const ot = D.rows.filter((o) => o.s !== r.s && !isCur(D, o) && o.ew % 100 === w).map((o) => o.pos);
    if (ot.length && Math.max(...ot) > 0 && r.pos / Math.max(...ot) > best[0]) best = [r.pos / Math.max(...ot), r.s];
  }
  return best[1];
});

export const yMax = (D) => Math.ceil(Math.max(...D.rows.map((r) => r.pos)) / 10) * 10;

/* -> {win, X, Y, dots: [{x, y, r, fill, op, y0, y1}] in px of a w x h box, same order as D.rows} */
export function layout(name, D, w, h) {
  const [win, drawn, colour, bars] = STEPS[name] || (() => { throw new Error(`unknown step ${name}`); })();
  const [a, b] = WIN[win], top = yMax(D), pad = 8;
  const X = (d) => pad + ((d - a) / (b - a)) * (w - 2 * pad);
  const Y = (v) => h - pad - (v / top) * (h - 2 * pad);
  const r = win === 'early' ? Math.max(4.5, Math.min(6.5, w / 60)) : Math.max(1.8, Math.min(3.2, w / 260));
  const dots = D.rows.map((row) => {
    const mid = row.x + 3; // the week's middle
    const inWin = mid >= a && mid <= b;
    const x = X(Math.min(b, Math.max(a, mid)));
    const y = Y(row.pos);
    const pre = bars && row.pre != null ? Y(row.pre) : y;
    return { x, y, r, fill: COL[colour(D, row)], op: inWin && drawn(D, row) ? 1 : 0,
      y0: Math.min(y, pre), y1: Math.max(y, pre) };
  });
  return { win, X, Y, top, bars: !!bars, dots };
}

export function monthTicks(win) {
  const [a, b] = WIN[win];
  return MSTART.map((d, i) => ({ d, label: MONTHS[i] })).filter((t) => t.d >= a && t.d < b);
}
