/* ════════════════════════════════════════════════════════════════════
   deadlock.js  —  Deadlock Detection & Banker's Algorithm Module
   ════════════════════════════════════════════════════════════════════ */

let deadN = 5, deadM = 3;
let deadAlloc = [], deadMax = [], deadAvail = [];

/* ─── Sample data ──────────────────────────────────────────────────── */
function deadLoadSample(n) {
  if (n === 1) {
    // Silberschatz textbook classic
    deadN = 5; deadM = 3;
    deadAlloc = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
    deadMax   = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
    deadAvail = [3,3,2];
  } else if (n === 2) {
    deadN = 4; deadM = 3;
    deadAlloc = [[0,1,0],[3,0,2],[2,1,0],[0,0,2]];
    deadMax   = [[4,2,1],[6,1,3],[2,1,2],[1,0,3]];
    deadAvail = [2,2,2];
  } else if (n === 3) {
    // Unsafe state example
    deadN = 3; deadM = 2;
    deadAlloc = [[1,0],[2,1],[0,2]];
    deadMax   = [[2,1],[3,2],[1,3]];
    deadAvail = [0,0];
  }
  document.getElementById('dead-n').value = deadN;
  document.getElementById('dead-m').value = deadM;
  renderDeadMatrices();
}

/* ─── Rebuild on n/m change ────────────────────────────────────────── */
function deadRebuild() {
  const newN = +document.getElementById('dead-n').value;
  const newM = +document.getElementById('dead-m').value;
  // Preserve existing values while resizing
  deadAlloc = Array.from({length:newN}, (_,i) => Array.from({length:newM}, (_,j) => (deadAlloc[i]||[])[j] || 0));
  deadMax   = Array.from({length:newN}, (_,i) => Array.from({length:newM}, (_,j) => (deadMax[i]||[])[j]   || 0));
  deadAvail = Array.from({length:newM}, (_,j) => deadAvail[j] || 0);
  deadN = newN; deadM = newM;
  renderDeadMatrices();
}

/* ─── Render matrix inputs ─────────────────────────────────────────── */
function renderDeadMatrices() {
  const wrap = document.getElementById('dead-matrices');
  wrap.innerHTML = '';

  ['Allocation', 'Max'].forEach((name, mi) => {
    const mat   = mi === 0 ? deadAlloc : deadMax;
    const block = document.createElement('div');
    block.className = 'matrix-block';

    // Column headers
    let hdr = `<div class="card-title dead-color" style="margin-bottom:.4rem">${name}</div>
      <div style="display:flex;margin-bottom:4px;margin-left:28px">`;
    for (let j = 0; j < deadM; j++)
      hdr += `<div style="width:46px;text-align:center;font-size:.6rem;color:var(--text-muted)">R${j}</div>`;
    hdr += '</div>';
    block.innerHTML = hdr;

    // Rows
    for (let i = 0; i < deadN; i++) {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      row.style.marginBottom = '4px';
      row.innerHTML = `<span style="width:28px;font-size:.7rem;font-weight:700;
        color:${P_COLORS[i%P_COLORS.length]};line-height:32px;flex-shrink:0">P${i}</span>`;
      for (let j = 0; j < deadM; j++) {
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = 0; inp.className = 'matrix-cell';
        inp.value = mat[i][j];
        inp.dataset.i = i; inp.dataset.j = j; inp.dataset.mi = mi;
        inp.oninput = function() {
          const ii = +this.dataset.i, jj = +this.dataset.j;
          if (+this.dataset.mi === 0) deadAlloc[ii][jj] = +this.value;
          else                         deadMax[ii][jj]   = +this.value;
        };
        row.appendChild(inp);
      }
      block.appendChild(row);
    }
    wrap.appendChild(block);
  });

  // Available vector
  const availRow = document.getElementById('dead-available-row');
  availRow.innerHTML = `<span style="width:28px;font-size:.7rem;color:var(--text-dim);line-height:32px">Av:</span>`;
  for (let j = 0; j < deadM; j++) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = 0; inp.className = 'matrix-cell';
    inp.value = deadAvail[j] || 0;
    inp.dataset.j = j;
    inp.oninput = function() { deadAvail[+this.dataset.j] = +this.value; };
    availRow.appendChild(inp);
  }
}

/* ─── Read DOM → arrays ────────────────────────────────────────────── */
function syncMatricesFromDOM() {
  document.querySelectorAll('#dead-matrices input').forEach(inp => {
    const mi = +inp.dataset.mi, i = +inp.dataset.i, j = +inp.dataset.j;
    if (mi === 0) deadAlloc[i][j] = +inp.value;
    else           deadMax[i][j]   = +inp.value;
  });
  document.querySelectorAll('#dead-available-row input').forEach(inp => {
    deadAvail[+inp.dataset.j] = +inp.value;
  });
}

/* ════════════════════════════════════════════════════════════════════
   BANKER'S SAFETY ALGORITHM
   ════════════════════════════════════════════════════════════════════ */
function bankerSafety(alloc, max, avail, n, m) {
  const work   = [...avail];
  const finish = Array(n).fill(false);
  const need   = max.map((row, i) => row.map((v, j) => v - alloc[i][j]));
  const seq    = [], log = [];

  log.push(`<span class="log-info">► Khởi tạo Work = [${work.join(', ')}]</span>`);
  log.push(`<span class="log-info">► Need matrix tính = Max − Allocation</span>`);

  // Up to n passes
  for (let pass = 0; pass < n; pass++) {
    let found = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;
      const canRun = need[i].every((nv, j) => nv <= work[j]);
      if (canRun) {
        log.push(`<span class="log-t">[${seq.length+1}]</span> <span class="log-hit">P${i} có thể chạy</span>: Need=[${need[i].join(',')}] ≤ Work=[${work.join(',')}]`);
        for (let j = 0; j < m; j++) work[j] += alloc[i][j];
        finish[i] = true; seq.push(i); found = true;
        log.push(`<span class="log-t">   </span>→ Giải phóng, Work mới = [${work.join(', ')}]`);
        break;
      }
    }
    if (!found) break;
  }

  const safe    = finish.every(Boolean);
  const blocked = finish.map((f,i) => f ? null : i).filter(i => i !== null);

  if (safe) {
    log.push(`<span class="log-hit">✅ SAFE STATE — Safe Sequence: P${seq.join(' → P')}</span>`);
  } else {
    log.push(`<span class="log-fault">❌ UNSAFE STATE — Không tìm được safe sequence</span>`);
    log.push(`<span class="log-fault">⚠ Tiến trình bị kẹt: ${blocked.map(i=>'P'+i).join(', ')}</span>`);
  }
  return { safe, seq, log, need, blocked };
}

/* ─── Run safety check ─────────────────────────────────────────────── */
function runDeadlock() {
  syncMatricesFromDOM();
  const { safe, seq, log, need, blocked } = bankerSafety(deadAlloc, deadMax, deadAvail, deadN, deadM);

  document.getElementById('dead-result').style.display = 'block';

  // Badge
  document.getElementById('dead-safe-badge').innerHTML = safe
    ? `<span class="safe-badge safe">✅ HỆ THỐNG AN TOÀN (Safe State)</span>`
    : `<span class="safe-badge unsafe">❌ HỆ THỐNG KHÔNG AN TOÀN — Nguy cơ Deadlock (${blocked.map(i=>'P'+i).join(', ')} bị kẹt)</span>`;

  // Safe sequence
  const seqDiv = document.getElementById('dead-seq');
  seqDiv.innerHTML = safe
    ? `<span style="font-size:.72rem;color:var(--text-dim);margin-right:.5rem">Safe sequence:</span>`
      + seq.map((s,i) => `<span class="seq-item" style="animation-delay:${i*.1}s">P${s}</span>`
        + (i < seq.length-1 ? '<span class="seq-arrow">→</span>' : '')).join('')
    : `<span style="color:var(--dead);font-size:.82rem">Không tồn tại safe sequence</span>`;

  // Need matrix table
  renderNeedMatrix(need);

  // Log
  document.getElementById('dead-log').innerHTML =
    log.map(l => `<div class="log-line">${l}</div>`).join('');

  // RAG Canvas
  drawRAG(safe, seq, need);
}

/* ─── Need matrix table ────────────────────────────────────────────── */
function renderNeedMatrix(need) {
  let html = `<table class="frame-table"><thead><tr>
    <th>P \\ R</th>${Array.from({length:deadM}, (_,j) => `<th>R${j}</th>`).join('')}
    </tr></thead><tbody>`;
  for (let i = 0; i < deadN; i++) {
    html += `<tr><td style="font-weight:700;color:${P_COLORS[i%P_COLORS.length]}">P${i}</td>`;
    for (let j = 0; j < deadM; j++) {
      const v = need[i][j];
      html += `<td class="${v < 0 ? 'cell-fault' : ''}">${v < 0 ? v + ' ⚠' : v}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  if (need.some(r => r.some(v => v < 0)))
    html += `<p style="color:var(--dead);font-size:.72rem;margin-top:.5rem">⚠ Need âm: Allocation vượt quá Max!</p>`;
  document.getElementById('dead-need-table').innerHTML = html;
}

/* ─── Resource Request (Banker step 3) ─────────────────────────────── */
function toggleRRSection() {
  const sec     = document.getElementById('rr-section');
  const showing = sec.style.display !== 'none';
  sec.style.display = showing ? 'none' : 'block';
  if (!showing) {
    // Rebuild PID selector
    const sel = document.getElementById('rr-pid');
    sel.innerHTML = '';
    for (let i = 0; i < deadN; i++) {
      const o = document.createElement('option'); o.value = i; o.textContent = 'P' + i; sel.appendChild(o);
    }
    // Rebuild request inputs
    const reqRow = document.getElementById('rr-req-row');
    reqRow.innerHTML = '';
    for (let j = 0; j < deadM; j++) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = 0; inp.value = 0; inp.className = 'matrix-cell'; inp.title = 'R' + j;
      reqRow.appendChild(inp);
    }
  }
}

function checkDeadlockRequest() {
  syncMatricesFromDOM();
  const pid     = +document.getElementById('rr-pid').value;
  const request = [...document.querySelectorAll('#rr-req-row input')].map(i => +i.value);
  const need    = deadMax[pid].map((v, j) => v - deadAlloc[pid][j]);
  const result  = document.getElementById('rr-result');

  // Step 1: request ≤ need
  for (let j = 0; j < deadM; j++) {
    if (request[j] > need[j]) {
      result.innerHTML = `<span class="safe-badge unsafe">
        ❌ Request[R${j}]=${request[j]} > Need[R${j}]=${need[j]} — Vượt quá nhu cầu đã khai báo!</span>`;
      return;
    }
  }
  // Step 2: request ≤ available
  for (let j = 0; j < deadM; j++) {
    if (request[j] > deadAvail[j]) {
      result.innerHTML = `<span class="safe-badge unsafe">
        ⏳ Request[R${j}]=${request[j]} > Available[R${j}]=${deadAvail[j]} — Không đủ tài nguyên, P${pid} phải chờ</span>`;
      return;
    }
  }
  // Step 3: pretend allocate → check safety
  const tryAlloc = deadAlloc.map(r => [...r]);
  const tryAvail = [...deadAvail];
  for (let j = 0; j < deadM; j++) { tryAvail[j] -= request[j]; tryAlloc[pid][j] += request[j]; }

  const { safe, seq } = bankerSafety(tryAlloc, deadMax, tryAvail, deadN, deadM);
  if (safe) {
    result.innerHTML = `
      <span class="safe-badge safe">✅ Request được chấp nhận — Hệ thống vẫn an toàn</span>
      <div class="seq-display" style="margin-top:.75rem">
        <span style="font-size:.72rem;color:var(--text-dim);margin-right:.5rem">Safe sequence sau cấp phát:</span>
        ${seq.map((s,i) => `<span class="seq-item" style="animation-delay:${i*.08}s">P${s}</span>`
          + (i<seq.length-1?'<span class="seq-arrow">→</span>':'')).join('')}
      </div>`;
  } else {
    result.innerHTML = `<span class="safe-badge unsafe">
      ❌ Request bị từ chối — Cấp phát sẽ dẫn đến Unsafe State</span>`;
  }
}

/* ════════════════════════════════════════════════════════════════════
   RESOURCE ALLOCATION GRAPH (Canvas)
   ════════════════════════════════════════════════════════════════════ */
function drawRAG(safe, seq, need) {
  const canvas    = document.getElementById('dead-canvas');
  const ctx       = canvas.getContext('2d');
  const container = canvas.parentElement;
  const style     = getComputedStyle(container);
  const padH      = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  canvas.width    = Math.max((container.clientWidth - padH) || 0, 300);
  canvas.height   = Math.max(Math.round(canvas.width * 0.38), 220);
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e1117'; ctx.fillRect(0, 0, W, H);

  // Layout
  const procR = 24, resHW = 22, resHH = 17;
  const procY = 105, resY = 240;
  const procPos = Array.from({length:deadN}, (_, i) => ({ x: W/(deadN+1)*(i+1), y: procY }));
  const resPos  = Array.from({length:deadM}, (_, j) => ({ x: W/(deadM+1)*(j+1), y: resY }));

  // ── Edges ──
  // Allocation: resource → process (green)
  for (let i = 0; i < deadN; i++) for (let j = 0; j < deadM; j++) {
    if (deadAlloc[i][j] > 0) {
      const [x1,y1] = edgePoint(resPos[j].x, resPos[j].y, procPos[i].x, procPos[i].y, resHW+2, resHH+2, 'rect');
      const [x2,y2] = edgePoint(procPos[i].x, procPos[i].y, resPos[j].x, resPos[j].y, procR, procR, 'circle');
      drawArrow(ctx, x1, y1, x2, y2, '#00ff9455', Math.min(deadAlloc[i][j]*1.2, 3));
    }
  }
  // Request/need: process → resource (red)
  for (let i = 0; i < deadN; i++) for (let j = 0; j < deadM; j++) {
    if (need[i][j] > 0) {
      const [x1,y1] = edgePoint(procPos[i].x, procPos[i].y, resPos[j].x, resPos[j].y, procR, procR, 'circle');
      const [x2,y2] = edgePoint(resPos[j].x, resPos[j].y, procPos[i].x, procPos[i].y, resHW+2, resHH+2, 'rect');
      drawArrow(ctx, x1, y1, x2, y2, '#ff4d6d55', Math.min(need[i][j]*1.2, 3));
    }
  }

  // ── Process nodes (circles) ──
  procPos.forEach((p, i) => {
    const inSeq = seq.includes(i);
    // glow
    if (inSeq) {
      ctx.beginPath(); ctx.arc(p.x, p.y, procR+8, 0, Math.PI*2);
      ctx.fillStyle = '#00ff9408'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, procR, 0, Math.PI*2);
    ctx.fillStyle = inSeq ? '#00ff9412' : '#ff4d6d0c'; ctx.fill();
    ctx.strokeStyle = P_COLORS[i%P_COLORS.length]; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = P_COLORS[i%P_COLORS.length];
    ctx.font = 'bold 13px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P' + i, p.x, p.y);
    // seq badge
    if (inSeq) {
      ctx.font = '10px JetBrains Mono'; ctx.fillStyle = '#00ff9466';
      ctx.fillText('#' + (seq.indexOf(i)+1), p.x, p.y + procR + 14);
    }
    // label below
    ctx.font = '9px JetBrains Mono'; ctx.fillStyle = '#374151';
    ctx.fillText(`Al:[${deadAlloc[i].join(',')}]`, p.x, p.y + procR + 26);
  });

  // ── Resource nodes (rounded rectangles) ──
  resPos.forEach((r, j) => {
    roundRectFill(ctx, r.x-resHW, r.y-resHH, resHW*2, resHH*2, 6, '#7c3aed18', '#7c3aed');
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 12px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('R' + j, r.x, r.y);
    ctx.font = '10px JetBrains Mono'; ctx.fillStyle = '#6b7280';
    ctx.fillText('avail:' + deadAvail[j], r.x, r.y + resHH + 14);
    ctx.fillStyle = '#374151';
    ctx.fillText('total:' + (deadAvail[j] + deadAlloc.reduce((s,row)=>s+row[j],0)), r.x, r.y + resHH + 26);
  });

  // ── Legend ──
  const lx = 16, ly = H - 52;
  ctx.font = '10px JetBrains Mono'; ctx.textBaseline = 'middle';
  drawArrow(ctx, lx, ly,    lx+32, ly,    '#00ff9488', 2);
  ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'; ctx.fillText('Allocation  (R → P)', lx+38, ly);
  drawArrow(ctx, lx, ly+18, lx+32, ly+18, '#ff4d6d88', 2);
  ctx.fillStyle = '#6b7280'; ctx.fillText('Need/Request (P → R)', lx+38, ly+18);

  ctx.fillStyle = '#00ff9440'; ctx.fillRect(lx, ly+36, 12, 12);
  ctx.fillStyle = '#6b7280'; ctx.fillText('Đã chạy trong safe sequence', lx+18, ly+42);

  // ── Title ──
  ctx.font = 'bold 11px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = safe ? '#00ff94' : '#ff4d6d';
  ctx.fillText(safe ? `Resource Allocation Graph  ✅  SAFE STATE` : `Resource Allocation Graph  ❌  UNSAFE STATE`, W/2, H - 6);
}

/* ─── Canvas helpers ───────────────────────────────────────────────── */
function edgePoint(fromX, fromY, toX, toY, hw, hh, shape) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx/len, ny = dy/len;
  if (shape === 'circle') return [fromX + nx*hw, fromY + ny*hh];
  // rect: clamp to box edge
  const tx = hw / Math.max(Math.abs(nx), 1e-9);
  const ty = hh / Math.max(Math.abs(ny), 1e-9);
  const t  = Math.min(tx, ty);
  return [fromX + nx*t, fromY + ny*t];
}

function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
  const angle = Math.atan2(y2-y1, x2-x1);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 9*Math.cos(angle-.4), y2 - 9*Math.sin(angle-.4));
  ctx.lineTo(x2 - 9*Math.cos(angle+.4), y2 - 9*Math.sin(angle+.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function roundRectFill(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
}

/* ─── Init ─────────────────────────────────────────────────────────── */
deadLoadSample(1);