(() => {
  'use strict';

  const site = 'https://tharunbabu-05.github.io';
  const path = '/cinder-vigil-the-ember-swordsman';
  if (location.origin !== site || !location.pathname.startsWith(path + '/')) return;

  const api = 'https://abacus.jasoncameron.dev';
  const counter = 'tharunbabu-05-cinder-vigil/players-2026';
  const storageKey = 'cinder-vigil:player-count:v1';
  const badge = document.getElementById('player-badge');
  const total = document.getElementById('player-total');
  const format = new Intl.NumberFormat();
  let lastTotal = null;
  let submitted = false;

  function show(value) {
    if (lastTotal !== null && value < lastTotal) return;
    lastTotal = value;
    total.textContent = format.format(value);
    total.removeAttribute('aria-label');
    badge.title = 'Browsers that have started playing';
  }

  function request(action, options) {
    return fetch(`${api}/${action}/${counter}`, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...options
    });
  }

  async function showResponse(response) {
    const {value} = await response.json();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid player total');
    show(value);
  }

  async function refresh() {
    try {
      const response = await request('get', {signal: AbortSignal.timeout(7000)});
      if (response.ok) await showResponse(response);
      else if (response.status === 404 && (await response.json()).error === 'Key not found') show(0);
      else throw new Error('Could not read the player total');
    } catch {
      if (lastTotal !== null) return;
      total.setAttribute('aria-label', 'Player total unavailable');
      badge.title = 'Player total unavailable';
    }
  }

  async function submit() {
    if (localStorage.getItem(storageKey)) return;
    // Reserve before sending. The service can apply a hit even if a tab
    // closes before receiving the response.
    localStorage.setItem(storageKey, '1');
    const response = await request('hit', {keepalive: true});
    if (response.ok) await showResponse(response);
    else if (response.status === 429) {
      // A rejected hit leaves this browser eligible on a later visit.
      localStorage.removeItem(storageKey);
    }
  }

  window.playerCount = {
    recordPlay() {
      if (submitted || !navigator.onLine) return;
      submitted = true;
      const write = navigator.locks ? navigator.locks.request(storageKey, submit) : submit();
      // Storage or network errors should never interrupt gameplay.
      write.catch(() => {});
    }
  };

  badge.hidden = false;
  refresh();
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', event => {
    if (event.persisted) refresh();
  });
})();
