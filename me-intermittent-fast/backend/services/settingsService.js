'use strict';

const CONTAINER = 'app_settings';

const DEFAULTS = {
  profileName: 'Stephen Booysen',
  profileEmail: 'stephenrbooysen@gmail.com',
  pushNotifications: true,
  emailSummaries: false,
  // Reminders the app could raise off the plan's own clock; surfaced on Settings as toggles.
  remindFastStart: true,
  remindEatingWindow: true
};

function createSettingsService({ store, versionedCache }) {
  async function get() {
    const all = await store.list(CONTAINER);
    if (all.length > 0) return all[0];
    return store.create(CONTAINER, DEFAULTS);
  }

  async function update(patch) {
    const current = await get();
    const updated = await store.update(CONTAINER, current.id, patch);
    await versionedCache.bump();
    return updated;
  }

  return { get, update, DEFAULTS };
}

module.exports = { createSettingsService, CONTAINER, DEFAULTS };
