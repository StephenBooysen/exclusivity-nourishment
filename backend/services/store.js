'use strict';

/**
 * Thin CRUD wrapper over the platform-core file dataService. The provider's
 * `add()` only returns the generated key, so every record is patched with
 * its own `id` right after creation — every other method can then treat
 * `id` as an ordinary field already present on the stored JSON.
 */
function createStore(dataService) {
  return {
    async list(container) {
      return dataService.find(container, '');
    },

    async get(container, id) {
      if (!id) return null;
      return dataService.getByUuid(container, id);
    },

    async create(container, data) {
      const id = await dataService.add(container, data);
      const record = { ...data, id };
      await dataService.update(container, id, record);
      return record;
    },

    async update(container, id, patch) {
      const existing = await dataService.getByUuid(container, id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, id };
      await dataService.update(container, id, updated);
      return updated;
    },

    async remove(container, id) {
      return dataService.remove(container, id);
    }
  };
}

module.exports = { createStore };
