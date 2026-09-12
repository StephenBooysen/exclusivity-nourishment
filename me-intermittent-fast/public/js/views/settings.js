import { api } from '../api.js';
import { initials, escapeHtml } from '../format.js';
import { strategyFor, DAY_KEYS, minutesToLabel12, parseTime } from '../fasting.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../toast.js';
import { refreshCurrentRoute, invalidateProfileCache } from '../router.js';

function openProfileModal(settings) {
  openModal({
    title: 'Edit profile',
    submitLabel: 'Save',
    fields: [
      { name: 'profileName', label: 'Name', type: 'text', value: settings.profileName, required: true },
      { name: 'profileEmail', label: 'Email', type: 'text', value: settings.profileEmail }
    ],
    onSubmit: async (values) => {
      await api.settings.update(values);
      invalidateProfileCache();
      showToast('Profile updated');
      await refreshCurrentRoute();
    }
  });
}

/** The plan is edited on the Fast tab, so Settings only reflects it back. */
function planSummary(plan) {
  const strategy = strategyFor(plan.strategy);
  if (plan.strategy === '5:2') {
    const days = DAY_KEYS.filter((day) => plan.fastingDays[day]);
    return days.length ? days.join(', ') : 'No days picked';
  }
  return `${strategy.hours}h from ${minutesToLabel12(parseTime(plan.startTime))}`;
}

export async function renderSettings(root) {
  const [settings, plan] = await Promise.all([api.settings.get(), api.plan.get()]);

  const toggles = [
    { key: 'pushNotifications', label: 'Push notifications' },
    { key: 'emailSummaries', label: 'Email summaries' },
    { key: 'remindFastStart', label: 'Remind me when the fast starts' },
    { key: 'remindEatingWindow', label: 'Remind me when eating opens' }
  ];

  root.innerHTML = `
    <h2 class="view-heading">Settings</h2>

    <div class="card" style="display:flex;align-items:center;gap:14px;">
      <div class="avatar avatar--lg">${initials(settings.profileName)}</div>
      <div style="flex:1;">
        <div class="fs-15 fw-bold">${escapeHtml(settings.profileName)}</div>
        <div class="muted fs-12">${escapeHtml(settings.profileEmail || '')}</div>
      </div>
      <button class="pill" id="edit-profile">Edit</button>
    </div>

    <div class="row mb-8">
      <span class="section-label mb-0">Your plan</span>
      <button class="section-head__action" id="edit-plan">Edit plan</button>
    </div>
    <div class="card card--list">
      <div class="row-item"><span class="row-item__label">Strategy</span><span class="row-item__value">${escapeHtml(strategyFor(plan.strategy).label)}</span></div>
      <div class="row-item"><span class="row-item__label">Fasting window</span><span class="row-item__value">${escapeHtml(planSummary(plan))}</span></div>
      <div class="row-item"><span class="row-item__label">Plan length</span><span class="row-item__value">${escapeHtml(plan.planLength)}</span></div>
      <div class="row-item"><span class="row-item__label">Time format</span><span class="row-item__value muted fw-semibold">12-hour</span></div>
    </div>

    <span class="section-label">Reminders</span>
    <div class="card card--list">
      ${toggles.map((toggle) => `
        <div class="row-item">
          <span class="row-item__label">${toggle.label}</span>
          <button class="toggle ${settings[toggle.key] ? 'on' : ''}" data-toggle="${toggle.key}" aria-pressed="${Boolean(settings[toggle.key])}"><span class="toggle__knob"></span></button>
        </div>
      `).join('')}
    </div>
    <p class="muted fs-11-5 mt-neg-4 mb-16">Stage labels and eating windows are informational estimates, not medical advice.</p>
  `;

  root.querySelector('#edit-profile').addEventListener('click', () => openProfileModal(settings));
  root.querySelector('#edit-plan').addEventListener('click', () => { location.hash = '#/fast'; });

  root.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', async (e) => {
      const key = e.currentTarget.dataset.toggle;
      const next = !settings[key];
      await api.settings.update({ [key]: next });
      settings[key] = next;
      e.currentTarget.classList.toggle('on', next);
      e.currentTarget.setAttribute('aria-pressed', String(next));
    });
  });
}
