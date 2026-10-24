(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // New storage key prevents old prototype imports from retaining external source links.
  const STORAGE_CATALOG = 'postmark-trail:catalog:v2';
  const STORAGE_FAVORITES = 'postmark-trail:favorites:v2';
  const seed = Array.isArray(window.PPC_STARTER_DATA) ? window.PPC_STARTER_DATA : [];
  const placeOptions = {
    bbs: ['Bhubaneshwar GPO', 20.272028080698117, 85.83368893732698],
    puri: ['Puri HO', 19.800627768493435, 85.82642540137608],
    cuttack: ['Cuttack GPO', 20.47524496650716, 85.87537189599502],
    konark: ['Konark SO', 19.89046051681591, 86.09858469288149]
  };
  const parseStore = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const stored = parseStore(STORAGE_CATALOG);
  let records = Array.isArray(stored) ? stored : seed;
  let imported = Array.isArray(stored);
  let favorites = new Set(Array.isArray(parseStore(STORAGE_FAVORITES)) ? parseStore(STORAGE_FAVORITES) : []);
  let point = null, gpsRequest = 0, savedOnly = false;
  const html = (val) => String(val ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const toDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('.') : 'Date unknown';
  const rad = (degrees) => degrees * Math.PI / 180;
  function distanceKm(a, b) {
    const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
  }
  const isMapped = (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude);
  const officeKey = (r) => [r.postOffice.trim().toLowerCase(),r.pin,r.latitude,r.longitude].join('|');
  function updateLocationStatus(message, type='neutral') {
    const el = $('location-status');
    el.className = 'location-status' + (type === 'ok' ? ' success' : type === 'error' ? ' failed' : '');
    el.querySelector('span:last-child').textContent = message;
    $('clear-location').hidden = !point;
  }
  function setPoint(latitude, longitude, label, kind='manual') {
    point = {latitude,longitude,label,kind};
    updateLocationStatus((kind === 'gps' ? 'Location found' : `Using ${label}`) + ' · distances are straight-line estimates', 'ok');
    $('manual-place').value = kind === 'manual-select' ? Object.keys(placeOptions).find(k=>placeOptions[k][0]===label) || '' : '';
    updateResults();
  }
  function requestLocation(automatic=false) {
    gpsRequest++;
    const requestId = gpsRequest;
    if (!window.isSecureContext) {updateLocationStatus('Location requires HTTPS (or localhost). Select a post office below.','error');return;}
    if (!navigator.geolocation) {updateLocationStatus('Location is not supported in this browser. Select a post office.','error');return;}
    if(!automatic) updateLocationStatus('Requesting location access…');
    navigator.geolocation.getCurrentPosition(
      pos=>{if(gpsRequest !== requestId)return;setPoint(pos.coords.latitude,pos.coords.longitude,'current location','gps');},
      err=>{if(gpsRequest !== requestId)return;const message=err.code===1?'Location access was denied':err.code===2?'Your location is unavailable':'Location request timed out';if(!point)updateLocationStatus(message+'. Select an office below or retry.','error');},
      {enableHighAccuracy:true,maximumAge:60000,timeout:12000}
    );
  }
  function currentOffices() {
    const terms = $('search-input').value.toLocaleLowerCase().trim();
    const radius = $('radius-select').value;
    const selected = records.filter(r=>isMapped(r) && !['Not Working','Withdrawn'].includes(r.recordStatus) && (
      !terms || [r.title,r.postOffice,r.pin,r.district,r.state].some(x=>String(x??'').toLocaleLowerCase().includes(terms))
    ));
    const grouped = new Map();
    for (const r of selected) {
      const key = officeKey(r);
      if(!grouped.has(key))grouped.set(key,{key,postOffice:r.postOffice,pin:r.pin,district:r.district,state:r.state,latitude:r.latitude,longitude:r.longitude,marks:[],distance:point?distanceKm(point,r):null});
      grouped.get(key).marks.push(r);
    }
    const all = [...grouped.values()].filter(g=>(!point || radius==='all' || g.distance<=Number(radius)) && (!savedOnly || favorites.has(g.key)));
    all.sort((a,b)=>point?(a.distance-b.distance)||a.postOffice.localeCompare(b.postOffice):a.state.localeCompare(b.state)||a.district.localeCompare(b.district)||a.postOffice.localeCompare(b.postOffice));
    return all;
  }
  function renderMetrics() {
    $('metric-cancellations').textContent=String(records.length);
    $('metric-offices').textContent=String(new Set(records.map(officeKey)).size);
    $('metric-states').textContent=String(new Set(records.map(r=>r.state)).size);
    $('catalogue-label').textContent=imported?'PERSONAL IMPORT · ONLY ON THIS BROWSER':'ODISHA DIRECTORY · NOT LIVE AVAILABILITY';
  }
  function renderCard(g) {
    // The sole external destination is an optional Google Maps navigation action.
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.latitude.toFixed(6)+','+g.longitude.toFixed(6))}`;
    const title=html(g.postOffice), key=html(g.key);
    const dist=g.distance!==null?`<strong>${html(g.distance<10?g.distance.toFixed(1):String(Math.round(g.distance)))} <span>km</span></strong><small>STRAIGHT-LINE</small>`:'<strong>—</strong><small>LOCATION NEEDED</small>';
    const marks=g.marks.map(m=>`<div class="mark-row"><span class="mark-bullet" aria-hidden="true">✦</span><div class="mark-copy"><strong>${html(m.title)}</strong><div class="mark-meta"><span>Introduced ${html(toDate(m.introduced))}</span><span>${html(m.recordStatus || 'Unknown')}</span></div></div></div>`).join('');
    const saved=favorites.has(g.key);
    return `<article class="office-card" aria-label="${title}"><div class="office-top"><div class="office-icon" aria-hidden="true">✉</div><div class="office-main"><h3>${title}</h3><div class="place-name">${html(g.district)}, ${html(g.state)} · PIN ${html(g.pin)}</div></div><div class="distance-box">${dist}</div></div><div class="office-divider"></div><div class="mark-list">${marks}</div><div class="office-bottom"><div class="tag-row"><span class="soft-tag">${g.marks.length} cancellation${g.marks.length!==1?'s':''}</span><span class="soft-tag gold">Confirm at counter</span></div><div class="office-actions"><button type="button" class="${saved?'favorited':''}" data-favorite="${key}" aria-pressed="${saved}">${saved?'♥ Saved':'♡ Save'}</button><a href="${directions}" target="_blank" rel="noopener noreferrer">Directions ↗</a></div></div></article>`;
  }
  function updateResults() {
    const list=currentOffices(), count=list.reduce((sum,g)=>sum+g.marks.length,0);
    $('result-count').textContent=count+' PPCs';
    $('results-subtitle').textContent=point?`Nearest first · starting from ${point.kind==='gps'?'your device location':point.label}`:'All mapped directory records · choose a starting point for distances';
    $('results-notice').textContent=`${list.length} post office${list.length===1?'':'s'} · ${count} pictorial cancellation${count===1?'':'s'}`;
    if(!list.length) {
      $('results-list').innerHTML='<div class="empty-state"><div class="empty-icon">⌕</div><h3>No matching post offices</h3><p>Try a larger radius or another location. This directory does not yet contain every PPC in India.</p><button type="button" class="button button-outline" id="reset-filters">Clear filters</button></div>';
      $('reset-filters').addEventListener('click',()=>{$('search-input').value='';$('radius-select').value='all';savedOnly=false;$('saved-filter').setAttribute('aria-pressed','false');$('saved-filter').textContent='♡ Saved only';updateResults();});
    } else $('results-list').innerHTML=list.map(renderCard).join('');
    const unmapped=records.filter(r=>!isMapped(r)).length;
    if(unmapped){const el=document.createElement('div');el.className='notice-message';el.textContent=`${unmapped} records have no coordinates and are excluded from nearby search.`;$('results-list').append(el);}
  }
  function validateImport(payload) {
    const arr=Array.isArray(payload)?payload:payload&&Array.isArray(payload.records)?payload.records:null;
    if(!arr||!arr.length||arr.length>2500)throw Error('Expected 1 to 2,500 records.');
    const ids=new Set();
    return arr.map((r,i)=>{
      const n=i+1;
      if(!r || typeof r!=='object'||Array.isArray(r))throw Error(`Record ${n} must be an object.`);
      for(const k of ['id','title','postOffice','district','state','pin','recordStatus']) {
        if(r[k]===null || r[k]===undefined || !String(r[k]).trim() || String(r[k]).length>260)throw Error(`Record ${n}: invalid or missing ${k}.`);
      }
      const id=String(r.id).trim(),pin=String(r.pin).trim();
      if(ids.has(id))throw Error(`Duplicate ID: ${id}`);
      ids.add(id);
      if(!/^\d{6}$/.test(pin))throw Error(`Record ${n}: PIN must contain exactly six digits.`);
      if(r.introduced) {
        const date=String(r.introduced);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error(`Record ${n}: invalid YYYY-MM-DD date.`);
      }
      const latitude=(r.latitude===''||r.latitude===null||r.latitude===undefined)?null:Number(r.latitude);
      const longitude=(r.longitude===''||r.longitude===null||r.longitude===undefined)?null:Number(r.longitude);
      if ((latitude===null)!==(longitude===null) || (latitude!==null && (!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<6||latitude>38||longitude<68||longitude>98)))throw Error(`Record ${n}: coordinates must both be within India, or both blank.`);
      const status=String(r.recordStatus).trim();
      if(!['Working','Not Working','Unknown','Withdrawn'].includes(status))throw Error(`Record ${n}: invalid recordStatus.`);
      return {id:r.id,title:String(r.title).trim(),introduced:String(r.introduced||''),postOffice:String(r.postOffice).trim(),district:String(r.district).trim(),state:String(r.state).trim(),pin,recordStatus:status,image_url:String(r.image_url||''),latitude,longitude,sourceUrl:''};
    });
  }
  // Quoted fields, escaped double quotes, and embedded newlines are supported.
  function parseCSV(input) {
    const rows=[];let row=[],value='',quoted=false;
    input=input.replace(/^\uFEFF/,'');
    for(let i=0;i<input.length;i++) {
      const ch=input[i];
      if(quoted){if(ch==='"'&&input[i+1]==='"'){value+='"';i++;}else if(ch==='"')quoted=false;else value+=ch;}
      else if(ch==='"'){if(value)throw Error('Invalid CSV quote.');quoted=true;}
      else if(ch===','){row.push(value);value='';}
      else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(value);value='';if(row.some(x=>x.trim()))rows.push(row);row=[];}
      else value+=ch;
    }
    if(quoted)throw Error('CSV contains an unclosed quoted field.');
    if(value||row.length){row.push(value);if(row.some(x=>x.trim()))rows.push(row);}
    if(rows.length<2)throw Error('CSV needs a header and at least one data row.');
    const headers=rows.shift().map(s=>s.trim());
    if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV column headers.');
    const required=['id','title','introduced','postOffice','district','state','pin','recordStatus','image_url','latitude','longitude','sourceUrl'];
    for(const key of required)if(!headers.includes(key))throw Error(`Missing CSV column: ${key}`);
    return rows.map((cells,i)=>{
      if(cells.length!==headers.length)throw Error(`CSV row ${i+2} has ${cells.length} columns instead of ${headers.length}.`);
      return Object.fromEntries(headers.map((h,j)=>[h,cells[j]]));
    });
  }
  async function onImport(event) {
    const file=event.target.files?.[0];if(!file)return;
    const feedback=$('import-feedback');
    if(file.size>2500000){feedback.textContent='File is too large (maximum 2.5 MB).';return;}
    try {
      const body=await file.text();
      const data=/\.csv$/i.test(file.name)?parseCSV(body):JSON.parse(body);
      const incoming=validateImport(data);
      localStorage.setItem(STORAGE_CATALOG,JSON.stringify(incoming));
      records=incoming;imported=true;
      feedback.textContent=`Imported ${records.length} records in this browser. Other visitors will not see this import.`;
      renderMetrics();updateResults();
    } catch(err) {feedback.textContent=`Import failed: ${err.message}`;}
    event.target.value='';
  }
  $('locate-btn').addEventListener('click',()=>requestLocation());
  $('clear-location').addEventListener('click',()=>{gpsRequest++;point=null;$('manual-place').value='';updateLocationStatus('Location cleared. Choose GPS or a reference post office.');updateResults();});
  $('manual-place').addEventListener('change',event=>{const v=placeOptions[event.target.value];if(v){gpsRequest++;setPoint(v[1],v[2],v[0],'manual-select');}});
  $('custom-location-form').addEventListener('submit',event=>{event.preventDefault();const lat=Number($('custom-lat').value),lon=Number($('custom-lon').value);if(lat<6||lat>38||lon<68||lon>98)return;gpsRequest++;setPoint(lat,lon,'custom coordinates','manual');});
  ['search-input','radius-select'].forEach(id=>$(id).addEventListener(id==='search-input'?'input':'change',updateResults));
  $('saved-filter').addEventListener('click',()=>{savedOnly=!savedOnly;$('saved-filter').setAttribute('aria-pressed',String(savedOnly));$('saved-filter').textContent=savedOnly?'♥ Showing saved':'♡ Saved only';updateResults();});
  $('results-list').addEventListener('click',event=>{const btn=event.target.closest('button[data-favorite]');if(!btn)return;const k=btn.dataset.favorite;if(favorites.has(k))favorites.delete(k);else favorites.add(k);try{localStorage.setItem(STORAGE_FAVORITES,JSON.stringify([...favorites]));}catch{}updateResults();});
  $('json-import').addEventListener('change',onImport);
  $('reset-data').addEventListener('click',()=>{localStorage.removeItem(STORAGE_CATALOG);records=seed;imported=false;$('import-feedback').textContent='Site directory restored in this browser.';renderMetrics();updateResults();});
  renderMetrics();updateResults();
  requestLocation(true);
})();
