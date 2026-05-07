/* ── page.js — Page Replacement Module ─────────────────────────────── */

let pageResults = {};

/* ── Samples ──────────────────────────────────────────────────────── */
function pageSample(n) {
  const samples = {
    1: { ref: '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1', frames: 3 },
    2: { ref: '1 2 3 4 1 2 5 1 2 3 4 5',                 frames: 4 },
    3: { ref: '2 3 2 1 5 2 4 5 3 2 5 2',                 frames: 3 },
  };
  const s = samples[n];
  document.getElementById('page-ref').value    = s.ref;
  document.getElementById('page-frames').value = s.frames;
}

function parseRef() {
  return document.getElementById('page-ref').value
    .trim().split(/\s+/).map(Number).filter(v => !isNaN(v));
}

/* ══════════════════════════════════════════════
   ALGORITHMS
   ══════════════════════════════════════════════ */

/* ── FIFO ─────────────────────────────────────────────────────────── */
function algoFIFO(ref, frames) {
  let memory = [], queue = [], faults = 0, hits = 0, steps = [];
  ref.forEach(page => {
    const inMem = memory.includes(page);
    let replaced = null, added = false;
    if (!inMem) {
      faults++;
      if (memory.length < frames) { memory.push(page); queue.push(page); added = true; }
      else { replaced = queue.shift(); memory[memory.indexOf(replaced)] = page; queue.push(page); }
    } else hits++;
    steps.push({ page, frames: [...memory], isFault: !inMem, replaced, added });
  });
  return { steps, faults, hits };
}

/* ── LRU ──────────────────────────────────────────────────────────── */
function algoLRU(ref, frames) {
  let memory = [], faults = 0, hits = 0, steps = [];
  ref.forEach((page, idx) => {
    const inMem = memory.includes(page);
    let replaced = null, added = false;
    if (!inMem) {
      faults++;
      if (memory.length < frames) { memory.push(page); added = true; }
      else {
        let lruIdx = -1, lruTime = Infinity;
        memory.forEach((p, i) => {
          const last = ref.slice(0, idx).lastIndexOf(p);
          if (last < lruTime) { lruTime = last; lruIdx = i; }
        });
        replaced = memory[lruIdx]; memory[lruIdx] = page;
      }
    } else hits++;
    steps.push({ page, frames: [...memory], isFault: !inMem, replaced, added });
  });
  return { steps, faults, hits };
}

/* ── Optimal ──────────────────────────────────────────────────────── */
function algoOptimal(ref, frames) {
  let memory = [], faults = 0, hits = 0, steps = [];
  ref.forEach((page, idx) => {
    const inMem = memory.includes(page);
    let replaced = null, added = false;
    if (!inMem) {
      faults++;
      if (memory.length < frames) { memory.push(page); added = true; }
      else {
        let farthestDist = -1, replIdx = 0;
        memory.forEach((p, i) => {
          const next = ref.slice(idx+1).indexOf(p);
          const dist = next === -1 ? Infinity : next;
          if (dist > farthestDist) { farthestDist = dist; replIdx = i; }
        });
        replaced = memory[replIdx]; memory[replIdx] = page;
      }
    } else hits++;
    steps.push({ page, frames: [...memory], isFault: !inMem, replaced, added });
  });
  return { steps, faults, hits };
}

/* ── Clock (Second Chance) ────────────────────────────────────────── */
function algoClock(ref, frames) {
  let memory = Array(frames).fill(null);
  let refBits = Array(frames).fill(0);
  let pointer = 0, faults = 0, hits = 0, steps = [];

  ref.forEach(page => {
    const idx = memory.indexOf(page);
    let replaced = null, added = false;
    if (idx !== -1) {
      hits++; refBits[idx] = 1;
    } else {
      faults++;
      // Find victim
      while (true) {
        if (refBits[pointer] === 0) {
          replaced = memory[pointer]; memory[pointer] = page;
          if (replaced === null) added = true;
          refBits[pointer] = 0; pointer = (pointer + 1) % frames; break;
        }
        refBits[pointer] = 0; pointer = (pointer + 1) % frames;
      }
    }
    steps.push({
      page,
      frames: [...memory],
      refBits: [...refBits],
      pointer,
      isFault: idx === -1,
      replaced: replaced === null ? null : replaced,
      added
    });
  });
  return { steps, faults, hits };
}

/* ── LFU ──────────────────────────────────────────────────────────── */
function algoLFU(ref, frames) {
  let memory = [], freq = {}, lastUsed = {}, faults = 0, hits = 0, steps = [];
  ref.forEach((page, idx) => {
    const inMem = memory.includes(page);
    let replaced = null, added = false;
    if (!inMem) {
      faults++;
      if (memory.length < frames) { memory.push(page); added = true; }
      else {
        // find min frequency; tie-break by least recently used
        let minFreq = Infinity, victimIdx = 0;
        memory.forEach((p, i) => {
          const f = freq[p] || 0;
          if (f < minFreq || (f === minFreq && (lastUsed[p]||0) < (lastUsed[memory[victimIdx]]||0))) {
            minFreq = f; victimIdx = i;
          }
        });
        replaced = memory[victimIdx];
        delete freq[replaced]; delete lastUsed[replaced];
        memory[victimIdx] = page;
      }
      freq[page] = 0;
    } else hits++;
    freq[page] = (freq[page] || 0) + 1;
    lastUsed[page] = idx;
    steps.push({ page, frames: [...memory], freq: {...freq}, isFault: !inMem, replaced, added });
  });
  return { steps, faults, hits };
}

/* ══════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════ */

function renderPageResult(containerId, result, numFrames, ref, algoName) {
  const { steps, faults, hits } = result;
  const total = ref.length;

  /* Page chips row */
  let html = '<div class="page-ref-display">';
  steps.forEach(s => {
    html += `<div class="page-chip ${s.isFault ? 'fault' : 'hit'}">${s.page}</div>`;
  });
  html += '</div>';

  /* Frame timeline table */
  html += '<div class="table-wrap"><table class="frame-table"><thead><tr>';
  html += '<th style="white-space:nowrap">Frame</th>';
  steps.forEach((_, i) => { html += `<th>${ref[i]}</th>`; });
  html += '</tr></thead><tbody>';

  for (let f = 0; f < numFrames; f++) {
    html += '<tr>';
    html += `<td style="color:var(--text-dim);font-weight:600">F${f}</td>`;
    steps.forEach(s => {
      const val = s.frames[f] !== undefined && s.frames[f] !== null ? s.frames[f] : '';
      let cls = '';
      if (s.isFault && s.frames[f] === s.page && (s.replaced !== null || s.added))
        cls = s.replaced !== null ? 'cell-replaced' : 'cell-fault';
      else if (!s.isFault && s.frames[f] === s.page)
        cls = 'cell-hit';
      html += `<td class="${cls}">${val}</td>`;
    });
    html += '</tr>';
  }

  /* Ref bits row for Clock */
  if (algoName === 'clock' && steps[0] && steps[0].refBits) {
    for (let f = 0; f < numFrames; f++) {
      html += `<tr><td style="color:#6b7280;font-size:.65rem">R${f}</td>`;
      steps.forEach(s => {
        const rb = s.refBits ? s.refBits[f] : '';
        html += `<td style="font-size:.7rem;color:${rb?'var(--yellow)':'var(--text-muted)'}">${rb !== undefined ? rb : ''}</td>`;
      });
      html += '</tr>';
    }
  }

  /* Freq row for LFU */
  if (algoName === 'lfu') {
    html += '<tr><td style="color:#6b7280;font-size:.65rem">Freq</td>';
    steps.forEach(s => {
      html += `<td style="font-size:.68rem;color:var(--yellow)">${s.freq && s.freq[s.page] !== undefined ? s.freq[s.page] : ''}</td>`;
    });
    html += '</tr>';
  }

  /* F/H marker row */
  html += '<tr><td style="font-size:.65rem;color:var(--text-dim)">Result</td>';
  steps.forEach(s => {
    html += `<td><span class="${s.isFault ? 'fault-marker' : 'hit-marker'}">${s.isFault ? 'F' : 'H'}</span></td>`;
  });
  html += '</tr></tbody></table></div>';

  /* Step log */
  html += '<div class="step-log" style="margin-top:1rem">';
  steps.forEach((s, i) => {
    html += `<div class="log-line">
      <span class="log-t">[${String(i+1).padStart(2,'0')}]</span>
      <span class="log-info">Page ${s.page}</span> → `;
    if (s.isFault) {
      html += `<span class="log-fault">PAGE FAULT</span>`;
      if (s.added)          html += ` — thêm vào frame trống`;
      else if (s.replaced !== null) html += ` — thay thế trang <strong>${s.replaced}</strong>`;
    } else {
      html += `<span class="log-hit">HIT</span>`;
    }
    html += ` | Frames: [${s.frames.map(v=>v===null?'_':v).join(', ')}]`;
    html += '</div>';
  });
  html += '</div>';

  /* Summary bar */
  html += `<div class="metrics" style="margin-top:1rem">
    <div class="metric-chip"><div class="metric-label">Page Faults</div><div class="metric-value mv-dead">${faults}</div></div>
    <div class="metric-chip"><div class="metric-label">Page Hits</div><div class="metric-value mv-green">${hits}</div></div>
    <div class="metric-chip"><div class="metric-label">Hit Rate</div><div class="metric-value mv-page">${(hits/total*100).toFixed(1)}%</div></div>
    <div class="metric-chip"><div class="metric-label">Fault Rate</div><div class="metric-value mv-yellow">${(faults/total*100).toFixed(1)}%</div></div>
  </div>`;

  document.getElementById(containerId).innerHTML = html;
}

/* ── Run all ──────────────────────────────────────────────────────── */
function runPageAll() {
  const ref    = parseRef();
  const frames = +document.getElementById('page-frames').value;
  if (!ref.length || frames < 1) return;

  pageResults = {
    fifo:    algoFIFO(ref, frames),
    lru:     algoLRU(ref, frames),
    optimal: algoOptimal(ref, frames),
    clock:   algoClock(ref, frames),
    lfu:     algoLFU(ref, frames),
  };

  document.getElementById('page-result').style.display = 'block';

  renderPageResult('fifo-content',    pageResults.fifo,    frames, ref, 'fifo');
  renderPageResult('lru-content',     pageResults.lru,     frames, ref, 'lru');
  renderPageResult('optimal-content', pageResults.optimal, frames, ref, 'optimal');
  renderPageResult('clock-content',   pageResults.clock,   frames, ref, 'clock');
  renderPageResult('lfu-content',     pageResults.lfu,     frames, ref, 'lfu');

  renderPageComparison(ref.length);
  showPageAlgo('fifo', document.querySelector('.algo-tab'));
}

/* ── Comparison table + bar chart ────────────────────────────────── */
function renderPageComparison(total) {
  const algos = ['fifo', 'lru', 'optimal', 'clock', 'lfu'];
  const labels = { fifo:'FIFO', lru:'LRU', optimal:'Optimal', clock:'Clock', lfu:'LFU' };
  const minFaults = Math.min(...algos.map(a => pageResults[a].faults));

  const tbody = document.getElementById('page-compare-body');
  tbody.innerHTML = '';
  algos.forEach(a => {
    const r = pageResults[a];
    const isBest = r.faults === minFaults;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;letter-spacing:.04em">${labels[a]}${isBest?' <span style="color:var(--green)">★</span>':''}</td>
      <td style="${isBest?'color:var(--green);font-weight:700':''}">
        ${r.faults}
      </td>
      <td>${r.hits}</td>
      <td style="color:var(--green)">${(r.hits/total*100).toFixed(1)}%</td>
      <td style="color:var(--dead)">${(r.faults/total*100).toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  /* metrics */
  document.getElementById('page-metrics').innerHTML = `
    <div class="metric-chip"><div class="metric-label">Tổng tham chiếu</div><div class="metric-value mv-yellow">${total}</div></div>
    <div class="metric-chip"><div class="metric-label">Số frame</div><div class="metric-value mv-page">${document.getElementById('page-frames').value}</div></div>
    <div class="metric-chip"><div class="metric-label">Thuật toán tốt nhất</div><div class="metric-value mv-green" style="font-size:.95rem">${algos.filter(a=>pageResults[a].faults===minFaults).map(a=>labels[a]).join(', ')}</div></div>
  `;

  drawPageBarChart(algos, labels);
}

function drawPageBarChart(algos, labels) {
  const canvas = document.getElementById('page-bar-chart');
  const ctx    = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth || 700;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#111318'; ctx.fillRect(0,0,W,H);

  const BAR_COLORS = ['#00d4ff','#00ff94','#7c3aed','#ffd60a','#f97316'];
  const n    = algos.length;
  const barW = Math.min(60, (W - 80) / (n + 1));
  const maxV = Math.max(...algos.map(a => pageResults[a].faults), 1);
  const chartH = H - 55;

  /* grid */
  ctx.strokeStyle = '#1e2330'; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = chartH - chartH * i / 4;
    ctx.beginPath(); ctx.moveTo(50,y); ctx.lineTo(W-10,y); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxV*i/4), 44, y+4);
  }

  algos.forEach((a, i) => {
    const r  = pageResults[a];
    const c  = BAR_COLORS[i];
    const x  = 60 + i * ((W - 70) / n);
    const bH = (r.faults / maxV) * chartH;
    const y  = chartH - bH;

    /* bar */
    ctx.fillStyle = c + '30'; ctx.fillRect(x, y, barW, bH);
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(x, y, barW, bH);

    /* value label */
    ctx.fillStyle = c; ctx.font = 'bold 13px JetBrains Mono'; ctx.textAlign = 'center';
    ctx.fillText(r.faults, x + barW/2, y - 6);

    /* name label */
    ctx.fillStyle = '#6b7280'; ctx.font = '11px JetBrains Mono';
    ctx.fillText(labels[a], x + barW/2, chartH + 16);
    ctx.font = '10px JetBrains Mono'; ctx.fillStyle = '#374151';
    ctx.fillText('H:' + r.hits, x + barW/2, chartH + 30);
  });

  ctx.font = '11px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280';
  ctx.fillText('Page Faults so sánh giữa các thuật toán (thấp hơn = tốt hơn)', W/2, H - 4);
}

/* ── Tab switcher ─────────────────────────────────────────────────── */
function showPageAlgo(name, btn) {
  ['fifo','lru','optimal','clock','lfu'].forEach(a => {
    const el = document.getElementById('page-' + a + '-panel');
    if (el) el.style.display = a === name ? 'block' : 'none';
  });
  document.querySelectorAll('.algo-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
