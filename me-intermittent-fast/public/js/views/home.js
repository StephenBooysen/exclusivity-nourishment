import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { fastProgress, msToHM } from '../fasting.js';
import { progressRing, updateProgressRing } from '../charts.js';
import { showToast } from '../toast.js';

/**
 * Dashboard — today's fast. The ring, countdown, elapsed time and stage label
 * are all derived from (startedAt, targetMs) and repainted every second from a
 * single ticker; nothing is polled from the server while a fast runs.
 */
const TICK_MS = 1000;

let ticker = null;

/** What the card shows between fasts: the plan's target previewed at 0%. */
function idleProgress(targetMs) {
  return {
    percent: 0,
    scheduled: false,
    percentLabel: '0%',
    remainingLabel: `${msToHM(targetMs)} target`,
    ringLabel: 'No fast running',
    elapsedLabel: '0h 00m',
    stageLabel: 'Ready when you are'
  };
}

export async function renderHome(root) {
  clearInterval(ticker);
  let data = await api.dashboard.get();

  function currentProgress() {
    return data.activeFast ? fastProgress(data.activeFast, data.targetMs) : idleProgress(data.targetMs);
  }

  function notesHtml() {
    const notes = (data.activeFast && data.activeFast.notes) || [];
    if (!notes.length) {
      const hint = currentProgress().scheduled
        ? 'Notes start once this fast begins.'
        : (data.activeFast ? 'No notes yet — log how this one is going.' : 'Notes are logged against a running fast.');
      return `<p class="muted empty-hint">${hint}</p>`;
    }
    return notes.map((note) => `
      <div class="note-card">
        <div class="note-card__time">${escapeHtml(note.label)}</div>
        <div class="note-card__text">${escapeHtml(note.text)}</div>
      </div>
    `).join('');
  }

  /**
   * Repaints only the values that move. Self-cancelling: once the card has left
   * the DOM (the user navigated away), the interval stops itself rather than
   * relying on the router to tear it down.
   */
  function startTicker() {
    clearInterval(ticker);
    if (!data.activeFast) return;
    const startedScheduled = currentProgress().scheduled;
    ticker = setInterval(() => {
      const card = root.querySelector('[data-progress-card]');
      if (!card || !document.body.contains(card)) {
        clearInterval(ticker);
        return;
      }
      const progress = currentProgress();
      // A scheduled fast coming due changes more than the moving numbers — the
      // button becomes "End fast early" and the note form unlocks — and those
      // are only written on a draw, so hand back to one at the moment it begins.
      if (startedScheduled && !progress.scheduled) {
        clearInterval(ticker);
        draw();
        return;
      }
      updateProgressRing(card, progress);
      card.querySelector('[data-stage]').textContent = progress.stageLabel;
      root.querySelector('[data-elapsed]').textContent = progress.elapsedLabel;
    }, TICK_MS);
  }

  /** Three states, not two: a scheduled fast hasn't begun, so there's nothing to end — only to call off. */
  function toggleLabel(progress) {
    if (!data.activeFast) return 'Start fast';
    return progress.scheduled ? 'Cancel fast' : 'End fast early';
  }

  function draw() {
    if (!data.plan.planStartedAt) {
      root.innerHTML = `
        <div class="empty-state">
          <p>No fasting plan yet.</p>
          <p class="muted">Pick a strategy and a start time, and today’s fast begins straight away.</p>
          <button class="btn btn--primary btn--cta" id="go-to-setup">Set your fast</button>
        </div>
      `;
      root.querySelector('#go-to-setup').addEventListener('click', () => { location.hash = '#/fast'; });
      return;
    }

    const progress = currentProgress();
    // A fast under way, as opposed to idle or merely scheduled. Drives the
    // card's orange treatment and the note form: a scheduled fast has no
    // elapsed time to timestamp notes against, so the form stays locked.
    const isRunning = Boolean(data.activeFast) && !progress.scheduled;

    root.innerHTML = `
      <div class="progress-card${isRunning ? ' progress-card--running' : ''}" data-progress-card>
        <span class="progress-card__tag">${escapeHtml(data.tagLabel)}</span>
        ${progressRing(progress)}
        <div class="progress-card__stage" data-stage>${progress.stageLabel}</div>
        <button class="btn btn--on-brand" id="toggle-fast">${toggleLabel(progress)}</button>
      </div>

      <div class="stat-tiles">
        <div class="stat-tile">
          <div class="stat-tile__label">${escapeHtml(data.startedAtTileLabel || 'Started')}</div>
          <div class="stat-tile__value">${data.startedAtLabel}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__label">Elapsed</div>
          <div class="stat-tile__value tabular" data-elapsed>${progress.elapsedLabel}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile__label">Eating opens</div>
          <div class="stat-tile__value">${data.eatingOpensLabel}</div>
        </div>
      </div>

      <div class="row row--baseline mb-10">
        <span class="section-head__title">Notes</span>
        <span class="fs-12 muted">${((data.activeFast && data.activeFast.notes) || []).length} logged</span>
      </div>
      ${notesHtml()}

      <form class="note-form" id="note-form">
        <input id="note-text" type="text" placeholder="Log how you're feeling…" autocomplete="off"
          ${isRunning ? '' : 'disabled'} aria-label="Note" />
        <button type="submit" class="icon-btn icon-btn--brand" aria-label="Add note" ${isRunning ? '' : 'disabled'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </form>
    `;

    root.querySelector('#toggle-fast').addEventListener('click', async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        // Recomputed rather than closed over: the card may have been drawn
        // while the fast was still scheduled and come due since.
        const now = currentProgress();
        if (!data.activeFast) {
          await api.fasts.start();
          showToast('Fast started');
        } else if (now.scheduled) {
          await api.fasts.cancel();
          showToast('Scheduled fast cancelled');
        } else {
          await api.fasts.end();
          showToast('Fast logged to your history');
        }
        data = await api.dashboard.get();
        draw();
      } catch (err) {
        button.disabled = false;
        showToast(err.message);
      }
    });

    root.querySelector('#note-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = root.querySelector('#note-text');
      const text = input.value.trim();
      if (!text) return;
      try {
        const updated = await api.fasts.addNote(text);
        data = { ...data, activeFast: updated };
        draw();
      } catch (err) {
        showToast(err.message);
      }
    });

    startTicker();
  }

  draw();
}
