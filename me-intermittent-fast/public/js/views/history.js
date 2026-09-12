import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { calendarGrid } from '../charts.js';

/**
 * History — streak, four-week calendar and past sessions. Every number here is
 * computed server-side from the logged sessions (see backend/services/historyService.js);
 * this view only shades and labels them.
 */
export async function renderHistory(root) {
  const history = await api.history.get();

  const pastFastsHtml = history.pastFasts.length
    ? history.pastFasts.map((fast) => `
        <div class="past-fast">
          <div class="past-fast__head">
            <span class="past-fast__date">${escapeHtml(fast.dateLabel)}</span>
            <span class="past-fast__tag">${escapeHtml(fast.strategyLabel)}</span>
          </div>
          <div class="past-fast__meta tabular">${escapeHtml(fast.achievedLabel)}</div>
          ${fast.note ? `<div class="past-fast__note">“${escapeHtml(fast.note)}”</div>` : ''}
        </div>
      `).join('')
    : '<p class="muted empty-hint">No completed fasts yet — the first one shows up here as soon as you end it.</p>';

  root.innerHTML = `
    <div class="kicker">Analysis</div>
    <h2 class="view-heading view-heading--xl">Your history</h2>

    <div class="stat-cards">
      <div class="stat-card stat-card--brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1.5-2-1-3.5 0 0-3 1-3 3z"/><path d="M12 3c1 3-2 3-2 6a4 4 0 0 0 8 0c0-3-1-4-2-6-1 2-1 3-2 3-1 0-1-1-2-3z"/></svg>
        <div class="stat-card__value tabular">${history.streak} days</div>
        <div class="stat-card__label">Current streak</div>
      </div>
      <div class="stat-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 10-3-3"/></svg>
        <div class="stat-card__value tabular">${history.completionRate}%</div>
        <div class="stat-card__label">Completion, ${history.windowDays} days</div>
      </div>
    </div>

    <div class="form-label">Last 4 weeks</div>
    ${calendarGrid(history.calendarDays)}

    <div class="form-label">Past fasts</div>
    ${pastFastsHtml}
  `;
}
