/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, every week's dot moves to its place in that layout (CSS
 * transitions on an SVG). Numbers in the prose are not typed in: a <b data-fact="..."> is
 * computed here from story.json's rows, and test/story.test.mjs checks each against the
 * `check` block build_story.py computed in python. Modelled on kin-of-the-day/story. */
import { layout, monthTicks, crossings, peaks, latest, isCur, COL, STEPS, WIN, MONTHS } from './layout.js';

const fmt = (n) => n.toLocaleString('en-US');
const pct = (v) => `${v.toFixed(1)}%`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* "2022-11-20" -> "Nov 20" / "Nov 20, 2022", without a Date (no time zone can move it) */
export const day = (iso, year) => { const [y, m, d] = iso.split('-').map(Number); return `${MON[m - 1]} ${d}${year ? `, ${y}` : ''}`; };

export function numbers(D) {
  const L = latest(D), wk = L.ew % 100, [w0, w1] = D.early_weeks;
  const past = [...new Set(D.rows.filter((r) => !isCur(D, r)).map((r) => r.s))];
  const same = D.rows.filter((r) => !isCur(D, r) && r.ew % 100 === wk);
  const best = same.reduce((m, r) => (r.pos > m.pos ? r : m));
  const cross = [...crossings(D).values()];
  const earliest = cross.length ? cross.reduce((m, r) => (r.x < m.x ? r : m)) : null;
  const rev = D.rows.filter((r) => !isCur(D, r) && r.pre != null && r.ew % 100 >= w0 && r.ew % 100 <= w1)
    .map((r) => Math.abs(r.pre - r.pos));
  const ratio = (s, w) => {
    const me = D.rows.find((r) => r.s === s && r.ew % 100 === w);
    const ot = D.rows.filter((r) => r.s !== s && !isCur(D, r) && r.ew % 100 === w).map((r) => r.pos);
    return me && ot.length && Math.max(...ot) > 0 ? me.pos / Math.max(...ot) : null;
  };
  const weeks = [];
  for (let w = w0; w <= w1; w++) weeks.push(w);
  const loo = past.flatMap((s) => weeks.map((w) => [ratio(s, w), s])).filter(([v]) => v != null);
  const looMax = loo.reduce((m, x) => (x[0] > m[0] ? x : m));
  const curR = weeks.map((w) => ratio(L.s, w)).filter((v) => v != null);
  return {
    latest: L.ew, season: L.s, now: L.pos, past: past.length,
    week_best: best.pos, week_best_s: best.s, week_n: same.length,
    fewer_tests: same.filter((r) => r.n < L.n).length,
    below_peak: [...peaks(D).values()].filter((v) => v < L.pos).length,
    crossed: cross.length,
    earliest_cross: earliest ? earliest.start : null, earliest_cross_s: earliest ? earliest.s : null,
    days_ahead: earliest ? earliest.x - L.x : null,
    rev_n: rev.length, rev_max: Math.max(...rev),
    loo_n: loo.length, loo_max: looMax[0], loo_max_s: looMax[1], loo_cur_min: Math.min(...curR),
    cur_weeks: D.rows.filter((r) => isCur(D, r)).length, L, cross,
  };
}

/* "now" -> "18.9%". Unknown names throw: a typo must not render as blank */
export function fact(D, spec) {
  const N = numbers(D);
  const [f, a] = spec.split(/:(.*)/s);
  switch (f) {
    case 'now': return pct(N.now);
    case 'week': return day(N.L.start);
    case 'tests': return fmt(N.L.n);
    case 'season': return N.season;
    case 'cur_weeks': return fmt(N.cur_weeks);
    case 'past': return fmt(N.past);
    case 'first_season': return D.rows[0].s;
    case 'week_n': return fmt(N.week_n);
    case 'fewer_tests': return fmt(N.fewer_tests);
    case 'week_best': return pct(N.week_best);
    case 'week_best_s': return N.week_best_s;
    case 'times': return (N.now / N.week_best).toFixed(1);
    case 'below_peak': return fmt(N.below_peak);
    case 'crossed': return fmt(N.crossed);
    case 'earliest': return day(N.earliest_cross, true);
    case 'days_ahead': return fmt(N.days_ahead);
    case 'cross_in': { const m = MON.indexOf(a); if (m < 0) throw new Error(`no month ${a}`); return fmt(N.cross.filter((r) => +r.start.split('-')[1] === m + 1).length); }
    case 'peak': { const v = peaks(D).get(a); if (v == null) throw new Error(`no season ${a}`); return pct(v); }
    case 'rev_n': return fmt(N.rev_n);
    case 'rev_max': return N.rev_max.toFixed(1);
    case 'floor': return ((N.now - N.rev_max) / N.week_best).toFixed(1);
    case 'loo_n': return fmt(N.loo_n);
    case 'loo_max': return N.loo_max.toFixed(1);
    case 'loo_max_s': return N.loo_max_s;
    case 'loo_cur_min': return N.loo_cur_min.toFixed(1);
    default: throw new Error(`unknown fact ${spec}`);
  }
}

/* labelled dots per step: (D) -> [[row, text]] */
export const LABELS = {
  now: (D) => [[latest(D), `week of ${day(latest(D).start)}`]],
  week: (D) => { const N = numbers(D); return [[latest(D), N.season], [D.rows.find((r) => r.s === N.week_best_s && r.ew % 100 === N.latest % 100), N.week_best_s]]; },
  autumn: (D) => { const N = numbers(D); const r = N.cross.find((c) => c.start === N.earliest_cross); return r ? [[r, day(r.start, true)]] : []; },
  year: (D) => [[latest(D), 'this week']],
  control: (D) => [[latest(D), numbers(D).season]],
};

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  for (const name of Object.keys(LABELS)) for (const [r] of LABELS[name](D)) if (!r) throw new Error(`label row missing on ${name}`);

  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gBars = el('g'), gDots = el('g'), gLab = el('g', { class: 'labels' });
  svg.append(gAxis, gBars, gDots, gLab);
  plot.append(svg);
  const bars = D.rows.map(() => gBars.appendChild(el('line', { class: 'bar' })));
  const dots = D.rows.map((r) => {
    const c = gDots.appendChild(el('circle', { r: 3 }));
    c.append(el('title'));
    c.firstChild.textContent = `${r.s}, week of ${day(r.start, true)}: ${pct(r.pos)} of ${fmt(r.n)} tests`;
    return c;
  });

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    L.dots.forEach((d, k) => {
      const c = dots[k];
      c.style.transform = `translate(${d.x}px, ${d.y}px)`;
      c.setAttribute('r', d.r);
      c.style.fill = d.fill;
      c.style.opacity = d.op;
      const b = bars[k];
      b.setAttribute('x1', d.x); b.setAttribute('x2', d.x); b.setAttribute('y1', d.y0); b.setAttribute('y2', d.y1);
      b.style.stroke = d.fill;
      b.style.opacity = L.bars && d.op ? 0.9 : 0;
    });
    // axes: months along the bottom, % positive up the left, and this week's level across
    gAxis.replaceChildren();
    for (const t of monthTicks(L.win)) {
      gAxis.append(el('line', { x1: L.X(t.d), x2: L.X(t.d), y1: 0, y2: H, class: 'grid' }));
      const tx = el('text', { x: L.X(t.d) + 3, y: H + 16, class: 'tick' }); tx.textContent = t.label; gAxis.append(tx);
    }
    for (let v = 0; v <= L.top; v += 10) {
      gAxis.append(el('line', { x1: 0, x2: W, y1: L.Y(v), y2: L.Y(v), class: 'grid' }));
      const tx = el('text', { x: -6, y: L.Y(v) + 4, class: 'tick end' }); tx.textContent = `${v}%`; gAxis.append(tx);
    }
    if (name !== 'now') gAxis.append(el('line', { x1: 0, x2: W, y1: L.Y(latest(D).pos), y2: L.Y(latest(D).pos), class: 'level' }));
    gLab.replaceChildren();
    for (const [row, text] of LABELS[name](D)) {
      const d = L.dots[D.rows.indexOf(row)];
      gLab.append(el('circle', { cx: d.x, cy: d.y, r: d.r + 2.5, class: 'ring' }));
      const right = d.x < W * 0.6;
      const tx = el('text', { x: d.x + (right ? 1 : -1) * (d.r + 5), y: d.y - d.r - 3, class: `lab${right ? '' : ' end'}` });
      tx.textContent = text;
      gLab.append(tx);
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: L.dots.filter((d) => d.op > 0).length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

export { COL, WIN, MONTHS };

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
