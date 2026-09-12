import { renderHome } from './views/home.js';
import { renderFast } from './views/fast.js';
import { renderHistory } from './views/history.js';
import { renderSettings } from './views/settings.js';
import { api } from './api.js';
import { initials, escapeHtml } from './format.js';

const routes = {
  home: { render: renderHome },
  fast: { render: renderFast },
  history: { render: renderHistory },
  settings: { render: renderSettings }
};

let currentRoute = 'home';
let profileCache = null;

function routeFromHash() {
  const key = (location.hash || '').replace('#/', '');
  return routes[key] ? key : 'home';
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

async function updateHeader() {
  if (!profileCache) {
    const settings = await api.settings.get();
    profileCache = { name: settings.profileName || 'Me Intermittent Fast', email: settings.profileEmail || '' };
  }
  document.getElementById('greeting').textContent = timeOfDayGreeting();
  document.getElementById('profile-name').textContent = profileCache.name;
  document.getElementById('avatar').textContent = initials(profileCache.name);
}

/** Drops the cached profile so the header re-reads settings on next render (after Settings edits it). */
export function invalidateProfileCache() {
  profileCache = null;
}

function updateChrome(routeKey) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.route === routeKey);
  });
}

export async function renderRoute(routeKey = currentRoute) {
  currentRoute = routes[routeKey] ? routeKey : 'home';
  updateChrome(currentRoute);
  await updateHeader().catch(() => {});
  const root = document.getElementById('view-root');
  root.innerHTML = '<div class="skeleton" style="height:120px;border-radius:18px;margin:20px 0;"></div>';
  try {
    await routes[currentRoute].render(root);
  } catch (err) {
    root.innerHTML = `<div class="empty-state"><p>Something went wrong loading this screen.</p><p class="muted">${escapeHtml(err.message)}</p></div>`;
  }
}

/** Re-renders whichever view is currently on screen — used after a modal save. */
export function refreshCurrentRoute() {
  return renderRoute(currentRoute);
}

export function initRouter() {
  document.getElementById('tabbar').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    location.hash = `#/${tab.dataset.route}`;
  });

  window.addEventListener('hashchange', () => renderRoute(routeFromHash()));
  renderRoute(routeFromHash());
}
