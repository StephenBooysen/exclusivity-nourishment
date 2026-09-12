const dateFormatter = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' });

export function formatDate(value) {
  if (!value) return '';
  return dateFormatter.format(new Date(value));
}

export function formatShortDate(value) {
  if (!value) return '';
  return shortDateFormatter.format(new Date(value));
}

export function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';
}

/**
 * Escapes user-entered text (fasting notes, profile name) before it goes into
 * a template string — views render raw HTML, so anything typed by the user has
 * to be neutralised on the way in.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
