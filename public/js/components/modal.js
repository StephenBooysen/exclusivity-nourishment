import { escapeHtml } from '../format.js';

const root = () => document.getElementById('modal-root');

export function closeModal() {
  const el = root();
  el.hidden = true;
  el.innerHTML = '';
}

function renderField(field) {
  const value = field.value ?? '';
  if (field.type === 'checkbox') {
    return `
      <div class="field">
        <label class="checkbox-label">
          <input id="f-${field.name}" name="${field.name}" type="checkbox" ${value ? 'checked' : ''} />
          ${field.label}
        </label>
      </div>
    `;
  }
  if (field.type === 'select') {
    return `
      <div class="field">
        <label for="f-${field.name}">${field.label}</label>
        <select id="f-${field.name}" name="${field.name}">
          ${field.options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
        </select>
      </div>
    `;
  }
  return `
    <div class="field">
      <label for="f-${field.name}">${field.label}</label>
      <input id="f-${field.name}" name="${field.name}" type="${field.type || 'text'}"
        value="${escapeHtml(value)}" ${field.required ? 'required' : ''}
        placeholder="${escapeHtml(field.placeholder || '')}" />
    </div>
  `;
}

/**
 * Generic bottom-sheet form modal.
 * @param {{title:string, fields:Array<Object>, submitLabel?:string,
 *   onSubmit:(values:Object)=>Promise<void>, onDelete?:()=>Promise<void>, deleteLabel?:string}} config
 */
export function openModal({ title, fields, submitLabel = 'Save', onSubmit, onDelete, deleteLabel = 'Remove' }) {
  const el = root();
  el.hidden = false;
  el.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__head">
        <span class="modal-sheet__title">${title}</span>
        <button type="button" class="icon-btn" data-close aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <form id="modal-form">
        ${fields.map(renderField).join('')}
        <p id="modal-error" class="modal-error"></p>
        <div class="modal-actions">
          ${onDelete ? `<button type="button" class="btn btn--ghost btn--danger" id="modal-delete">${deleteLabel}</button>` : ''}
          <button type="submit" class="btn btn--primary">${submitLabel}</button>
        </div>
      </form>
    </div>
  `;

  el.querySelector('[data-close]').addEventListener('click', closeModal);
  el.addEventListener('click', (e) => { if (e.target === el) closeModal(); });

  const form = el.querySelector('#modal-form');
  const errorEl = el.querySelector('#modal-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    for (const field of fields) {
      const input = form.elements[field.name];
      if (!input) continue;
      values[field.name] = field.type === 'checkbox' ? input.checked : input.value;
    }
    try {
      await onSubmit(values);
      closeModal();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('is-visible');
    }
  });

  if (onDelete) {
    el.querySelector('#modal-delete').addEventListener('click', async () => {
      try {
        await onDelete();
        closeModal();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.add('is-visible');
      }
    });
  }
}
