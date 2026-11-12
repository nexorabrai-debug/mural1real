(function () {
  "use strict";

  const CFG = window.MURAL_CONFIG;
  const SIZE = CFG.GRID_SIZE;
  const PRICE = CFG.BLOCK_PRICE_BRL;
  const THRONE = CFG.THRONE;
  const CELL = 10;
  const WORLD = SIZE * CELL;
  const PALETTE = [
    "#E24B4B", "#EA580C", "#CA8A04", "#16A34A", "#0F766E",
    "#2F6FED", "#7C3AED", "#DB2777", "#F4EDE1", "#111111"
  ];

  const state = {
    sold: [],
    soldMap: new Map(),
    selected: new Map(),
    color: PALETTE[0],
    scale: 1,
    ox: 0,
    oy: 0,
    minScale: 0.2,
    maxScale: 12,
    fitted: false,
    panMode: false,
    panning: false,
    selecting: false,
    lastPointer: null,
    pointers: new Map(),
    pinch: null,
    hover: null,
    orderCode: "",
  };

  const els = {
    canvas: document.getElementById("mural"),
    wrap: document.getElementById("grid-wrap"),
    tooltip: document.getElementById("tooltip"),
    sold: document.getElementById("stat-sold"),
    raised: document.getElementById("stat-raised"),
    left: document.getElementById("stat-left"),
    buyTotal: document.getElementById("buy-total"),
    buySub: document.getElementById("buy-sub"),
    btnBuy: document.getElementById("btn-buy"),
    btnClear: document.getElementById("btn-clear"),
    btnPan: document.getElementById("btn-pan"),
    rank: document.getElementById("rank-list"),
    overlay: document.getElementById("overlay"),
    sheetTotal: document.getElementById("sheet-total"),
    stepForm: document.getElementById("step-form"),
    stepPay: document.getElementById("step-pay"),
    form: document.getElementById("buy-form"),
    pixKey: document.getElementById("pix-key"),
    kiwify: document.getElementById("kiwify-url"),
    kiwifyBtn: document.getElementById("btn-kiwify"),
    payAmount: document.getElementById("pay-amount"),
    orderCode: document.getElementById("order-code"),
    status: document.getElementById("send-status"),
    toast: document.getElementById("toast"),
    palette: document.getElementById("palette"),
    hint: document.getElementById("grid-hint"),
    ticker: document.getElementById("ticker-track"),
    buyInner: document.querySelector(".buybar-inner"),
  };

  const ctx = els.canvas.getContext("2d");
  let staticLayer = document.createElement("canvas");
  let staticCtx = staticLayer.getContext("2d");
  let toastTimer = 0;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.pulse = 0.6;

  function key(x, y) { return x + "," + y; }

  function isThrone(x, y) {
    return x >= THRONE.x && x < THRONE.x + THRONE.w &&
           y >= THRONE.y && y < THRONE.y + THRONE.h;
  }

  function inGrid(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  function isFree(x, y) {
    return inGrid(x, y) && !isThrone(x, y) && !state.soldMap.has(key(x, y));
  }

  function formatBRL(n) {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatInt(n) {
    return n.toLocaleString("pt-BR");
  }

  function hexToRgba(hex, a) {
    const h = String(hex || "#888").replace("#", "");
    const n = h.length === 3
      ? h.split("").map(function (c) { return c + c; }).join("")
      : h;
    const r = parseInt(n.slice(0, 2), 16) || 0;
    const g = parseInt(n.slice(2, 4), 16) || 0;
    const b = parseInt(n.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function bumpPulse(el) {
    if (!el || reduceMotion) return;
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }

  function animateNumber(el, to, money, pulseEach) {
    const target = Math.max(0, to | 0);
    if (reduceMotion || target === 0) {
      el.textContent = money ? formatBRL(target) : formatInt(target);
      return;
    }
    /* pulsa a cada R$ (ou a cada bloco). Se o número for grande, agrupa pra terminar em ~1.8s. */
    const duration = Math.min(1800, 70 * target);
    const steps = Math.min(target, Math.max(12, Math.round(duration / 45)));
    const chunk = Math.max(1, Math.round(target / steps));
    let current = 0;
    function tick() {
      current = Math.min(target, current + chunk);
      el.textContent = money ? formatBRL(current) : formatInt(current);
      if (pulseEach) bumpPulse(el);
      if (current < target) setTimeout(tick, 45);
    }
    tick();
  }

  function throneCount() {
    return THRONE.w * THRONE.h;
  }

  function soldCount() {
    return state.soldMap.size;
  }

  function remainingCount() {
    return SIZE * SIZE - throneCount() - soldCount();
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-on");
    }, 2400);
  }

  function updateStats(animate) {
    const sold = soldCount();
    const left = remainingCount();
    if (animate) {
      animateNumber(els.sold, sold, false, true);
      animateNumber(els.raised, sold * PRICE, true, true);
      els.left.textContent = formatInt(left);
    } else {
      els.sold.textContent = formatInt(sold);
      els.raised.textContent = formatBRL(sold * PRICE);
      els.left.textContent = formatInt(left);
    }
  }

  function updateBuyBar() {
    const n = state.selected.size;
    const total = n * PRICE;
    if (n === 0) {
      els.buyTotal.textContent = "0 pixels · R$ 0";
      els.buySub.textContent = "Toque nos blocos livres";
      els.btnBuy.disabled = true;
      els.btnClear.disabled = true;
    } else {
      els.buyTotal.textContent = n + (n === 1 ? " pixel · " : " pixels · ") + formatBRL(total);
      els.buySub.textContent = "Cada bloco custa " + formatBRL(PRICE);
      els.btnBuy.disabled = false;
      els.btnClear.disabled = false;
    }
    if (els.buyInner && !reduceMotion && !state.selecting) {
      els.buyInner.classList.remove("is-pop");
      void els.buyInner.offsetWidth;
      els.buyInner.classList.add("is-pop");
    }
  }

  function renderRanking() {
    const byName = new Map();
    state.sold.forEach(function (entry) {
      const k = entry.name;
      const prev = byName.get(k) || { name: entry.name, count: 0, example: !!entry.example, color: entry.color };
      prev.count += (entry.blocks || []).length;
      prev.example = prev.example || !!entry.example;
      byName.set(k, prev);
    });
    const rows = Array.from(byName.values()).sort(function (a, b) {
      return b.count - a.count;
    });
    els.rank.innerHTML = "";
    if (!rows.length) {
      els.rank.innerHTML = "<li class='rank-item'><span class='pos'>—</span><div class='who'><b>Ninguém ainda</b><small>O primeiro lugar está aberto</small></div><span class='spent'>R$ 0</span></li>";
      return;
    }
    rows.forEach(function (row, i) {
      const li = document.createElement("li");
      li.className = "rank-item";
      const badge = row.example ? " <span class='badge-ex'>exemplo</span>" : "";
      li.innerHTML =
        "<span class='pos'>" + (i + 1) + "</span>" +
        "<div class='who'><b>" + escapeHtml(row.name) + badge + "</b>" +
        "<small>" + row.count + (row.count === 1 ? " pixel" : " pixels") + "</small></div>" +
        "<span class='spent'>" + formatBRL(row.count * PRICE) + "</span>";
      els.rank.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTicker() {
    if (!els.ticker) return;
    const items = state.sold.filter(function (e) { return e.phrase && e.name; });
    if (!items.length) {
      els.ticker.innerHTML = "<span class='ticker-item'><span class='q'>O mural acabou de abrir.</span><span class='sep'>·</span><span class='who'>seu nome pode ser o primeiro</span></span>";
      return;
    }
    function piece(e) {
      return "<span class='ticker-item'><span class='q'>“" + escapeHtml(e.phrase) + "”</span><span class='sep'>·</span><span class='who'>" + escapeHtml(e.name) + "</span></span>";
    }
    const row = items.map(piece).join("");
    /* duplica pra o loop do CSS ficar contínuo */
    els.ticker.innerHTML = row + row;
  }

  function rebuildSoldMap() {
    state.soldMap = new Map();
    state.sold.forEach(function (entry) {
      (entry.blocks || []).forEach(function (pair) {
        const x = pair[0], y = pair[1];
        if (inGrid(x, y)) state.soldMap.set(key(x, y), entry);
      });
    });
  }

  function paintStatic() {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    /* world-space canvas at 1:1 cell pixels * a sharp factor */
    const res = WORLD * 2;
    staticLayer.width = res;
    staticLayer.height = res;
    const g = staticCtx;
    g.setTransform(res / WORLD, 0, 0, res / WORLD, 0, 0);
    g.clearRect(0, 0, WORLD, WORLD);
    g.fillStyle = "#1a1611";
    g.fillRect(0, 0, WORLD, WORLD);
    /* faint checker so the empty mural reads even no zoom */
    g.fillStyle = "#211c16";
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (((x + y) & 1) === 0) g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    /* static gold bloom under the throne, visible even without o rAF */
    {
      const cx = (THRONE.x + THRONE.w / 2) * CELL;
      const cy = (THRONE.y + THRONE.h / 2) * CELL;
      const rad = THRONE.w * CELL * 2.1;
      const aura = g.createRadialGradient(cx, cy, THRONE.w * CELL * 0.2, cx, cy, rad);
      aura.addColorStop(0, "rgba(255, 230, 140, 0.55)");
      aura.addColorStop(0.35, "rgba(232, 195, 106, 0.28)");
      aura.addColorStop(1, "rgba(232, 195, 106, 0)");
      g.fillStyle = aura;
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fill();
    }

    /* throne cluster — bright gold core (aura is drawn live) */
    const tx = THRONE.x * CELL, ty = THRONE.y * CELL;
    const tw = THRONE.w * CELL, th = THRONE.h * CELL;
    for (let gy = 0; gy < THRONE.h; gy++) {
      for (let gx = 0; gx < THRONE.w; gx++) {
        const on = (gx + gy) % 2 === 0;
        g.fillStyle = on ? "#f3d078" : "#c89622";
        g.fillRect((THRONE.x + gx) * CELL, (THRONE.y + gy) * CELL, CELL, CELL);
      }
    }
    g.save();
    g.beginPath();
    g.rect(tx, ty, tw, th);
    g.clip();
    g.strokeStyle = "rgba(255, 245, 180, 0.35)";
    g.lineWidth = 0.7;
    for (let i = -th; i < tw + th; i += 5) {
      g.beginPath();
      g.moveTo(tx + i, ty);
      g.lineTo(tx + i + th, ty + th);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = "rgba(255, 236, 160, 0.95)";
    g.lineWidth = 1.6;
    g.strokeRect(tx + 0.6, ty + 0.6, tw - 1.2, th - 1.2);

    /* neon sold blocks: soft bloom, then solid, then a highlight */
    state.sold.forEach(function (entry) {
      const color = entry.color || "#888";
      (entry.blocks || []).forEach(function (pair) {
        const x = pair[0], y = pair[1];
        if (!inGrid(x, y) || isThrone(x, y)) return;
        g.fillStyle = hexToRgba(color, 0.38);
        g.fillRect(x * CELL - 2.2, y * CELL - 2.2, CELL + 4.4, CELL + 4.4);
      });
      (entry.blocks || []).forEach(function (pair) {
        const x = pair[0], y = pair[1];
        if (!inGrid(x, y) || isThrone(x, y)) return;
        g.fillStyle = color;
        g.fillRect(x * CELL, y * CELL, CELL, CELL);
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.fillRect(x * CELL + 1, y * CELL + 0.8, CELL - 2, 2.2);
      });
    });

    /* label later in screen space so it stays readable */
    void dpr;
  }

  function drawThroneGlow(c, inner) {
    const tx = THRONE.x * CELL, ty = THRONE.y * CELL;
    const tw = THRONE.w * CELL, th = THRONE.h * CELL;
    const cx = tx + tw / 2, cy = ty + th / 2;
    const p = state.pulse || 0.6;
    if (inner) {
      c.save();
      c.globalCompositeOperation = "lighter";
      const g2 = c.createRadialGradient(cx, cy, 2, cx, cy, tw * 0.62);
      g2.addColorStop(0, "rgba(255, 250, 210," + (0.22 * p) + ")");
      g2.addColorStop(0.55, "rgba(232, 195, 106," + (0.10 * p) + ")");
      g2.addColorStop(1, "rgba(232, 195, 106, 0)");
      c.fillStyle = g2;
      c.fillRect(tx, ty, tw, th);
      c.restore();
      return;
    }
    const radius = tw * (1.35 + 0.35 * p);
    const g = c.createRadialGradient(cx, cy, tw * 0.25, cx, cy, radius);
    g.addColorStop(0, "rgba(255, 230, 130," + (0.18 + 0.16 * p) + ")");
    g.addColorStop(0.4, "rgba(232, 195, 106," + (0.10 + 0.10 * p) + ")");
    g.addColorStop(1, "rgba(232, 195, 106, 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();
  }

  function startGlowLoop() {
    if (reduceMotion) return;
    let last = 0;
    function loop(ts) {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      if (ts - last < 50) return; /* ~20fps, leve no celular */
      last = ts;
      state.pulse = 0.5 + 0.5 * Math.sin(ts / 450);
      draw();
    }
    requestAnimationFrame(loop);
  }

  function fitCamera() {
    const rect = els.wrap.getBoundingClientRect();
    const pad = 18;
    const s = Math.min((rect.width - pad * 2) / WORLD, (rect.height - pad * 2) / WORLD);
    state.scale = Math.max(s, 0.05);
    state.minScale = state.scale * 0.85;
    state.ox = (rect.width - WORLD * state.scale) / 2;
    state.oy = (rect.height - WORLD * state.scale) / 2;
    state.fitted = true;
  }

  function focusThrone() {
    const rect = els.wrap.getBoundingClientRect();
    const pad = 10;
    const fit = Math.min((rect.width - 18 * 2) / WORLD, (rect.height - 18 * 2) / WORLD);
    state.minScale = Math.max(fit * 0.85, 0.05);
    /* mostra ~36–44 células, com o trono enorme no meio */
    const cells = Math.max(28, Math.min(44, Math.round(Math.min(rect.width, rect.height) / 14)));
    const s = Math.min((rect.width - pad) / (cells * CELL), (rect.height - pad) / (cells * CELL));
    state.scale = Math.max(state.minScale, Math.min(state.maxScale, s));
    const cx = (THRONE.x + THRONE.w / 2) * CELL;
    const cy = (THRONE.y + THRONE.h / 2) * CELL;
    state.ox = rect.width / 2 - cx * state.scale;
    state.oy = rect.height / 2 - cy * state.scale;
    clampPan();
    state.fitted = true;
  }

  function resizeCanvas() {
    const rect = els.wrap.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    els.canvas.style.width = rect.width + "px";
    els.canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.userCamera) focusThrone();
    draw();
  }

  function draw() {
    const rect = els.wrap.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(state.ox, state.oy);
    ctx.scale(state.scale, state.scale);

    /* golden throne aura (behind the cached mural so it blooms out) */
    drawThroneGlow(ctx);

    ctx.drawImage(staticLayer, 0, 0, WORLD, WORLD);

    /* extra inner glow over the throne */
    drawThroneGlow(ctx, true);

    /* grid lines when zoomed in enough */
    const cellPx = CELL * state.scale;
    if (cellPx >= 7) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(244,239,230,0.12)";
      ctx.lineWidth = 1 / state.scale;
      for (let i = 0; i <= SIZE; i++) {
        ctx.moveTo(i * CELL + 0.5 / state.scale, 0);
        ctx.lineTo(i * CELL + 0.5 / state.scale, WORLD);
        ctx.moveTo(0, i * CELL + 0.5 / state.scale);
        ctx.lineTo(WORLD, i * CELL + 0.5 / state.scale);
      }
      ctx.stroke();
    }

    /* outer frame */
    ctx.strokeStyle = "rgba(232,195,106,0.35)";
    ctx.lineWidth = 1.5 / state.scale;
    ctx.strokeRect(0, 0, WORLD, WORLD);

    /* selection */
    if (state.selected.size) {
      const glow = 0.62 + 0.18 * (state.pulse || 0);
      ctx.fillStyle = "rgba(61,255,179," + glow + ")";
      ctx.strokeStyle = "rgba(244,255,248,0.95)";
      ctx.lineWidth = 1.2 / state.scale;
      state.selected.forEach(function (_v, k) {
        const p = k.split(",");
        const x = +p[0], y = +p[1];
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        if (cellPx >= 6) ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
      });
    }

    /* hover outline */
    if (state.hover && inGrid(state.hover.x, state.hover.y)) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.4 / state.scale;
      ctx.strokeRect(state.hover.x * CELL, state.hover.y * CELL, CELL, CELL);
    }

    /* throne caption — in world, only when big enough */
    if (cellPx >= 3.5) {
      const tx = THRONE.x * CELL, ty = THRONE.y * CELL;
      const tw = THRONE.w * CELL, th = THRONE.h * CELL;
      ctx.save();
      ctx.translate(tx + tw / 2, ty + th / 2);
      const fontPx = Math.max(8, Math.min(16, th * 0.16));
      ctx.scale(1 / state.scale, 1 / state.scale);
      ctx.fillStyle = "rgba(18, 12, 4, 0.88)";
      ctx.font = "700 11px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const title = "PIXEL DE OURO";
      const sub = "em breve: leilão";
      /* draw in a scale that stays readable */
      const s = Math.max(0.9, Math.min(2.2, (th * state.scale) / 70));
      ctx.scale(s, s);
      ctx.fillStyle = "#1a1204";
      ctx.font = "700 13px Outfit, sans-serif";
      ctx.fillText(title, 0, -8);
      ctx.font = "italic 12px 'Instrument Serif', Georgia, serif";
      ctx.fillStyle = "#1a1204";
      ctx.fillText(sub, 0, 8);
      void fontPx;
      ctx.restore();
    }

    ctx.restore();
  }

  function screenToWorld(clientX, clientY) {
    const rect = els.wrap.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.ox) / state.scale,
      y: (clientY - rect.top - state.oy) / state.scale,
    };
  }

  function worldToCell(w) {
    return { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) };
  }

  function zoomAt(cx, cy, factor) {
    state.userCamera = true;
    const rect = els.wrap.getBoundingClientRect();
    const px = cx - rect.left;
    const py = cy - rect.top;
    const wx = (px - state.ox) / state.scale;
    const wy = (py - state.oy) / state.scale;
    const next = Math.min(state.maxScale, Math.max(state.minScale, state.scale * factor));
    state.scale = next;
    state.ox = px - wx * state.scale;
    state.oy = py - wy * state.scale;
    clampPan();
    draw();
  }

  function clampPan() {
    const rect = els.wrap.getBoundingClientRect();
    const w = WORLD * state.scale;
    const h = WORLD * state.scale;
    const slop = 40;
    if (w <= rect.width) {
      state.ox = (rect.width - w) / 2;
    } else {
      state.ox = Math.min(slop, Math.max(rect.width - w - slop, state.ox));
    }
    if (h <= rect.height) {
      state.oy = (rect.height - h) / 2;
    } else {
      state.oy = Math.min(slop, Math.max(rect.height - h - slop, state.oy));
    }
  }

  function toggleCell(x, y, forceOn) {
    if (!isFree(x, y)) {
      if (isThrone(x, y)) toast("Esse é o Trono. Em breve: leilão.");
      else if (state.soldMap.has(key(x, y))) toast("Esse pixel já foi comprado.");
      return false;
    }
    const k = key(x, y);
    if (forceOn === true) state.selected.set(k, true);
    else if (forceOn === false) state.selected.delete(k);
    else if (state.selected.has(k)) state.selected.delete(k);
    else state.selected.set(k, true);
    return true;
  }

  function showTooltip(entry, clientX, clientY) {
    if (!entry) {
      els.tooltip.hidden = true;
      els.tooltip.classList.remove("is-on");
      return;
    }
    const rect = els.wrap.getBoundingClientRect();
    const left = clientX - rect.left;
    const top = clientY - rect.top;
    let html = "<div class='who'>" + escapeHtml(entry.name) + "</div>";
    if (entry.phrase) html += "<div class='phrase'>" + escapeHtml(entry.phrase) + "</div>";
    if (entry.link) html += "<div class='linkish'>tem um link</div>";
    if (entry.example) html += "<div class='ex-tag'>exemplo · apagar antes de publicar</div>";
    els.tooltip.innerHTML = html;
    els.tooltip.hidden = false;
    els.tooltip.classList.add("is-on");
    els.tooltip.style.left = left + "px";
    els.tooltip.style.top = Math.max(28, top - 8) + "px";
  }

  /* Pointer / gesture handling */
  function onPointerDown(e) {
    els.wrap.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.lastPointer = { x: e.clientX, y: e.clientY };

    if (state.pointers.size === 2) {
      state.selecting = false;
      state.panning = false;
      const pts = Array.from(state.pointers.values());
      state.pinch = {
        dist: hypot(pts[0], pts[1]),
        scale: state.scale,
        mid: midpoint(pts[0], pts[1]),
        ox: state.ox,
        oy: state.oy,
      };
      hideHover();
      return;
    }

    if (state.panMode || e.button === 1 || e.shiftKey || e.altKey) {
      state.panning = true;
      els.wrap.classList.add("is-dragging");
      hideHover();
      return;
    }

    const cell = worldToCell(screenToWorld(e.clientX, e.clientY));
    if (!inGrid(cell.x, cell.y)) return;
    state.selecting = true;
    state.selectAdd = !state.selected.has(key(cell.x, cell.y));
    /* if it's sold/throne, still start paint only if free */
    if (isFree(cell.x, cell.y)) {
      toggleCell(cell.x, cell.y, state.selectAdd);
      updateBuyBar();
      draw();
    } else {
      toggleCell(cell.x, cell.y);
      const entry = state.soldMap.get(key(cell.x, cell.y));
      if (entry) showTooltip(entry, e.clientX, e.clientY);
    }
  }

  function onPointerMove(e) {
    if (state.pointers.has(e.pointerId)) {
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (state.pointers.size === 2 && state.pinch) {
      const pts = Array.from(state.pointers.values());
      const d = hypot(pts[0], pts[1]);
      const mid = midpoint(pts[0], pts[1]);
      const factor = d / (state.pinch.dist || d);
      state.scale = state.pinch.scale;
      state.ox = state.pinch.ox;
      state.oy = state.pinch.oy;
      zoomAt(state.pinch.mid.x, state.pinch.mid.y, factor);
      state.ox += mid.x - state.pinch.mid.x;
      state.oy += mid.y - state.pinch.mid.y;
      clampPan();
      draw();
      return;
    }

    if (state.panning && state.lastPointer) {
      state.ox += e.clientX - state.lastPointer.x;
      state.oy += e.clientY - state.lastPointer.y;
      state.lastPointer = { x: e.clientX, y: e.clientY };
      clampPan();
      draw();
      return;
    }

    if (state.selecting) {
      const cell = worldToCell(screenToWorld(e.clientX, e.clientY));
      if (isFree(cell.x, cell.y)) {
        const k = key(cell.x, cell.y);
        const before = state.selected.has(k);
        toggleCell(cell.x, cell.y, state.selectAdd);
        if (before !== state.selected.has(k)) {
          updateBuyBar();
          draw();
        }
      }
      return;
    }

    /* hover */
    const cell = worldToCell(screenToWorld(e.clientX, e.clientY));
    if (!inGrid(cell.x, cell.y)) {
      hideHover();
      return;
    }
    if (!state.hover || state.hover.x !== cell.x || state.hover.y !== cell.y) {
      state.hover = cell;
      draw();
    }
    const entry = state.soldMap.get(key(cell.x, cell.y));
    if (entry) showTooltip(entry, e.clientX, e.clientY);
    else showTooltip(null);
  }

  function onPointerUp(e) {
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinch = null;
    if (state.pointers.size === 0) {
      state.selecting = false;
      state.panning = false;
      els.wrap.classList.remove("is-dragging");
    }
  }

  function hideHover() {
    if (state.hover) {
      state.hover = null;
      draw();
    }
    showTooltip(null);
  }

  function hypot(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.11;
    zoomAt(e.clientX, e.clientY, factor);
  }

  /* Checkout */
  function selectedBlocks() {
    return Array.from(state.selected.keys()).map(function (k) {
      const p = k.split(",");
      return [+p[0], +p[1]];
    }).sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }

  function makeOrderCode() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return "MURAL-" + y + m + day + "-" + rand;
  }

  function openSheet() {
    if (!state.selected.size) return;
    state.orderCode = makeOrderCode();
    els.orderCode.textContent = state.orderCode;
    var n = state.selected.size;
    els.sheetTotal.textContent =
      n + (n === 1 ? " bloco · total " : " blocos · total ") + formatBRL(n * PRICE);
    els.payAmount.textContent = formatBRL(state.selected.size * PRICE);
    els.pixKey.textContent = CFG.PIX_KEY;
    els.kiwify.textContent = CFG.KIWIFY_URL;
    els.kiwifyBtn.href = CFG.KIWIFY_URL;
    const placeholder = /COLE_SEU_LINK|COLE_SUA_CHAVE/.test(CFG.KIWIFY_URL);
    els.kiwifyBtn.setAttribute("aria-disabled", placeholder ? "true" : "false");
    els.stepForm.classList.remove("hidden");
    els.stepPay.classList.add("hidden");
    els.status.textContent = "";
    els.status.className = "status";
    els.overlay.hidden = false;
    requestAnimationFrame(function () { els.overlay.classList.add("is-open"); });
    document.getElementById("f-name").focus();
  }

  function closeSheet() {
    els.overlay.classList.remove("is-open");
    setTimeout(function () { els.overlay.hidden = true; }, 180);
  }

  function buildPayload() {
    const name = document.getElementById("f-name").value.trim();
    const phrase = document.getElementById("f-phrase").value.trim();
    const link = document.getElementById("f-link").value.trim();
    const email = document.getElementById("f-email").value.trim();
    const blocks = selectedBlocks();
    return {
      _subject: "Pedido Mural do 1 Real — " + state.orderCode,
      order_code: state.orderCode,
      name: name,
      phrase: phrase,
      color: state.color,
      link: link,
      email: email,
      blocks: JSON.stringify(blocks),
      block_count: String(blocks.length),
      total_brl: String(blocks.length * PRICE),
      message:
        "Pedido " + state.orderCode + "\n" +
        "Nome: " + name + "\n" +
        "Frase: " + phrase + "\n" +
        "Cor: " + state.color + "\n" +
        "Link: " + link + "\n" +
        "E-mail: " + email + "\n" +
        "Blocos: " + JSON.stringify(blocks) + "\n" +
        "Total: R$ " + (blocks.length * PRICE).toFixed(2).replace(".", ","),
    };
  }

  function validateForm() {
    const name = document.getElementById("f-name").value.trim();
    const email = document.getElementById("f-email").value.trim();
    const link = document.getElementById("f-link").value.trim();
    if (!name || name.length > CFG.MAX_NAME) {
      toast("Escreve um nome de até " + CFG.MAX_NAME + " caracteres.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("E-mail inválido.");
      return false;
    }
    if (link && !/^https?:\/\/.+/i.test(link)) {
      toast("O link precisa começar com http:// ou https://");
      return false;
    }
    if (!state.selected.size) {
      toast("Selecione pelo menos um pixel.");
      return false;
    }
    return true;
  }

  async function sendOrder(ev) {
    ev.preventDefault();
    if (!validateForm()) return;
    const payload = buildPayload();
    const text = payload.message + "\n(código " + payload.order_code + ")";
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) { /* ignore */ }

    els.status.className = "status";
    els.status.textContent = "Enviando pedido…";
    els.form.querySelector("#btn-send").disabled = true;

    try {
      const res = await fetch(CFG.FORMSUBMIT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(function () { return {}; });
      if (res.ok && (data.success === "true" || data.success === true || res.status === 200)) {
        els.status.className = "status ok";
        els.status.textContent = "Pedido enviado. Guarde o código " + state.orderCode + ". O bloco entra no mural depois da confirmação do Pix.";
        toast("Pedido enviado pra caixinha do Renato.");
      } else {
        throw new Error((data.message || "Falha no envio") + "");
      }
    } catch (err) {
      els.status.className = "status err";
      els.status.textContent = "Não deu pra enviar automaticamente. Copie o código " + state.orderCode + " e mande pra " + CFG.CONTACT_EMAIL + " com o comprovante do Pix.";
      /* also offer mailto fallback, without auto-sending */
      const mailto = "mailto:" + CFG.CONTACT_EMAIL +
        "?subject=" + encodeURIComponent("Pedido Mural do 1 Real " + state.orderCode) +
        "&body=" + encodeURIComponent(payload.message);
      els.status.innerHTML += " <a href='" + mailto + "'>Abrir e-mail</a>.";
    } finally {
      els.form.querySelector("#btn-send").disabled = false;
    }
  }

  function buildPalette() {
    els.palette.innerHTML = "";
    PALETTE.forEach(function (c) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (c === state.color ? " is-on" : "");
      b.style.background = c;
      b.setAttribute("aria-label", "Cor " + c);
      b.addEventListener("click", function () {
        state.color = c;
        Array.from(els.palette.querySelectorAll(".dot")).forEach(function (d) {
          d.classList.toggle("is-on", d.style.background === c || rgbEq(d, c));
        });
        native.value = c;
      });
      els.palette.appendChild(b);
    });
    const native = document.createElement("input");
    native.type = "color";
    native.className = "color-native";
    native.value = state.color;
    native.title = "Outra cor";
    native.addEventListener("input", function () {
      state.color = native.value;
      Array.from(els.palette.querySelectorAll(".dot")).forEach(function (d) {
        d.classList.remove("is-on");
      });
    });
    els.palette.appendChild(native);
  }

  function rgbEq(el, hex) {
    return el.getAttribute("aria-label") === "Cor " + hex;
  }

  function isFinePointer() {
    return window.matchMedia && (
      window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(hover: hover) and (min-width: 880px)").matches
    );
  }

  /* Boot */
  async function boot() {
    document.getElementById("year").textContent = String(new Date().getFullYear());
    if (isFinePointer()) {
      els.hint.textContent = "Roda o zoom · arrasta pra selecionar · Shift move o mural";
    }
    buildPalette();
    els.pixKey.textContent = CFG.PIX_KEY;
    els.kiwify.textContent = CFG.KIWIFY_URL;

    try {
      const res = await fetch(CFG.SOLD_DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("sold.json " + res.status);
      state.sold = await res.json();
    } catch (err) {
      console.warn("Não deu pra carregar sold.json", err);
      state.sold = [];
      toast("Mural vazio: não achei data/sold.json");
    }
    rebuildSoldMap();
    paintStatic();
    updateStats(true);
    renderRanking();
    renderTicker();
    updateBuyBar();
    resizeCanvas();
    startGlowLoop();

    window.addEventListener("resize", resizeCanvas);
    els.wrap.addEventListener("pointerdown", onPointerDown);
    els.wrap.addEventListener("pointermove", onPointerMove);
    els.wrap.addEventListener("pointerup", onPointerUp);
    els.wrap.addEventListener("pointercancel", onPointerUp);
    els.wrap.addEventListener("pointerleave", function () {
      if (!state.selecting && !state.panning) hideHover();
    });
    els.wrap.addEventListener("wheel", onWheel, { passive: false });
    els.wrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    document.getElementById("btn-zoom-in").addEventListener("click", function () {
      const r = els.wrap.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25);
    });
    document.getElementById("btn-zoom-out").addEventListener("click", function () {
      const r = els.wrap.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8);
    });
    document.getElementById("btn-fit").addEventListener("click", function () {
      state.userCamera = true;
      fitCamera();
      draw();
    });
    els.btnPan.addEventListener("click", function () {
      state.panMode = !state.panMode;
      els.btnPan.setAttribute("aria-pressed", state.panMode ? "true" : "false");
      els.wrap.classList.toggle("is-pan", state.panMode);
    });
    els.btnClear.addEventListener("click", function () {
      state.selected.clear();
      updateBuyBar();
      draw();
    });
    els.btnBuy.addEventListener("click", openSheet);
    document.getElementById("btn-cancel").addEventListener("click", closeSheet);
    document.getElementById("btn-to-pay").addEventListener("click", function () {
      if (!validateForm()) return;
      state.orderCode = state.orderCode || makeOrderCode();
      els.orderCode.textContent = state.orderCode;
      els.payAmount.textContent = formatBRL(state.selected.size * PRICE);
      els.stepForm.classList.add("hidden");
      els.stepPay.classList.remove("hidden");
    });
    document.getElementById("btn-back").addEventListener("click", function () {
      els.stepPay.classList.add("hidden");
      els.stepForm.classList.remove("hidden");
    });
    document.getElementById("btn-copy-pix").addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(CFG.PIX_KEY);
        toast("Chave Pix copiada (ainda é placeholder).");
      } catch (_) {
        toast("Copia a chave manualmente.");
      }
    });
    els.form.addEventListener("submit", sendOrder);
    els.overlay.addEventListener("click", function (e) {
      if (e.target === els.overlay) closeSheet();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSheet();
    });
    els.kiwifyBtn.addEventListener("click", function (e) {
      if (/COLE_SEU_LINK|COLE_SUA_CHAVE/.test(CFG.KIWIFY_URL)) {
        e.preventDefault();
        toast("O link da Kiwify ainda é placeholder. Troque em js/config.js.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
