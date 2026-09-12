import { api } from '../api.js';
import {
  STRATEGIES, DAY_KEYS, PLAN_LENGTHS,
  eatingWindow, combineDateTime, toDateIso, relativeDateLabel, msToHM
} from '../fasting.js';
import { showToast } from '../toast.js';

/**
 * Setup — "Set your fast". Edits a local draft of the plan and only commits it
 * on "Start fasting plan", which also opens the first fast and hands off to the
 * Dashboard. Changing the strategy immediately swaps the fields below it
 * (day pills for 5:2, eating window for the daily strategies) and every number
 * derived from them.
 *
 * The start date and time together decide when the plan's Day 1 begins. Pick a
 * moment still to come and the fast is scheduled rather than started; pick one
 * already past and it backdates a fast already under way.
 */
export async function renderFast(root) {
  const plan = await api.plan.get();
  const scheduledFor = plan.planStartedAt && new Date(plan.planStartedAt) > new Date()
    ? toDateIso(plan.planStartedAt)
    : toDateIso(new Date());
  const draft = {
    strategy: plan.strategy,
    // Prefilled from an already-scheduled plan so revisiting this screen to
    // look at it doesn't silently drag the start back to today.
    startDate: scheduledFor,
    startTime: plan.startTime,
    fastingDays: { ...plan.fastingDays },
    planLength: plan.planLength
  };

  /** Plain-language echo of the picked moment, so the choice is legible before committing. */
  function startSummary() {
    const begins = combineDateTime(draft.startDate, draft.startTime);
    const deltaMs = begins.getTime() - Date.now();
    const when = `${relativeDateLabel(begins)} at ${new Intl.DateTimeFormat('en-ZA', { hour: 'numeric', minute: '2-digit', hour12: true }).format(begins)}`;
    if (deltaMs > 60000) return `Scheduled — begins ${when}, in ${msToHM(deltaMs)}.`;
    if (deltaMs < -60000) return `Backdated — counted as having begun ${when}, ${msToHM(-deltaMs)} ago.`;
    return 'Begins as soon as you start the plan.';
  }

  function strategyCards() {
    return Object.values(STRATEGIES).map((strategy) => `
      <button type="button" class="strategy-card ${strategy.key === draft.strategy ? 'is-selected' : ''}" data-strategy="${strategy.key}">
        <div class="strategy-card__name">${strategy.label}</div>
        <div class="strategy-card__blurb">${strategy.blurb}</div>
      </button>
    `).join('');
  }

  function dayPills() {
    return DAY_KEYS.map((day) => `
      <button type="button" class="day-pill ${draft.fastingDays[day] ? 'is-on' : ''}" data-day="${day}" aria-pressed="${Boolean(draft.fastingDays[day])}">${day}</button>
    `).join('');
  }

  function draw() {
    const is52 = draft.strategy === '5:2';
    const window = eatingWindow(draft);

    root.innerHTML = `
      <div class="kicker">New plan</div>
      <h2 class="view-heading view-heading--xl">Set your fast</h2>

      <div class="form-label">Fasting strategy</div>
      <div class="strategy-grid">${strategyCards()}</div>

      ${is52 ? `
        <div class="form-label">Fasting days</div>
        <div class="day-pills">${dayPills()}</div>
        <p class="helper-text">Pick two non-consecutive days for a full 24h fast; every other day eats normally.</p>
      ` : ''}

      <div class="field-row">
        <div class="field field--plain">
          <label for="start-date">Fast begins on</label>
          <input id="start-date" type="date" value="${draft.startDate}" />
        </div>
        <div class="field field--plain">
          <label for="start-time">Fast begins at</label>
          <input id="start-time" type="time" value="${draft.startTime}" />
        </div>
      </div>
      <p class="helper-text" data-start-summary>${startSummary()}</p>

      ${is52 ? '' : `
        <div class="stat-tiles">
          <div class="stat-tile">
            <div class="stat-tile__label">Opens</div>
            <div class="stat-tile__value" data-opens>${window.opensLabel}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-tile__label">Closes</div>
            <div class="stat-tile__value" data-closes>${window.closesLabel}</div>
          </div>
        </div>
      `}

      <div class="form-label">Plan length</div>
      <div class="segmented">
        ${PLAN_LENGTHS.map((length) => `
          <button type="button" class="segmented__item ${length === draft.planLength ? 'active' : ''}" data-length="${length}">${length}</button>
        `).join('')}
      </div>

      <button class="btn btn--primary btn--cta" id="start-plan">Start fasting plan</button>
    `;

    root.querySelectorAll('[data-strategy]').forEach((card) => {
      card.addEventListener('click', () => {
        draft.strategy = card.dataset.strategy;
        draw();
      });
    });

    root.querySelectorAll('[data-day]').forEach((pill) => {
      pill.addEventListener('click', () => {
        draft.fastingDays[pill.dataset.day] = !draft.fastingDays[pill.dataset.day];
        draw();
      });
    });

    root.querySelectorAll('[data-length]').forEach((option) => {
      option.addEventListener('click', () => {
        draft.planLength = option.dataset.length;
        draw();
      });
    });

    // The eating-window tiles and the start summary track the pickers live,
    // patched in place rather than redrawn — a redraw would pull focus out of
    // the field mid-edit. The tiles are absent for 5:2, hence the optional hops.
    function syncStartFields() {
      const next = eatingWindow(draft);
      root.querySelector('[data-opens]')?.replaceChildren(next.opensLabel);
      root.querySelector('[data-closes]')?.replaceChildren(next.closesLabel);
      root.querySelector('[data-start-summary]').textContent = startSummary();
    }

    root.querySelector('#start-time')?.addEventListener('input', (e) => {
      if (!e.target.value) return;
      draft.startTime = e.target.value;
      syncStartFields();
    });

    root.querySelector('#start-date')?.addEventListener('input', (e) => {
      // Cleared or half-typed dates arrive as '' — keep the last good value.
      if (!e.target.value) return;
      draft.startDate = e.target.value;
      syncStartFields();
    });

    root.querySelector('#start-plan').addEventListener('click', async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        const { activeFast } = await api.plan.start(draft);
        const begins = new Date(activeFast.startedAt);
        showToast(begins > new Date()
          ? `Plan set — your fast starts ${relativeDateLabel(begins)} at ${new Intl.DateTimeFormat('en-ZA', { hour: 'numeric', minute: '2-digit', hour12: true }).format(begins)}`
          : 'Plan started — your fast is running');
        location.hash = '#/home';
      } catch (err) {
        button.disabled = false;
        showToast(err.message);
      }
    });
  }

  draw();
}
