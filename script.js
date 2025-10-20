// Minimal CSV parser that handles quoted fields and commas
function parseCSV(text){
  const lines = [];
  let cur = '';
  let inQuote = false;
  const row = [];
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(ch === '"'){
      // look ahead for escaped quote
      if(inQuote && text[i+1] === '"'){
        cur += '"'; i++; continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if(ch === ',' && !inQuote){
      row.push(cur); cur = ''; continue;
    }
    if((ch === '\n' || ch === '\r') && !inQuote){
      // handle CRLF
      if(cur !== '' || row.length>0){ row.push(cur); lines.push(row.slice()); }
      cur = ''; row.length = 0; inQuote = false; // reset
      // skip additional \n after \r
      if(ch === '\r' && text[i+1] === '\n') i++;
      continue;
    }
    cur += ch;
  }
  if(cur !== '' || row.length>0){ row.push(cur); lines.push(row.slice()); }
  return lines;
}

// Convert array rows to objects using header row
function rowsToObjects(rows){
  if(!rows || rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  const data = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    if(r.length === 1 && r[0].trim() === '') continue;
    const obj = {};
    for(let j=0;j<header.length;j++) obj[header[j]] = (r[j] === undefined ? '' : r[j]);
    data.push(obj);
  }
  return {header, data};
}

// Globals
let DATA = [];
let HEADER = [];

function el(id){ return document.getElementById(id); }

function populateSelect(id, values){
  const s = el(id);
  const cur = new Set();
  values.forEach(v => { if(v && v.trim() !== '') cur.add(v); });
  const arr = Array.from(cur).sort((a,b)=>a.localeCompare(b));
  arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o); });
}

function renderTable(rows){
  const tbody = el('tbody'); tbody.innerHTML = '';
  const theadRow = el('thead-row'); theadRow.innerHTML = '';
  // Do not display the raw `url` column; keep it available on the data objects
  const displayHeader = HEADER.filter(h => h.toLowerCase() !== 'url');
  displayHeader.forEach(h => { const th = document.createElement('th'); th.textContent = h; theadRow.appendChild(th); });
  if(rows.length === 0){ el('empty').classList.remove('hidden'); el('stats').textContent = '0 rows'; return; }
  el('empty').classList.add('hidden');
  el('stats').textContent = `${rows.length} rows`; 
  rows.forEach(r => {
    const tr = document.createElement('tr');
    displayHeader.forEach(h => {
      const td = document.createElement('td');
      let v = r[h] || '';
      if(h === 'name' && r.url){
        const a = document.createElement('a'); a.href = r.url; a.textContent = v; a.target = '_blank'; td.appendChild(a);
      } else td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function getFilterValues(){
  return {
    search: el('search').value.trim().toLowerCase(),
    team: el('team').value,
    position: el('position').value,
    year: el('year').value,
    sort: el('sort').value,
    desc: el('desc').checked
  };
}

function applyFilters(){
  const f = getFilterValues();
  let rows = DATA.slice();
  if(f.search){
    const q = f.search.split(/\s+/).filter(Boolean);
    rows = rows.filter(r => {
      const hay = (Object.values(r).join(' ') || '').toLowerCase();
      return q.every(term => hay.indexOf(term) !== -1);
    });
  }
  if(f.team) rows = rows.filter(r => r.team === f.team);
  if(f.position) rows = rows.filter(r => (r.position||'').toLowerCase() === f.position.toLowerCase());
  if(f.year) rows = rows.filter(r => r.academic_year === f.year);

  // sort
  rows.sort((a,b) => {
    const k = f.sort || 'team';
    const va = (a[k]||'').toString().toLowerCase();
    const vb = (b[k]||'').toString().toLowerCase();
    if(!isNaN(Number(va)) && !isNaN(Number(vb))) return Number(va)-Number(vb);
    if(va < vb) return -1; if(va > vb) return 1; return 0;
  });
  if(f.desc) rows.reverse();
  renderTable(rows);
}

function resetControls(){
  el('search').value = '';
  el('team').value = '';
  el('position').value = '';
  el('year').value = '';
  el('sort').value = 'team';
  el('desc').checked = false;
  applyFilters();
}

async function init(){
  try{
    const resp = await fetch('rosters_2025-26.csv');
    if(!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const txt = await resp.text();
    const rows = parseCSV(txt);
    const obj = rowsToObjects(rows);
    HEADER = obj.header;
    DATA = obj.data;

    // populate selects with unique values
    populateSelect('team', DATA.map(d=>d.team));
    populateSelect('position', DATA.map(d=>d.position));
    populateSelect('year', DATA.map(d=>d.academic_year));

    // wire events
    ['search','team','position','year','sort','desc'].forEach(id => {
      el(id).addEventListener('input', applyFilters);
      el(id).addEventListener('change', applyFilters);
    });
    el('reset').addEventListener('click', resetControls);

    applyFilters();
  }catch(err){
    console.error(err);
    el('stats').textContent = 'Failed to load CSV: ' + err.message;
  }
}

document.addEventListener('DOMContentLoaded', init);
