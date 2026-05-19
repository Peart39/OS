/* ── page.js — Page Replacement Module (Fixed) ─────────────────────── */

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
  const val = document.getElementById('page-ref').value.trim();
  if (!val) return [];
  return val.split(/\s+/).map(Number).filter(v => !isNaN(v));
}

/*
  step.status:
    'hit'   — trang đã có trong frame
    'empty' — thêm vào frame trống (không đánh dấu fault)
    'fault' — page fault thực sự (phải thay thế)
*/

/* ══════════════════════════════════════════════
   ALGORITHMS
   ══════════════════════════════════════════════ */

/* ── FIFO ─────────────────────────────────────────────────────────── */
function algoFIFO(ref, numFrames) {
  let memory = [];   // các trang hiện trong bộ nhớ
  let queue  = [];   // thứ tự vào (FIFO)
  let faults = 0, hits = 0, steps = [];

  ref.forEach(page => {
    const inMem = memory.includes(page);
    let status = '', replaced = null;

    if (!inMem) {
      if (memory.length < numFrames) {
        // Frame còn trống → chỉ thêm vào, không tính fault
        status = 'empty';
        memory.push(page);
        queue.push(page);
      } else {
        // Frame đầy → fault thực sự
        status = 'fault';
        faults++;
        replaced = queue.shift();
        memory[memory.indexOf(replaced)] = page;
        queue.push(page);
      }
    } else {
      status = 'hit';
      hits++;
    }

    steps.push({ page, frames: [...memory], status, replaced });
  });

  return { steps, faults, hits };
}

/* ── LRU ──────────────────────────────────────────────────────────── */
function algoLRU(ref, numFrames) {
  let memory = [];
  let faults = 0, hits = 0, steps = [];

  ref.forEach((page, idx) => {
    const inMem = memory.includes(page);
    let status = '', replaced = null;

    if (!inMem) {
      if (memory.length < numFrames) {
        status = 'empty';
        memory.push(page);
      } else {
        status = 'fault';
        faults++;
        // Tìm trang ít được dùng gần nhất
        let lruIdx = -1, lruTime = Infinity;
        memory.forEach((p, i) => {
          // Tìm lần xuất hiện gần nhất trước idx
          let last = -1;
          for (let k = idx - 1; k >= 0; k--) {
            if (ref[k] === p) { last = k; break; }
          }
          // Nếu không tìm thấy → last = -1 → LRU nhất
          if (last < lruTime) { lruTime = last; lruIdx = i; }
        });
        replaced = memory[lruIdx];
        memory[lruIdx] = page;
      }
    } else {
      status = 'hit';
      hits++;
    }

    steps.push({ page, frames: [...memory], status, replaced });
  });

  return { steps, faults, hits };
}

/* ── Optimal ──────────────────────────────────────────────────────── */
function algoOptimal(ref, numFrames) {
  let memory = [];
  let faults = 0, hits = 0, steps = [];

  ref.forEach((page, idx) => {
    const inMem = memory.includes(page);
    let status = '', replaced = null;

    if (!inMem) {
      if (memory.length < numFrames) {
        status = 'empty';
        memory.push(page);
      } else {
        status = 'fault';
        faults++;
        // Tìm trang sẽ được dùng xa nhất trong tương lai
        let farthestDist = -1, replIdx = 0;
        memory.forEach((p, i) => {
          const future = ref.slice(idx + 1).indexOf(p);
          const dist   = future === -1 ? Infinity : future;
          if (dist > farthestDist) { farthestDist = dist; replIdx = i; }
        });
        replaced = memory[replIdx];
        memory[replIdx] = page;
      }
    } else {
      status = 'hit';
      hits++;
    }

    steps.push({ page, frames: [...memory], status, replaced });
  });

  return { steps, faults, hits };
}

/* ── Clock (Second Chance) ────────────────────────────────────────── */
function algoClock(ref, numFrames) {
  let memory  = Array(numFrames).fill(null);
  let refBits = Array(numFrames).fill(0);
  let pointer = 0;
  let faults = 0, hits = 0, steps = [];

  ref.forEach(page => {
    const idx = memory.indexOf(page);
    let status = '', replaced = null, victimSlot = -1;

    if (idx !== -1) {
      // HIT
      status = 'hit';
      hits++;
      refBits[idx] = 1;
    } else {
      // Tìm victim theo thuật toán Clock
      while (true) {
        if (refBits[pointer] === 0) {
          victimSlot = pointer;
          replaced   = memory[pointer];          // có thể null nếu frame trống
          memory[pointer] = page;
          refBits[pointer] = 0;
          pointer = (pointer + 1) % numFrames;
          break;
        }
        refBits[pointer] = 0;
        pointer = (pointer + 1) % numFrames;
      }

      if (replaced === null) {
        // Frame trống → không tính fault
        status   = 'empty';
        replaced = null;
      } else {
        status = 'fault';
        faults++;
      }
    }

    steps.push({
      page,
      frames:   [...memory],
      refBits:  [...refBits],
      pointer,          // con trỏ SAU khi đã advance
      victimSlot,       // slot vừa bị thay thế (-1 nếu hit)
      status,
      replaced,
    });
  });

  return { steps, faults, hits };
}

/* ══════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════ */

function renderPageResult(containerId, result, numFrames, ref, algoName) {
  const { steps, faults, hits } = result;
  const total = ref.length;

  /* ── Page chips ── */
  let html = '<div class="page-ref-display">';
  steps.forEach(s => {
    let chipClass = 'page-chip ';
    if      (s.status === 'hit')   chipClass += 'hit';
    else if (s.status === 'empty') chipClass += 'empty';
    else                           chipClass += 'fault';
    html += `<div class="${chipClass}">${s.page}</div>`;
  });
  html += '</div>';

  /* ── Frame timeline table ── */
  html += '<div class="table-wrap"><table class="frame-table"><thead><tr>';
  html += '<th style="white-space:nowrap">Frame</th>';
  steps.forEach((_, i) => { html += `<th>${ref[i]}</th>`; });
  html += '</tr></thead><tbody>';

  for (let f = 0; f < numFrames; f++) {
    html += '<tr>';
    html += `<td style="color:var(--text-dim);font-weight:600">F${f}</td>`;
    steps.forEach(s => {
      const val = (s.frames[f] !== undefined && s.frames[f] !== null) ? s.frames[f] : '';
      let cls = '';
      if (s.status === 'hit' && s.frames[f] === s.page) {
        cls = 'cell-hit';
      } else if (s.status === 'empty' && s.frames[f] === s.page) {
        cls = 'cell-empty';          // màu riêng — xanh nhạt không nổi bật
      } else if (s.status === 'fault' && s.replaced !== null && s.frames[f] === s.page) {
        cls = 'cell-replaced';       // màu đỏ/cam — fault thực sự
      }
      html += `<td class="${cls}">${val}</td>`;
    });
    html += '</tr>';
  }

  /* Ref bits row cho Clock */
  if (algoName === 'clock') {
    for (let f = 0; f < numFrames; f++) {
      html += `<tr><td style="color:#6b7280;font-size:.65rem">R${f}</td>`;
      steps.forEach(s => {
        const rb = s.refBits ? s.refBits[f] : '';
        html += `<td style="font-size:.7rem;color:${rb ? 'var(--yellow)' : 'var(--text-muted)'}">${rb !== undefined ? rb : ''}</td>`;
      });
      html += '</tr>';
    }
  }

  /* Result row */
  html += '<tr><td style="font-size:.65rem;color:var(--text-dim)">Result</td>';
  steps.forEach(s => {
    if (s.status === 'hit') {
      html += `<td><span class="hit-marker">H</span></td>`;
    } else if (s.status === 'empty') {
      html += `<td><span class="empty-marker">+</span></td>`;
    } else {
      html += `<td><span class="fault-marker">F</span></td>`;
    }
  });
  html += '</tr></tbody></table></div>';

  /* ── Step log ── */
  html += '<div class="step-log" style="margin-top:1rem">';
  steps.forEach((s, i) => {
    html += `<div class="log-line">
      <span class="log-t">[${String(i + 1).padStart(2, '0')}]</span>
      <span class="log-info">Page ${s.page}</span> → `;

    if (s.status === 'hit') {
      html += `<span class="log-hit">HIT</span>`;
    } else if (s.status === 'empty') {
      html += `<span class="log-empty">Thêm vào frame trống</span>`;
    } else {
      html += `<span class="log-fault">PAGE FAULT</span>`;
      if (s.replaced !== null) html += ` — thay thế trang <strong>${s.replaced}</strong>`;
    }

    html += ` | Frames: [${s.frames.map(v => v === null ? '_' : v).join(', ')}]`;
    html += '</div>';
  });
  html += '</div>';

  /* ── Summary metrics ── */
  html += `<div class="metrics" style="margin-top:1rem">
    <div class="metric-chip"><div class="metric-label">Page Faults</div><div class="metric-value mv-dead">${faults}</div></div>
    <div class="metric-chip"><div class="metric-label">Page Hits</div><div class="metric-value mv-green">${hits}</div></div>
    <div class="metric-chip"><div class="metric-label">Hit Rate</div><div class="metric-value mv-page">${(hits / total * 100).toFixed(1)}%</div></div>
    <div class="metric-chip"><div class="metric-label">Fault Rate</div><div class="metric-value mv-yellow">${(faults / total * 100).toFixed(1)}%</div></div>
  </div>`;

  document.getElementById(containerId).innerHTML = html;
}

/* ── Run all ──────────────────────────────────────────────────────── */
function runPageAll() {
  const ref    = parseRef();
  const frames = parseInt(document.getElementById('page-frames').value, 10);

  if (!ref.length) {
    alert('Vui lòng nhập chuỗi tham chiếu trang hợp lệ.');
    return;
  }
  if (isNaN(frames) || frames < 1) {
    alert('Số frame phải ≥ 1.');
    return;
  }

  pageResults = {
    fifo:    algoFIFO(ref, frames),
    lru:     algoLRU(ref, frames),
    optimal: algoOptimal(ref, frames),
    clock:   algoClock(ref, frames),
  };

  document.getElementById('page-result').style.display = 'block';

  renderPageResult('fifo-content',    pageResults.fifo,    frames, ref, 'fifo');
  renderPageResult('lru-content',     pageResults.lru,     frames, ref, 'lru');
  renderPageResult('optimal-content', pageResults.optimal, frames, ref, 'optimal');
  renderPageResult('clock-content',   pageResults.clock,   frames, ref, 'clock');

  renderPageComparison(ref.length, frames);
  showPageAlgo('fifo', document.querySelector('.algo-tab'));
}

/* ── Comparison table + bar chart ────────────────────────────────── */
function renderPageComparison(total, frames) {
  const algos  = ['fifo', 'lru', 'optimal', 'clock'];
  const labels = { fifo: 'FIFO', lru: 'LRU', optimal: 'Optimal', clock: 'Clock' };
  const minFaults = Math.min(...algos.map(a => pageResults[a].faults));

  const tbody = document.getElementById('page-compare-body');
  tbody.innerHTML = '';
  algos.forEach(a => {
    const r      = pageResults[a];
    const isBest = r.faults === minFaults;
    const tr     = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;letter-spacing:.04em">${labels[a]}${isBest ? ' <span style="color:var(--green)">★</span>' : ''}</td>
      <td style="${isBest ? 'color:var(--green);font-weight:700' : ''}">${r.faults}</td>
      <td>${r.hits}</td>
      <td style="color:var(--green)">${(r.hits / total * 100).toFixed(1)}%</td>
      <td style="color:var(--dead)">${(r.faults / total * 100).toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('page-metrics').innerHTML = `
    <div class="metric-chip"><div class="metric-label">Tổng tham chiếu</div><div class="metric-value mv-yellow">${total}</div></div>
    <div class="metric-chip"><div class="metric-label">Số frame</div><div class="metric-value mv-page">${frames}</div></div>
    <div class="metric-chip"><div class="metric-label">Thuật toán tốt nhất</div><div class="metric-value mv-green" style="font-size:.95rem">${algos.filter(a => pageResults[a].faults === minFaults).map(a => labels[a]).join(', ')}</div></div>
  `;

  drawPageBarChart(algos, labels);
}

let _pageBarResizeHandler = null;
function drawPageBarChart(algos, labels) {
  const canvas = document.getElementById('page-bar-chart');
  const ctx    = canvas.getContext('2d');

  function draw() {
    const container = canvas.parentElement;
    const style     = getComputedStyle(container);
    const padH      = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    canvas.width    = Math.max((container.clientWidth - padH) || 0, 300);
    canvas.height   = Math.max(Math.round(canvas.width * 0.30), 160);
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111318'; ctx.fillRect(0, 0, W, H);

    const BAR_COLORS = ['#00d4ff', '#00ff94', '#7c3aed', '#ffd60a'];
    const n      = algos.length;
    const barW   = Math.min(60, (W - 80) / (n + 1));
    const maxV   = Math.max(...algos.map(a => pageResults[a].faults), 1);
    const TOP_PAD = 28;                      // chừa chỗ cho số trên đỉnh cột
    const chartH  = H - 55 - TOP_PAD;
    const chartY0 = TOP_PAD;                 // y gốc trên cùng của vùng vẽ

    /* grid lines */
    ctx.strokeStyle = '#1e2330'; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = chartY0 + chartH - chartH * i / 4;
      ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxV * i / 4), 44, y + 4);
    }

    algos.forEach((a, i) => {
      const r   = pageResults[a];
      const c   = BAR_COLORS[i];
      const x   = 60 + i * ((W - 70) / n);
      const bH  = (r.faults / maxV) * chartH;
      const y   = chartY0 + chartH - bH;

      ctx.fillStyle   = c + '30'; ctx.fillRect(x, y, barW, bH);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(x, y, barW, bH);

      /* số trên đỉnh — không bao giờ bị clipped vì TOP_PAD đã chừa chỗ */
      ctx.fillStyle = c; ctx.font = 'bold 13px JetBrains Mono'; ctx.textAlign = 'center';
      ctx.fillText(r.faults, x + barW / 2, Math.max(y - 6, chartY0 + 14));

      const labelY = chartY0 + chartH;
      ctx.fillStyle = '#ffffff'; ctx.font = '11px JetBrains Mono';
      ctx.fillText(labels[a], x + barW / 2, labelY + 16);
      ctx.font = '10px JetBrains Mono'; ctx.fillStyle = '#959595';
      ctx.fillText('H:' + r.hits, x + barW / 2, labelY + 30);
    });

    ctx.font = '11px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280';
    ctx.fillText('Page Faults so sánh (thấp hơn = tốt hơn)', W / 2, H - 4);
  }

  draw();

  /* Responsive resize */
  if (_pageBarResizeHandler) window.removeEventListener('resize', _pageBarResizeHandler);
  _pageBarResizeHandler = draw;
  window.addEventListener('resize', _pageBarResizeHandler);
}

/* ── Tab switcher ─────────────────────────────────────────────────── */
function showPageAlgo(name, btn) {
  ['fifo', 'lru', 'optimal', 'clock'].forEach(a => {
    const el = document.getElementById('page-' + a + '-panel');
    if (el) el.style.display = a === name ? 'block' : 'none';
  });
  document.querySelectorAll('.algo-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}