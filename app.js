(() => {
  'use strict';
  const API_BASE = 'https://ppc-finder-api.rakh-dash1005.workers.dev';
  const $ = (id) => document.getElementById(id);
  // New storage key prevents old prototype imports from retaining external source links.
  const STORAGE_FAVORITES = 'postmark-trail:favorites:v2';
  const placeOptions = {
    bbs: ['Bhubaneshwar GPO', 20.272028080698117, 85.83368893732698],
    puri: ['Puri HO', 19.800627768493435, 85.82642540137608],
    cuttack: ['Cuttack GPO', 20.47524496650716, 85.87537189599502],
    konark: ['Konark SO', 19.89046051681591, 86.09858469288149]
  };
  const parseStore = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  let records = [];
  let searchRequestId = 0;
  let favorites = new Set(Array.isArray(parseStore(STORAGE_FAVORITES)) ? parseStore(STORAGE_FAVORITES) : []);
  let point = null, gpsRequest = 0, savedOnly = false;
  const html = (val) => String(val ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const toDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('.') : 'Date unknown';

  const officeKey = (r) =>
    [
      r.postOffice.trim().toLowerCase(),
      r.pin,
      r.district.toLowerCase(),
      r.state.toLowerCase()
    ].join('|');
  function updateLocationStatus(message, type = 'neutral') {
    const el = $('location-status');
    el.className = 'location-status' + (type === 'ok' ? ' success' : type === 'error' ? ' failed' : '');
    el.querySelector('span:last-child').textContent = message;
    $('clear-location').hidden = !point;
  }
  async function loadNearby() {

    const requestId = ++searchRequestId;

    if (!point) {
      records = [];
      renderMetrics();
      updateResults();
      return;
    }

    const radius = Number(
      $('radius-select').value
    );

    const url = new URL(
      `${API_BASE}/api/nearby`
    );

    url.searchParams.set(
      'lat',
      point.latitude
    );

    url.searchParams.set(
      'lng',
      point.longitude
    );

    url.searchParams.set(
      'radius',
      radius
    );

    $('results-notice').textContent =
      'Searching nearby post offices...';

    $('results-list').innerHTML = '';

    try {

      const response = await fetch(
        url.toString(),
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.results)) {
        throw new Error('Invalid API response');
      }

      // Ignore responses from outdated searches.
      if (requestId !== searchRequestId) {
        return;
      }

      records = data.results
        .filter(r =>
          r.distanceKm !== null &&
          r.distanceKm !== undefined &&
          Number.isFinite(Number(r.distanceKm))
        )
        .map(r => ({
          ...r,
          distanceKm: Number(r.distanceKm)
        }));

      renderMetrics();
      updateResults();

    } catch (error) {

      if (requestId !== searchRequestId) {
        return;
      }

      console.error(
        'PPC API error:',
        error
      );

      records = [];

      renderMetrics();
      updateResults();

      $('results-notice').textContent =
        'Unable to load nearby PPCs. Please try again.';

    }

  }
  function setPoint(latitude, longitude, label, kind = 'manual') {
    point = { latitude, longitude, label, kind };
    updateLocationStatus((kind === 'gps' ? 'Location found' : `Using ${label}`) + ' · distances are straight-line estimates', 'ok');
    $('manual-place').value = kind === 'manual-select' ? Object.keys(placeOptions).find(k => placeOptions[k][0] === label) || '' : '';
    loadNearby();
  }
  function requestLocation(automatic = false) {

    gpsRequest++;

    const requestId = gpsRequest;

    if (!window.isSecureContext) {
      updateLocationStatus(
        'Location requires HTTPS. Choose a reference location below.',
        'error'
      );
      return;
    }

    if (!navigator.geolocation) {
      updateLocationStatus(
        'Location is not supported in this browser.',
        'error'
      );
      return;
    }

    updateLocationStatus(
      automatic
        ? 'Checking your location…'
        : 'Refreshing your current location…'
    );

    navigator.geolocation.getCurrentPosition(

      // SUCCESS
      position => {

        if (gpsRequest !== requestId) return;

        const help = $('location-help');

        if (help) {
          help.hidden = true;
          help.open = false;
        }

        setPoint(
          position.coords.latitude,
          position.coords.longitude,
          'current location',
          'gps'
        );

      },

      // ERROR
      error => {

        if (gpsRequest !== requestId) return;

        let message;

        if (error.code === 1) {

          message =
            'Location access is blocked. Follow the instructions below to enable it.';

          const help = $('location-help');

          if (help) {
            help.hidden = false;
            help.open = true;
          }

        } else if (error.code === 2) {

          message =
            'Your current location could not be determined.';

        } else {

          message =
            'Location request timed out. Please try again.';

        }

        updateLocationStatus(message, 'error');

      },

      // GPS OPTIONS
      {
        enableHighAccuracy: true,
        maximumAge: automatic ? 60000 : 0,
        timeout: 15000
      }

    );
  }
  function currentOffices() {
    const terms = $('search-input').value.toLocaleLowerCase().trim();
    const radius = Number($('radius-select').value);
    const selected = records.filter(r => Number.isFinite(r.distanceKm) && !['Not Working', 'Withdrawn'].includes(r.recordStatus) && (
      !terms || [r.title, r.postOffice, r.pin, r.district, r.state].some(x => String(x ?? '').toLocaleLowerCase().includes(terms))
    ));
    const grouped = new Map();
    for (const r of selected) {
      const key = officeKey(r);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          postOffice: r.postOffice,
          pin: r.pin,
          district: r.district,
          state: r.state,

          // Coordinates received from Cloudflare API
          latitude: r.latitude,
          longitude: r.longitude,

          marks: [],

          // Distance already calculated by Cloudflare
          distance: r.distanceKm
        });
      }
      grouped.get(key).marks.push(r);
    }
    const all = [...grouped.values()].filter(g =>
      g.distance <= radius &&
      (!savedOnly || favorites.has(g.key))
    );
    all.sort((a, b) => point ? (a.distance - b.distance) || a.postOffice.localeCompare(b.postOffice) : a.state.localeCompare(b.state) || a.district.localeCompare(b.district) || a.postOffice.localeCompare(b.postOffice));
    return all;
  }
  function renderMetrics() {

    $('metric-cancellations').textContent =
      String(records.length);

    $('metric-offices').textContent =
      String(new Set(
        records.map(officeKey)
      ).size);

    $('metric-states').textContent =
      String(new Set(
        records.map(r => r.state)
      ).size);

    $('catalogue-label').textContent =
      'EXPLORE INDIA’S POSTAL HERITAGE';

  }
  function renderCard(g) {
    // The sole external destination is an optional Google Maps navigation action.
    // Use post office coordinates from Cloudflare API
    const destination =
      Number.isFinite(g.latitude) &&
        Number.isFinite(g.longitude)
        ? `${g.latitude},${g.longitude}`
        : [
          g.postOffice,
          g.pin,
          g.district,
          g.state,
          'India'
        ].join(', ');

    // Google Maps navigation URL
    const directions =
      'https://www.google.com/maps/dir/?api=1' +
      '&destination=' + encodeURIComponent(destination) +
      '&travelmode=driving';

    const title = html(g.postOffice), key = html(g.key);
    const dist = g.distance !== null ? `<strong>${html(g.distance < 10 ? g.distance.toFixed(1) : String(Math.round(g.distance)))} <span>km</span></strong><small>STRAIGHT-LINE</small>` : '<strong>—</strong><small>LOCATION NEEDED</small>';
    const marks = g.marks.map(m => `<div class="mark-row"><span class="mark-bullet" aria-hidden="true">✦</span><div class="mark-copy"><strong>${html(m.title)}</strong><div class="mark-meta"><span>Introduced ${html(toDate(m.introduced))}</span><span>${html(m.recordStatus || 'Unknown')}</span></div></div></div>`).join('');
    const saved = favorites.has(g.key);
    return `<article class="office-card" aria-label="${title}"><div class="office-top"><div class="office-icon" aria-hidden="true">✉</div><div class="office-main"><h3>${title}</h3><div class="place-name">${html(g.district)}, ${html(g.state)} · PIN ${html(g.pin)}</div></div><div class="distance-box">${dist}</div></div><div class="office-divider"></div><div class="mark-list">${marks}</div><div class="office-bottom"><div class="tag-row"><span class="soft-tag">${g.marks.length} cancellation${g.marks.length !== 1 ? 's' : ''}</span><span class="soft-tag gold">Confirm at counter</span></div><div class="office-actions"><button type="button" class="${saved ? 'favorited' : ''}" data-favorite="${key}" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Save'}</button>
    <a href="${directions}" data-directions="true" target="_blank" rel="noopener noreferrer">Directions ↗</a></div></div></article>`;
  }
  function updateResults() {
    const list = currentOffices(), count = list.reduce((sum, g) => sum + g.marks.length, 0);
    $('result-count').textContent = count + ' PPCs';
    $('results-subtitle').textContent = point
      ? `Nearest first · starting from ${point.kind === 'gps'
        ? 'your device location'
        : point.label
      }`
      : 'Choose your location to discover nearby permanent pictorial cancellations.';
    $('results-notice').textContent = `${list.length} post office${list.length === 1 ? '' : 's'} · ${count} pictorial cancellation${count === 1 ? '' : 's'}`;
    if (!list.length) {
      $('results-list').innerHTML = '<div class="empty-state"><div class="empty-icon">⌕</div><h3>No matching post offices</h3><p>Try a larger radius or another location. This directory does not yet contain every PPC in India.</p><button type="button" class="button button-outline" id="reset-filters">Clear filters</button></div>';
      $('reset-filters').addEventListener('click', () => {

        $('search-input').value = '';

        $('radius-select').value = '100';

        savedOnly = false;

        $('saved-filter').setAttribute(
          'aria-pressed',
          'false'
        );

        $('saved-filter').textContent = '♡ Saved only';

        loadNearby();

      });
    } else $('results-list').innerHTML = list.map(renderCard).join('');
  }
  $('locate-btn').addEventListener('click', () => requestLocation());
  $('clear-location').addEventListener('click', () => {

    gpsRequest++;

    point = null;

    $('manual-place').value = '';

    updateLocationStatus(
      'Location cleared. Choose GPS or a reference post office.'
    );

    loadNearby();

  });
  $('manual-place').addEventListener('change', event => { const v = placeOptions[event.target.value]; if (v) { gpsRequest++; setPoint(v[1], v[2], v[0], 'manual-select'); } });
  $('custom-location-form').addEventListener('submit', event => { event.preventDefault(); const lat = Number($('custom-lat').value), lon = Number($('custom-lon').value); if (lat < 6 || lat > 38 || lon < 68 || lon > 98) return; gpsRequest++; setPoint(lat, lon, 'custom coordinates', 'manual'); });
  $('search-input').addEventListener(
    'input',
    updateResults
  );

  $('radius-select').addEventListener(
    'change',
    loadNearby
  );
  $('saved-filter').addEventListener('click', () => { savedOnly = !savedOnly; $('saved-filter').setAttribute('aria-pressed', String(savedOnly)); $('saved-filter').textContent = savedOnly ? '♥ Showing saved' : '♡ Saved only'; updateResults(); });
  // ==========================================
  // GOOGLE MAPS DIRECTIONS FROM CURRENT GPS
  // ==========================================
  // GOOGLE MAPS DIRECTIONS
  // Use the same origin as the PPC distance calculations.

  $('results-list').addEventListener('click', (event) => {

    const link = event.target.closest('a[data-directions]');

    if (!link) return;

    event.preventDefault();

    const mapsURL = new URL(link.href);

    // Use the location already selected in PPC Compass.
    if (
      point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude)
    ) {

      mapsURL.searchParams.set(
        'origin',
        `${point.latitude},${point.longitude}`
      );

    }

    mapsURL.searchParams.set('travelmode', 'driving');

    window.open(
      mapsURL.toString(),
      '_blank',
      'noopener,noreferrer'
    );

  });
  $('results-list').addEventListener('click', event => { const btn = event.target.closest('button[data-favorite]'); if (!btn) return; const k = btn.dataset.favorite; if (favorites.has(k)) favorites.delete(k); else favorites.add(k); try { localStorage.setItem(STORAGE_FAVORITES, JSON.stringify([...favorites])); } catch { } updateResults(); });
  renderMetrics(); updateResults();
  requestLocation(true);
})();
