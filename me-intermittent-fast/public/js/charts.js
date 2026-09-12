/** Small chart builders. Coordinates/percentages are computed from real data, never hand-authored. */

const RING_SIZE = 184;
const RING_RADIUS = 80;
const RING_STROKE = 14;

/**
 * The Dashboard's circular fasting progress ring. Drawn as a stroked circle
 * rotated -90° so it fills clockwise from twelve o'clock, with the percentage
 * and the countdown set inside it.
 *
 * `data-ring` / `data-ring-percent` / `data-ring-remaining` are the hooks the
 * view's per-second tick writes into, so a running fast updates without
 * re-rendering the whole card.
 */
export function progressRing({ percent, percentLabel, remainingLabel, ringLabel }) {
  const circumference = 2 * Math.PI * RING_RADIUS;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return `
    <svg class="progress-ring" width="${RING_SIZE}" height="${RING_SIZE}" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}" role="img" aria-label="${ringLabel || `${percentLabel} of the fasting window elapsed`}">
      <circle cx="92" cy="92" r="${RING_RADIUS}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${RING_STROKE}" />
      <circle data-ring cx="92" cy="92" r="${RING_RADIUS}" fill="none" stroke="var(--bg)" stroke-width="${RING_STROKE}"
        stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 92 92)" style="transition:stroke-dashoffset 0.6s ease;" />
      <text data-ring-percent x="92" y="86" text-anchor="middle" font-weight="800" font-size="34" fill="var(--bg)">${percentLabel}</text>
      <text data-ring-remaining x="92" y="110" text-anchor="middle" font-size="12" fill="var(--bg)" opacity="0.8">${remainingLabel}</text>
    </svg>
  `;
}

/** Recomputes the ring geometry in place — used by the Dashboard's tick. */
export function updateProgressRing(root, { percent, percentLabel, remainingLabel, ringLabel }) {
  const circle = root.querySelector('[data-ring]');
  if (!circle) return false;
  const circumference = 2 * Math.PI * RING_RADIUS;
  circle.setAttribute('stroke-dashoffset', (circumference * (1 - Math.min(100, Math.max(0, percent)) / 100)).toFixed(1));
  root.querySelector('[data-ring-percent]').textContent = percentLabel;
  root.querySelector('[data-ring-remaining]').textContent = remainingLabel;
  if (ringLabel) root.querySelector('.progress-ring')?.setAttribute('aria-label', ringLabel);
  return true;
}

/**
 * The four-week calendar: 28 cells under a M-T-W-T-F-S-S header, each shaded
 * by the day's outcome. Status → shade mapping lives in styles.css so the
 * legend below it can reuse the same classes.
 * @param {Array<{date:string,status:string,isToday:boolean}>} days
 */
export function calendarGrid(days) {
  const header = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label) => `<span>${label}</span>`).join('');
  const cells = days.map((day) => `
    <div class="cal-cell cal-cell--${day.status}${day.isToday ? ' cal-cell--today' : ''}" title="${day.date} · ${day.status}"></div>
  `).join('');

  return `
    <div class="cal-head">${header}</div>
    <div class="cal-grid">${cells}</div>
    <div class="legend mb-16">
      <span><i class="sq" style="background:var(--brand);"></i>Completed</span>
      <span><i class="sq" style="background:var(--mint-soft);"></i>Partial</span>
      <span><i class="sq" style="background:var(--neutral-300);"></i>Missed</span>
      <span><i class="sq" style="background:var(--neutral-100);"></i>No plan</span>
    </div>
  `;
}
