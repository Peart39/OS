/* ════════════════════════════════════════════════════════════════════
   cpu.js  —  CPU Scheduling Module
   Algorithms: FCFS | SJF | SRTF | Round Robin | Priority NP | Priority P
   ════════════════════════════════════════════════════════════════════ */

const P_COLORS = [
  '#00d4ff','#00ff94','#ffd60a','#ff4d6d',
  '#7c3aed','#f97316','#ec4899','#14b8a6',
  '#a855f7','#22d3ee'
];

let cpuProcesses = [];

/* ─── Algo selector change ─────────────────────────────────────────── */
function cpuAlgoChanged() {
  const algo = document.getElementById('cpu-algo').value;
  document.getElementById('rq-wrap').style.display = algo === 'rr' ? 'flex' : 'none';
  const showPri = algo === 'priority_np' || algo === 'priority_p';
  document.querySelectorAll('.col-priority').forEach(el => el.style.display = showPri ? '' : 'none');
  document.querySelectorAll('.td-priority').forEach(el  => el.style.display = showPri ? '' : 'none');
}

/* ─── Process table CRUD ───────────────────────────────────────────── */
function cpuAddProcess() {
  cpuProcesses.push({ at: cpuProcesses.length, bt: Math.floor(Math.random()*6)+2, priority: Math.floor(Math.random()*5)+1 });
  renderCPUTable();
}
function cpuRemoveProcess() {
  if (cpuProcesses.length > 1) { cpuProcesses.pop(); renderCPUTable(); }
}
function cpuLoadSample() {
  cpuProcesses = [
    { at:0, bt:5, priority:3 },
    { at:1, bt:3, priority:1 },
    { at:2, bt:8, priority:4 },
    { at:3, bt:6, priority:2 },
    { at:4, bt:2, priority:5 },
  ];
  renderCPUTable();
}

function renderCPUTable() {
  const algo    = document.getElementById('cpu-algo').value;
  const showPri = algo === 'priority_np' || algo === 'priority_p';
  const tbody   = document.getElementById('cpu-table-body');
  tbody.innerHTML = '';
  cpuProcesses.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="color:${P_COLORS[i%P_COLORS.length]};font-weight:700">P${i}</span></td>
      <td><input type="number" min="0"  value="${p.at}"       onchange="cpuProcesses[${i}].at=+this.value"></td>
      <td><input type="number" min="1"  value="${p.bt}"       onchange="cpuProcesses[${i}].bt=+this.value"></td>
      <td class="td-priority" style="display:${showPri?'':'none'}">
        <input type="number" min="1" value="${p.priority}" onchange="cpuProcesses[${i}].priority=+this.value">
      </td>`;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.col-priority').forEach(el => el.style.display = showPri ? '' : 'none');
}

/* ════════════════════════════════════════════════════════════════════
   SCHEDULING ALGORITHMS
   ════════════════════════════════════════════════════════════════════ */

/* helper: merge adjacent identical gantt entries */
function mergeGantt(gantt) {
  return gantt.reduce((acc, g) => {
    if (acc.length && acc[acc.length-1].id === g.id) acc[acc.length-1].end = g.end;
    else acc.push({ ...g });
    return acc;
  }, []);
}

/* ── FCFS ──────────────────────────────────────────────────────────── */
function algoFCFS(procs) {
  const sorted = [...procs].sort((a,b) => a.at - b.at || a.id - b.id);
  let time = 0; const gantt = [];
  sorted.forEach(p => {
    if (time < p.at) { gantt.push({ id:'idle', start:time, end:p.at }); time = p.at; }
    p.rt = time - p.at;
    gantt.push({ id:p.id, start:time, end:time+p.bt });
    p.ct = time + p.bt; time += p.bt;
  });
  return { gantt: mergeGantt(gantt), completed: sorted };
}

/* ── SJF (Non-preemptive) ──────────────────────────────────────────── */
function algoSJF(procs) {
  let remaining = [...procs], time = 0;
  const gantt = [], completed = [];
  while (remaining.length) {
    const avail = remaining.filter(p => p.at <= time);
    if (!avail.length) { time = remaining.sort((a,b)=>a.at-b.at)[0].at; continue; }
    avail.sort((a,b) => a.bt - b.bt || a.at - b.at);
    const p = avail[0];
    remaining.splice(remaining.indexOf(p), 1);
    if (time < p.at) gantt.push({ id:'idle', start:time, end:p.at });
    p.rt = time - p.at;
    gantt.push({ id:p.id, start:time, end:time+p.bt });
    p.ct = time + p.bt; time += p.bt; completed.push(p);
  }
  return { gantt: mergeGantt(gantt), completed };
}

/* ── SRTF (Preemptive SJF) ─────────────────────────────────────────── */
function algoSRTF(procs) {
  const rem     = procs.map(p => ({ ...p, remaining: p.bt }));
  const firstRT = {};
  let time = 0, done = 0;
  const gantt = [], completed = [];
  while (done < rem.length) {
    const avail = rem.filter(p => p.at <= time && p.remaining > 0);
    if (!avail.length) {
      const last = gantt[gantt.length-1];
      if (last && last.id === 'idle') last.end++; else gantt.push({ id:'idle', start:time, end:time+1 });
      time++; continue;
    }
    avail.sort((a,b) => a.remaining - b.remaining || a.at - b.at);
    const p = avail[0];
    if (!(p.id in firstRT)) firstRT[p.id] = time - p.at;
    const last = gantt[gantt.length-1];
    if (last && last.id === p.id) last.end++; else gantt.push({ id:p.id, start:time, end:time+1 });
    p.remaining--; time++;
    if (p.remaining === 0) { p.ct = time; p.rt = firstRT[p.id]; done++; completed.push(p); }
  }
  return { gantt: mergeGantt(gantt), completed };
}

/* ── Round Robin ───────────────────────────────────────────────────── */
function algoRR(procs, quantum) {
  const rem     = procs.map(p => ({ ...p, remaining: p.bt })).sort((a,b) => a.at - b.at);
  const firstRT = {};
  let time = 0;
  const queue = [], gantt = [], completed = [], visited = new Set();
  rem.filter(p => p.at <= 0).forEach(p => { queue.push(p); visited.add(p.id); });

  while (queue.length || rem.some(p => p.remaining > 0)) {
    if (!queue.length) {
      const next = rem.filter(p => p.remaining > 0 && !visited.has(p.id)).sort((a,b)=>a.at-b.at)[0];
      if (!next) break;
      time = next.at; queue.push(next); visited.add(next.id);
    }
    const p   = queue.shift();
    if (!(p.id in firstRT)) firstRT[p.id] = time - p.at;
    const run = Math.min(quantum, p.remaining);
    const t0  = time; time += run; p.remaining -= run;
    const last = gantt[gantt.length-1];
    if (last && last.id === p.id) last.end = time; else gantt.push({ id:p.id, start:t0, end:time });
    rem.filter(q => q.at > t0 && q.at <= time && !visited.has(q.id))
       .forEach(q => { queue.push(q); visited.add(q.id); });
    if (p.remaining > 0) queue.push(p);
    else { p.ct = time; p.rt = firstRT[p.id]; completed.push(p); }
  }
  return { gantt: mergeGantt(gantt), completed };
}

/* ── Priority Non-preemptive ───────────────────────────────────────── */
function algoPriorityNP(procs) {
  let remaining = [...procs], time = 0;
  const gantt = [], completed = [];
  while (remaining.length) {
    const avail = remaining.filter(p => p.at <= time);
    if (!avail.length) { time = remaining.sort((a,b)=>a.at-b.at)[0].at; continue; }
    avail.sort((a,b) => a.priority - b.priority || a.at - b.at);
    const p = avail[0];
    remaining.splice(remaining.indexOf(p), 1);
    if (time < p.at) gantt.push({ id:'idle', start:time, end:p.at });
    p.rt = time - p.at;
    gantt.push({ id:p.id, start:time, end:time+p.bt });
    p.ct = time + p.bt; time += p.bt; completed.push(p);
  }
  return { gantt: mergeGantt(gantt), completed };
}

/* ── Priority Preemptive ───────────────────────────────────────────── */
function algoPriorityP(procs) {
  const rem     = procs.map(p => ({ ...p, remaining: p.bt }));
  const firstRT = {};
  let time = 0, done = 0;
  const gantt = [], completed = [];
  while (done < rem.length) {
    const avail = rem.filter(p => p.at <= time && p.remaining > 0);
    if (!avail.length) {
      const last = gantt[gantt.length-1];
      if (last && last.id === 'idle') last.end++; else gantt.push({ id:'idle', start:time, end:time+1 });
      time++; continue;
    }
    avail.sort((a,b) => a.priority - b.priority || a.at - b.at);
    const p = avail[0];
    if (!(p.id in firstRT)) firstRT[p.id] = time - p.at;
    const last = gantt[gantt.length-1];
    if (last && last.id === p.id) last.end++; else gantt.push({ id:p.id, start:time, end:time+1 });
    p.remaining--; time++;
    if (p.remaining === 0) { p.ct = time; p.rt = firstRT[p.id]; done++; completed.push(p); }
  }
  return { gantt: mergeGantt(gantt), completed };
}

/* ════════════════════════════════════════════════════════════════════
   RUN DISPATCHER
   ════════════════════════════════════════════════════════════════════ */
function runCPU() {
  const algo    = document.getElementById('cpu-algo').value;
  const quantum = +document.getElementById('quantum').value || 2;
  const procs   = cpuProcesses.map((p, i) => ({ ...p, id: i }));

  const dispatch = {
    fcfs:        () => algoFCFS(procs),
    sjf:         () => algoSJF(procs),
    srtf:        () => algoSRTF(procs),
    rr:          () => algoRR(procs, quantum),
    priority_np: () => algoPriorityNP(procs),
    priority_p:  () => algoPriorityP(procs),
  };

  const { gantt, completed } = dispatch[algo]();
  completed.forEach(p => {
    p.tat = p.ct - p.at;
    p.wt  = p.tat - p.bt;
    if (p.rt === undefined) p.rt = p.wt;
  });
  renderCPUResult(gantt, completed);
}

/* ════════════════════════════════════════════════════════════════════
   RENDER RESULTS
   ════════════════════════════════════════════════════════════════════ */
function renderCPUResult(gantt, completed) {
  document.getElementById('cpu-result').style.display = 'block';
  const total = gantt[gantt.length-1].end - gantt[0].start;

  /* ── Gantt chart ── */
  const chart     = document.getElementById('gantt-chart');
  const labelsDiv = document.getElementById('gantt-labels');
  chart.innerHTML = ''; labelsDiv.innerHTML = '';

  gantt.forEach((g, i) => {
    const pct = ((g.end - g.start) / total * 100).toFixed(2) + '%';
    const div = document.createElement('div');
    div.className = 'gantt-block' + (g.id === 'idle' ? ' idle' : '');
    div.style.width = pct;
    div.style.animationDelay = i * 0.04 + 's';
    if (g.id !== 'idle') {
      const c = P_COLORS[g.id % P_COLORS.length];
      div.style.background = `linear-gradient(135deg,${c}20,${c}42)`;
      div.style.borderTop  = `2px solid ${c}`;
      div.style.color      = c;
    }
    div.innerHTML = `<span>${g.id === 'idle' ? '—' : 'P' + g.id}</span>`;
    // tooltip
    div.title = g.id === 'idle'
      ? `Idle: ${g.start}→${g.end}`
      : `P${g.id}: ${g.start}→${g.end} (${g.end-g.start} units)`;
    chart.appendChild(div);
  });

  /* time labels */
  const pts = [...new Set([gantt[0].start, ...gantt.map(g => g.end)])];
  pts.forEach(t => {
    const span = document.createElement('span');
    span.className = 'gantt-label';
    span.style.left = ((t - gantt[0].start) / total * 100) + '%';
    span.textContent = t;
    labelsDiv.appendChild(span);
  });

  /* ── Stats table ── */
  const tbody = document.getElementById('cpu-stats-body');
  tbody.innerHTML = '';
  let totWT = 0, totTAT = 0, totRT = 0;

  completed.sort((a,b) => a.id - b.id).forEach(p => {
    totWT += p.wt; totTAT += p.tat; totRT += p.rt;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="color:${P_COLORS[p.id%P_COLORS.length]};font-weight:700">P${p.id}</span></td>
      <td>${p.at}</td><td>${p.bt}</td>
      <td class="highlight">${p.ct}</td>
      <td>${p.tat}</td><td>${p.wt}</td><td>${p.rt}</td>`;
    tbody.appendChild(tr);
  });

  const n = completed.length;
  const avgRow = document.createElement('tr');
  avgRow.className = 'avg-row';
  avgRow.innerHTML = `
    <td>Trung bình</td><td>—</td><td>—</td><td>—</td>
    <td>${(totTAT/n).toFixed(2)}</td>
    <td>${(totWT/n).toFixed(2)}</td>
    <td>${(totRT/n).toFixed(2)}</td>`;
  tbody.appendChild(avgRow);

  /* ── Metric chips ── */
  document.getElementById('cpu-metrics').innerHTML = `
    <div class="metric-chip">
      <div class="metric-label">Avg Waiting Time</div>
      <div class="metric-value mv-cpu">${(totWT/n).toFixed(2)}</div>
    </div>
    <div class="metric-chip">
      <div class="metric-label">Avg Turnaround</div>
      <div class="metric-value mv-cpu">${(totTAT/n).toFixed(2)}</div>
    </div>
    <div class="metric-chip">
      <div class="metric-label">Avg Response Time</div>
      <div class="metric-value mv-cpu">${(totRT/n).toFixed(2)}</div>
    </div>
    <div class="metric-chip">
      <div class="metric-label">Số tiến trình</div>
      <div class="metric-value mv-green">${n}</div>
    </div>
    <div class="metric-chip">
      <div class="metric-label">Thời gian tổng</div>
      <div class="metric-value mv-yellow">${gantt[gantt.length-1].end}</div>
    </div>
    <div class="metric-chip">
      <div class="metric-label">CPU Utilization</div>
      <div class="metric-value mv-page">${(completed.reduce((s,p)=>s+p.bt,0)/gantt[gantt.length-1].end*100).toFixed(1)}%</div>
    </div>`;

  /* ── Bar chart ── */
  drawCPUBarChart(completed);
}

/* ── Bar chart: WT + TAT per process ──────────────────────────────── */
function drawCPUBarChart(completed) {
  const canvas    = document.getElementById('cpu-bar-chart');
  const ctx       = canvas.getContext('2d');
  const container = canvas.parentElement;
  const style     = getComputedStyle(container);
  const padH      = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  canvas.width    = Math.max((container.clientWidth - padH) || 0, 300);
  canvas.height   = Math.max(Math.round(canvas.width * 0.25), 160);
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#181c24'; ctx.fillRect(0, 0, W, H);

  const n       = completed.length;
  const maxV    = Math.max(...completed.flatMap(p => [p.wt, p.tat]), 1);
  const TOP_PAD = 24;
  const BOT_PAD = 44;
  const chartH  = H - TOP_PAD - BOT_PAD;
  const groupW  = (W - 60) / n;
  const barW    = Math.min(28, groupW * 0.35);
  const barGap  = Math.min(6, groupW * 0.06);

  /* grid lines */
  ctx.strokeStyle = '#1e2330'; ctx.lineWidth = 1;
  [1,2,3,4].forEach(i => {
    const y = TOP_PAD + chartH - chartH * i / 4;
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 10, y); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxV * i / 4), 44, y + 4);
  });

  /* bars */
  completed.sort((a,b)=>a.id-b.id).forEach((p, i) => {
    const cx = 60 + i * groupW + groupW / 2;
    const c  = P_COLORS[p.id % P_COLORS.length];

    const drawBar = (x, val, color) => {
      const bH = Math.max((val / maxV) * chartH, 2);
      const y  = TOP_PAD + chartH - bH;
      const grad = ctx.createLinearGradient(x, y, x, TOP_PAD + chartH);
      grad.addColorStop(0, color + '99');
      grad.addColorStop(1, color + '22');
      ctx.fillStyle = grad; ctx.fillRect(x, y, barW, bH);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, barW, bH);
      ctx.fillStyle = color; ctx.font = 'bold 10px JetBrains Mono'; ctx.textAlign = 'center';
      ctx.fillText(val, x + barW / 2, Math.max(y - 4, TOP_PAD + 10));
    };

    drawBar(cx - barW - barGap / 2, p.wt, c);
    drawBar(cx + barGap / 2,        p.tat, '#ffd60a');

    const labelY = TOP_PAD + chartH;
    ctx.fillStyle = c; ctx.font = 'bold 11px JetBrains Mono'; ctx.textAlign = 'center';
    ctx.fillText('P' + p.id, cx, labelY + 16);
    ctx.fillStyle = '#cfcfcf'; ctx.font = '9px JetBrains Mono';
    ctx.fillText('AT=' + p.at, cx, labelY + 28);
  });

  /* legend — đặt ở góc trên trái, tránh đè lên cột */
  const lx = 56, ly = 6;
  ctx.fillStyle = '#00d4ff88'; ctx.fillRect(lx, ly, 12, 12);
  ctx.fillStyle = '#aaa'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'left';
  ctx.fillText('Waiting Time', lx + 16, ly + 10);
  ctx.fillStyle = '#ffd60a88'; ctx.fillRect(lx + 110, ly, 12, 12);
  ctx.fillText('Turnaround Time', lx + 126, ly + 10);
}

/* ── Init ─────────────────────────────────────────────────────────── */
cpuLoadSample();