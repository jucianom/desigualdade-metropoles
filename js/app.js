/* =====================================================================
   Painel "Desigualdade nas Metrópoles" — lógica principal (low-code / sem
   build step). Este arquivo:
   1) busca os dados em /data/*.json e /data/*.geojson via fetch()
   2) preenche as variáveis globais abaixo
   3) inicializa a interface (populateSelects, tabs, primeira renderização)

   Para atualizar os dados do painel, basta editar os arquivos em /data —
   não é necessário mexer neste arquivo.
   ===================================================================== */

// ---- estado dos dados, preenchido em init() a partir dos arquivos JSON ----
let DATA = {};
let REGIONS = [];
let AGG = [];
let ALL_AREAS = [];
let YEARS = [];
let INDICATORS = {};
let CARD_ORDER = [];
let CARD_SHORT = {};
let CAPITAL_LATLON = {};
let STATES_GEOJSON = null;
let PALETTE = [];

/* ===================== estado global ===================== */
const state = {
  activeTab: 'graficos',      // 'graficos' | 'sobre' | 'ficha'
  ano: '2012',
  indicador: 'gini',
  rm: 'Manaus',
  comparacaoRegiao: 'Brasil',
  comparacaoAno: '2025',
};

/* ===================== helpers de dados ===================== */
function rawVal(dataKey, year, region){
  const y = DATA[dataKey] && DATA[dataKey][year];
  if(!y) return null;
  const v = y[region];
  return (v === undefined || v === null) ? null : v;
}
function getVal(indKey, region, year){
  return rawVal(indKey, year, region);
}
function getAbsVal(indKey, region, year){
  const abs = INDICATORS[indKey].abs_key;
  if(!abs) return null;
  return rawVal(abs, year, region);
}
function fmtNum(v, min, max){
  if(v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', {minimumFractionDigits:min, maximumFractionDigits:max});
}
function fmtValue(indKey, v){
  if(v === null || v === undefined) return '—';
  const t = INDICATORS[indKey].type;
  if(t === 'index') return fmtNum(v,3,3);
  if(t === 'currency') return 'R$\u00A0' + fmtNum(v,2,2);
  if(t === 'ratio') return fmtNum(v,1,1) + 'x';
  if(t === 'percent') return fmtNum(v*100,1,1) + '%';
  return fmtNum(v,2,2);
}
function fmtSigned(v, suffix){
  if(v === null || v === undefined || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : (v < 0 ? '' : '\u00B1');
  return sign + fmtNum(v, suffix==='%'?1:3, suffix==='%'?1:3) + suffix;
}

/* card: valor principal + linha(s) secundárias, para indicador/região/ano dados */
function cardContent(indKey, region, year){
  const val = getVal(indKey, region, year);
  const val2012 = getVal(indKey, region, '2012');
  const main = fmtValue(indKey, val);
  let subHtml = '';
  if(indKey === 'gini'){
    const delta = (val!==null && val2012!==null) ? (val - val2012) : null;
    const cls = delta>0 ? 'up' : (delta<0 ? 'down':'');
    subHtml = `<div class="card-sub ${cls}">${fmtSigned(delta,'')} desde 2012</div>`;
  } else if(['renda','renda40','renda10','razao'].includes(indKey)){
    const rel = (val!==null && val2012) ? ((val-val2012)/val2012*100) : null;
    const cls = rel>0 ? 'up' : (rel<0 ? 'down':'');
    subHtml = `<div class="card-sub ${cls}">${fmtSigned(rel,'%')} desde 2012</div>`;
  } else if(indKey === 'pobreza_pct' || indKey === 'pobreza_ext_pct'){
    const abs = getAbsVal(indKey, region, year);
    const absFmt = (abs===null) ? '—' : Math.round(abs).toLocaleString('pt-BR');
    subHtml = `<div class="card-sub2">${absFmt} pessoas</div>`;
  }
  return {main, subHtml};
}

/* ===================== populate selects ===================== */
function populateSelects(){
  const anoSel = document.getElementById('f-ano');
  YEARS.forEach(y=>{
    const o = document.createElement('option'); o.value=y; o.textContent=y;
    anoSel.appendChild(o);
  });
  anoSel.value = state.ano;

  const indSel = document.getElementById('f-indicador');
  CARD_ORDER.forEach(k=>{
    const o = document.createElement('option'); o.value=k; o.textContent=INDICATORS[k].label;
    indSel.appendChild(o);
  });
  indSel.value = state.indicador;

  const rmSel = document.getElementById('f-rm');
  REGIONS.forEach(r=>{
    const o = document.createElement('option'); o.value=r; o.textContent=r;
    rmSel.appendChild(o);
  });
  rmSel.value = state.rm;

  const compSel = document.getElementById('f-comparacao');
  ALL_AREAS.forEach(r=>{
    const o = document.createElement('option'); o.value=r; o.textContent=r;
    compSel.appendChild(o);
  });
  compSel.value = state.comparacaoRegiao;

  const compAnoSel = document.getElementById('fm-comparacao');
  YEARS.forEach(y=>{
    const o = document.createElement('option'); o.value=y; o.textContent=y;
    compAnoSel.appendChild(o);
  });
  compAnoSel.value = state.comparacaoAno;

  anoSel.addEventListener('change', e=>{ state.ano = e.target.value; renderAll(); });
  indSel.addEventListener('change', e=>{ state.indicador = e.target.value; renderAll(); });
  rmSel.addEventListener('change', e=>{ state.rm = e.target.value; renderAll(); });
  compSel.addEventListener('change', e=>{ state.comparacaoRegiao = e.target.value; renderAll(); });
  compAnoSel.addEventListener('change', e=>{ state.comparacaoAno = e.target.value; renderAll(); });
}

/* ===================== tabs ===================== */
function setupTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      applyTabVisibility();
    });
  });
}
function applyTabVisibility(){
  document.getElementById('tab-dados').classList.toggle('hidden', state.activeTab!=='graficos');
  document.getElementById('tab-sobre').classList.toggle('hidden', state.activeTab!=='sobre');
  document.getElementById('tab-ficha').classList.toggle('hidden', state.activeTab!=='ficha');

  if(state.activeTab==='graficos') renderAll();
}

/* ===================== cards ===================== */
function renderCardRow(containerId, labelId, region){
  const wrap = document.getElementById(containerId);
  document.getElementById(labelId).textContent = region;
  wrap.innerHTML = '';
  CARD_ORDER.forEach(k=>{
    const {main, subHtml} = cardContent(k, region, state.ano);
    const div = document.createElement('div');
    div.className = 'card' + (k===state.indicador ? ' active':'');
    div.innerHTML = `<p class="card-label">${CARD_SHORT[k]}</p><div class="card-value">${main}</div>${subHtml}`;
    wrap.appendChild(div);
  });
}
function renderCards(){
  renderCardRow('cards-row-rm', 'cards-row-rm-label', state.rm);
  renderCardRow('cards-row-comp', 'cards-row-comp-label', state.comparacaoRegiao);
}

/* ===================== charts (SVG nativo, sem dependências externas) ===================== */
const CHART_VB_W = 640, CHART_VB_H = 300;

function seriesFor(indKey, region){
  return YEARS.map(y => getVal(indKey, region, y));
}

function niceTicks(min, max, n){
  if(min===max){ min -= 1; max += 1; }
  const step = (max-min)/(n-1);
  const ticks = [];
  for(let i=0;i<n;i++) ticks.push(min + step*i);
  return ticks;
}

/* Catmull-Rom -> Bezier smoothing for a clean curved line */
function smoothPath(pts){
  if(pts.length < 2) return '';
  if(pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){
    const p0 = pts[i-1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[i+2] || p2;
    const c1x = p1[0] + (p2[0]-p0[0])/6;
    const c1y = p1[1] + (p2[1]-p0[1])/6;
    const c2x = p2[0] - (p3[0]-p1[0])/6;
    const c2y = p2[1] - (p3[1]-p1[1])/6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function measureLabelWidth(text){
  // approximate width in SVG units for font-size 9.5 Host Grotesk (~0.56 * fontsize per char, tabular-ish)
  return text.length * 5.6;
}

function computeDomain(seriesList){
  const allVals = seriesList.flatMap(s=>s.data).filter(v=>v!==null && v!==undefined);
  let vmin = Math.min(...allVals), vmax = Math.max(...allVals);
  if(vmin === vmax){ vmin -= Math.abs(vmin)*0.1 || 1; vmax += Math.abs(vmax)*0.1 || 1; }
  const pad = (vmax-vmin)*0.12;
  vmin -= pad; vmax += pad;
  return {vmin, vmax};
}

function buildLineSVG(seriesList, indKey, highlightYear, gradId, forcedDomain, forcedPadLeft){
  const {vmin, vmax} = forcedDomain || computeDomain(seriesList);
  const ticks = niceTicks(vmin, vmax, 5);

  const padLeft = forcedPadLeft || Math.max(44, Math.min(96, 26 + Math.max(...ticks.map(t=>measureLabelWidth(fmtValue(indKey,t))))));
  const pad = {top:14, right:16, bottom:26, left:padLeft};

  const plotW = CHART_VB_W - pad.left - pad.right;
  const plotH = CHART_VB_H - pad.top - pad.bottom;
  const n = YEARS.length;
  const baseY = pad.top + plotH;
  const xAt = i => pad.left + (n===1?0:(i*(plotW/(n-1))));
  const yAt = v => pad.top + (vmax-v)/(vmax-vmin)*plotH;
  const hIdx = YEARS.indexOf(highlightYear);

  let defs = '';
  let body = '';

  ticks.forEach(t=>{
    const y = yAt(t);
    body += `<line x1="${pad.left}" x2="${CHART_VB_W-pad.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(34,34,59,0.08)" stroke-width="1"/>`;
    body += `<text x="${pad.left-8}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-size="9.5" font-family="Host Grotesk, sans-serif" fill="#4a4e69">${fmtValue(indKey,t)}</text>`;
  });

  YEARS.forEach((y,i)=>{
    const x = xAt(i);
    body += `<text x="${x.toFixed(1)}" y="${CHART_VB_H-8}" text-anchor="middle" font-size="8.6" font-family="Host Grotesk, sans-serif" fill="#4a4e69">${y}</text>`;
  });

  if(hIdx>=0){
    body += `<line x1="${xAt(hIdx).toFixed(1)}" x2="${xAt(hIdx).toFixed(1)}" y1="${pad.top}" y2="${baseY}" stroke="#c9ada7" stroke-width="1.3" stroke-dasharray="3,3"/>`;
  }

  seriesList.forEach((s,si)=>{
    const pts = [];
    s.data.forEach((v,i)=>{ if(v!==null && v!==undefined) pts.push([xAt(i), yAt(v)]); });
    if(pts.length<2) return;
    const linePath = smoothPath(pts);
    const gid = `${gradId}-${si}`;
    defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${s.color}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
    </linearGradient>`;
    const areaPath = `${linePath} L${pts[pts.length-1][0]},${baseY} L${pts[0][0]},${baseY} Z`;
    if(seriesList.length===1){
      body += `<path d="${areaPath}" fill="url(#${gid})" stroke="none"/>`;
    }
    body += `<path d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.data.forEach((v,i)=>{
      if(v===null || v===undefined) return;
      const x = xAt(i), y = yAt(v);
      const isH = i===hIdx;
      if(isH){
        body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="#c9ada7" stroke="${s.color}" stroke-width="2.2"/>`;
      } else {
        body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="${s.color}" opacity="0.85"/>`;
      }
    });
  });

  // invisible hit columns for tooltip interaction
  const colW = n>1 ? plotW/(n-1) : plotW;
  YEARS.forEach((y,i)=>{
    const x = xAt(i);
    const left = x - colW/2, w = colW;
    body += `<rect class="hit-col" data-idx="${i}" x="${left.toFixed(1)}" y="${pad.top}" width="${w.toFixed(1)}" height="${plotH}"/>`;
  });

  const svg = `<svg viewBox="0 0 ${CHART_VB_W} ${CHART_VB_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">${defs?'<defs>'+defs+'</defs>':''}${body}</svg>`;
  return svg;
}

function attachChartTooltip(wrapId, chartElId, tooltipId, seriesList, indKey){
  const wrap = document.getElementById(wrapId);
  const tooltip = document.getElementById(tooltipId);
  const svg = wrap.querySelector('svg');
  if(!svg) return;
  svg.querySelectorAll('.hit-col').forEach(col=>{
    col.addEventListener('mousemove', (e)=>{
      const idx = parseInt(col.dataset.idx,10);
      const rect = wrap.getBoundingClientRect();
      let x = e.clientX - rect.left, y = e.clientY - rect.top;
      const rows = seriesList.map(s=>{
        const v = s.data[idx];
        return `<div class="tt-row"><span class="tt-dot" style="background:${s.color}"></span>${s.label}: ${fmtValue(indKey, v)}</div>`;
      }).join('');
      tooltip.innerHTML = `<span class="tt-year">${YEARS[idx]}</span>${rows}`;
      tooltip.style.opacity = '1';
      const tw = tooltip.offsetWidth || 140;
      let left = x + 12;
      if(left + tw > wrap.clientWidth) left = x - tw - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = Math.max(0, y - 14) + 'px';
    });
    col.addEventListener('mouseleave', ()=>{ tooltip.style.opacity='0'; });
  });
}

function renderChart1(){
  document.getElementById('g1-title').textContent = `${INDICATORS[state.indicador].label} · ${state.rm}`;
  const data1 = seriesFor(state.indicador, state.rm);
  const data2 = seriesFor(state.indicador, state.comparacaoRegiao);
  const domain = computeDomain([{data:data1},{data:data2}]);
  const ticks = niceTicks(domain.vmin, domain.vmax, 5);
  const padLeft = Math.max(44, Math.min(96, 26 + Math.max(...ticks.map(t=>measureLabelWidth(fmtValue(state.indicador,t))))));

  const seriesList = [{label:state.rm, color:'#22223b', data:data1}];
  const svg = buildLineSVG(seriesList, state.indicador, state.ano, 'grad1', domain, padLeft);
  document.getElementById('chart1').innerHTML = svg;
  attachChartTooltip('chart1-wrap','chart1','chart1-tooltip', seriesList, state.indicador);
}
function renderChart2(){
  document.getElementById('g2-title').textContent = `${INDICATORS[state.indicador].label} · ${state.comparacaoRegiao}`;
  const data1 = seriesFor(state.indicador, state.rm);
  const data2 = seriesFor(state.indicador, state.comparacaoRegiao);
  const domain = computeDomain([{data:data1},{data:data2}]);
  const ticks = niceTicks(domain.vmin, domain.vmax, 5);
  const padLeft = Math.max(44, Math.min(96, 26 + Math.max(...ticks.map(t=>measureLabelWidth(fmtValue(state.indicador,t))))));

  const seriesList = [{label:state.comparacaoRegiao, color:'#4a4e69', data:data2}];
  const svg = buildLineSVG(seriesList, state.indicador, state.ano, 'grad2', domain, padLeft);
  document.getElementById('chart2').innerHTML = svg;
  attachChartTooltip('chart2-wrap','chart2','chart2-tooltip', seriesList, state.indicador);
}

/* ===================== mapas (Leaflet + tiles CARTO) ===================== */
const R_MIN = 6, R_MAX = 30;
let leafletMaps = {}; // {containerId: {map, markersLayer}}

function colorScale(t){
  const c1 = [201,173,167]; // clay
  const c2 = [34,34,59];    // navy
  const c = c1.map((v,i)=> Math.round(v + (c2[i]-v)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function initLeafletMap(containerId){
  const map = L.map(containerId, {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([-14.2, -51.9], 4);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  L.geoJSON(STATES_GEOJSON, {
    style: { color:'#22223b', weight:1, opacity:0.55, fillColor:'#f2e9e4', fillOpacity:0.06, className:'state-boundary' }
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);
  leafletMaps[containerId] = { map, markersLayer };
  setTimeout(()=> map.invalidateSize(), 50);
  return leafletMaps[containerId];
}

function renderMap(containerId, indKey, year, titleId){
  if(!leafletMaps[containerId]) initLeafletMap(containerId);
  const { map, markersLayer } = leafletMaps[containerId];
  markersLayer.clearLayers();

  const vals = REGIONS.map(r=> getVal(indKey, r, year)).filter(v=>v!==null && v!==undefined);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const span = (vmax-vmin) || 1;

  const legendEl = document.getElementById(containerId.replace('-wrap','-legend'));
  if(legendEl){
    const steps = [0, 1/3, 2/3, 1];
    legendEl.innerHTML = steps.map(t=>{
      const val = vmin + t*span;
      const rad = R_MIN + t*(R_MAX-R_MIN);
      const d = (rad).toFixed(0);
      return `<span class="leg-item"><span class="dot" style="width:${d}px;height:${d}px;background:${colorScale(t)}"></span><span>${fmtValue(indKey,val)}</span></span>`;
    }).join('');
  }

  REGIONS.forEach(r=>{
    const v = getVal(indKey, r, year);
    const ll = CAPITAL_LATLON[r];
    if(!ll) return;
    if(v===null || v===undefined){
      L.circleMarker(ll, { radius:4, color:'#f2e9e4', weight:1, fillColor:'#9a8c98', fillOpacity:0.35 })
        .bindTooltip(`${r}: sem dado`, {direction:'top'})
        .addTo(markersLayer);
      return;
    }
    const t = (v - vmin)/span;
    const rad = R_MIN + t*(R_MAX-R_MIN);
    const fill = colorScale(t);
    L.circleMarker(ll, {
      radius: rad, color:'#f2e9e4', weight:1.4, fillColor: fill, fillOpacity:0.82
    }).bindTooltip(`<b>${r}</b><br>${fmtValue(indKey,v)}`, {direction:'top', offset:[0,-rad]})
      .addTo(markersLayer);
  });

  document.getElementById(titleId).textContent = `${INDICATORS[indKey].label} · ${year}`;
}

function renderMaps(){
  renderMap('map1-wrap', state.indicador, state.ano, 'm1-title');
  renderMap('map2-wrap', state.indicador, state.comparacaoAno, 'm2-title');
  Object.values(leafletMaps).forEach(({map})=> map.invalidateSize());
}

/* ===================== render geral ===================== */
function renderAll(){
  renderCards();
  renderChart1();
  renderChart2();
  renderMaps();
}


/* ===================== init ===================== */
async function init(){
  try{
    const [meta, indicators, geo] = await Promise.all([
      fetch('data/meta.json').then(r => r.json()),
      fetch('data/indicators.json').then(r => r.json()),
      fetch('data/states.geojson').then(r => r.json()),
    ]);

    DATA = indicators;
    REGIONS = meta.regions;
    AGG = meta.aggregates;
    ALL_AREAS = REGIONS.concat(AGG);
    YEARS = meta.years;
    INDICATORS = meta.indicators;
    CARD_ORDER = meta.cardOrder;
    CARD_SHORT = meta.cardShort;
    CAPITAL_LATLON = meta.capitals;
    PALETTE = meta.palette;
    STATES_GEOJSON = geo;

    populateSelects();
    setupTabs();
    applyTabVisibility();
  } catch(err){
    console.error('Falha ao carregar os dados do painel:', err);
    document.querySelector('.app').insertAdjacentHTML('afterbegin',
      '<p style="background:#f2e9e4;border:1px solid #c9ada7;border-radius:8px;padding:14px;color:#22223b;">' +
      'Não foi possível carregar os dados do painel. Verifique se os arquivos em <code>/data</code> ' +
      'estão publicados junto com este site e se ele está sendo aberto via um servidor ' +
      '(http/https), não diretamente do disco (file://).</p>');
  }
}

init();
