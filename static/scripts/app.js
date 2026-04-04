// ═══════════════════════════════════════════════════════════════════════════
// CONFIG & DOM
// ═══════════════════════════════════════════════════════════════════════════

const circleEl = document.getElementById("circle");
const arrowSvg = document.getElementById("arrowSvg");
const countValEl = document.getElementById("countVal");
const applyBtn = document.getElementById("applyBtn");

const MIN_COUNT = 4;
const MAX_COUNT = 25;
const AVATAR_SIZE = 50;
const MIN_RADIUS = 80;
const PAD = 12;

let total = 20;
let activeColor = '#D4C5F9';

// Custom canvas arrow drawing method
(function () {
    const proto = CanvasRenderingContext2D.prototype;
    if (proto.arrow) return;

    proto.arrow = function (startX, startY, endX, endY, controlPoints) {
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const sin = dy / len;
        const cos = dx / len;

        const a = [0, 0];
        for (let i = 0; i < controlPoints.length; i += 2) {
            const x = controlPoints[i] * cos - controlPoints[i + 1] * sin + startX;
            const y = controlPoints[i] * sin + controlPoints[i + 1] * cos + startY;
            a.push(x, y);
        }
        a.push(
            endX + (controlPoints[controlPoints.length - 2]) * cos - controlPoints[controlPoints.length - 1] * sin,
            endY + (controlPoints[controlPoints.length - 2]) * sin + controlPoints[controlPoints.length - 1] * cos
        );

        this.moveTo(a[0] + startX, a[1] + startY);
        for (let i = 2; i < a.length; i += 2) {
            this.lineTo(a[i], a[i + 1]);
        }
        this.lineTo(
            endX + controlPoints[controlPoints.length - 2] * cos - controlPoints[controlPoints.length - 1] * sin,
            endY + controlPoints[controlPoints.length - 2] * sin + controlPoints[controlPoints.length - 1] * cos
        );
    };
})();

// Canvas setup for drawing arrows
let arrowCanvas = null;
let arrowCtx = null;

// Initialize canvas overlay for arrows
function initCanvas() {
    const old = document.getElementById("arrowCanvas");
    if (old) old.remove();

    const leftEl = circleEl.parentElement;
    arrowCanvas = document.createElement("canvas");
    arrowCanvas.id = "arrowCanvas";
    arrowCanvas.width = leftEl.offsetWidth;
    arrowCanvas.height = leftEl.offsetHeight;
    arrowCanvas.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
    leftEl.appendChild(arrowCanvas);
    arrowCtx = arrowCanvas.getContext("2d");
}

// Active arrow list and animation frame management
let activeArrows = [];
let rafId = null;

// Draw single arrow frame with progress animation
function drawArrowFrame(ctx, x1, y1, x2, y2, color, alpha, progress) {
    // progress 0→1: tip travels from start to end
    const tx = x1 + (x2 - x1) * progress;
    const ty = y1 + (y2 - y1) * progress;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Arrow shaft half-width and head size
    const hw = 2;   // shaft half-width
    const hLen = 10;  // arrowhead length
    const hW = 6;   // arrowhead half-width

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Unit vectors
    const ux = dx / len, uy = dy / len;
    const px = -uy, py = ux;

    // Only draw shaft if progress > tiny threshold
    if (progress > 0.05) {
        // Shaft: rectangle from (x1,y1) to (tx,ty)
        ctx.beginPath();
        ctx.moveTo(x1 + px * hw, y1 + py * hw);
        ctx.lineTo(tx + px * hw, ty + py * hw);
        ctx.lineTo(tx - px * hw, ty - py * hw);
        ctx.lineTo(x1 - px * hw, y1 - py * hw);
        ctx.closePath();
        ctx.fill();
    }

    // Draw arrowhead only when near or at end
    if (progress > 0.85) {
        const headAlpha = Math.min(1, (progress - 0.85) / 0.15);
        ctx.globalAlpha = alpha * headAlpha;

        // Head base is hLen before tip
        const bx = tx - ux * hLen;
        const by = ty - uy * hLen;

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bx + px * hW, by + py * hW);
        ctx.lineTo(bx - px * hW, by - py * hW);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

// Main animation loop for arrows
function arrowLoop(now) {
    if (!arrowCtx || !arrowCanvas) return;
    arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);

    const GROW_MS = 500;   // Arrow travel time
    const STAY_MS = 3500;  // Arrow visible time
    const FADE_MS = 600;   // Arrow fade time
    const TOTAL_MS = STAY_MS + FADE_MS;

    activeArrows = activeArrows.filter(a => (now - a.born) < TOTAL_MS);

    activeArrows.forEach(a => {
        const age = now - a.born;
        const progress = Math.min(1, age / GROW_MS);
        let alpha = 0.88;
        if (age > STAY_MS) {
            alpha *= 1 - (age - STAY_MS) / FADE_MS;
        }
        const color = a.isSlow ? "#C47B2B" : "#7F5FE8";
        drawArrowFrame(arrowCtx, a.x1, a.y1, a.x2, a.y2, color, Math.max(0, alpha), progress);
    });

    if (activeArrows.length > 0) {
        rafId = requestAnimationFrame(arrowLoop);
    } else {
        rafId = null;
        arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);
    }
}

// Clear all active arrows
function clearArrows() {
    activeArrows = [];
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (arrowCtx && arrowCanvas) {
        arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD AVATAR ITEMS
// ═══════════════════════════════════════════════════════════════════════════

const items = [];

// Create DOM elements for each node avatar
for (let i = 1; i <= MAX_COUNT; i++) {
    const div = document.createElement("div");
    div.className = "item";
    div.style.width = AVATAR_SIZE + "px";
    div.style.height = AVATAR_SIZE + "px";

    const ring = document.createElement("div");
    ring.className = "state-ring";
    div.appendChild(ring);

    const badge = document.createElement("div");
    badge.className = "node-badge";
    div.appendChild(badge);

    const bubble = document.createElement("div");
    bubble.className = "node-bubble";
    bubble.innerHTML =
        `<div class="b-row"><span class="b-lbl">Node</span><span class="b-val b-id">N${i - 1}</span></div>` +
        `<div class="b-row"><span class="b-lbl">Msg</span><span class="b-val b-msg">—</span></div>` +
        `<div class="b-row"><span class="b-lbl">Ver</span><span class="b-val b-ver">—</span></div>`;
    div.appendChild(bubble);

    const img = document.createElement("img");
    img.src = (i > 16) ? `static/images/people/${i - 15}.png` : `static/images/people/${i}.png`;
    img.width = AVATAR_SIZE;
    img.height = AVATAR_SIZE;
    img.style.borderRadius = "50%";
    div.appendChild(img);

    circleEl.appendChild(div);
    items.push(div);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER — circle layout
// ═══════════════════════════════════════════════════════════════════════════

let nodeAngles = [];

// Position all nodes in a circle
function render() {
    const minBySpacing = ((AVATAR_SIZE + PAD) * total) / (2 * Math.PI);
    const orbitR = Math.max(MIN_RADIUS, minBySpacing);
    const circleSize = (orbitR + AVATAR_SIZE / 2 + PAD) * 2;
    const circleR = circleSize / 2;

    circleEl.style.width = circleSize + "px";
    circleEl.style.height = circleSize + "px";
    circleEl.style.background = activeColor;
    countValEl.textContent = total;
    nodeAngles = [];

    items.forEach((div, idx) => {
        if (idx >= total) { div.style.display = "none"; return; }
        div.style.display = "block";

        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
        const x = circleR + orbitR * Math.cos(angle) - AVATAR_SIZE / 2;
        const y = circleR + orbitR * Math.sin(angle) - AVATAR_SIZE / 2;
        const rotateDeg = (angle * 180 / Math.PI) + 90;

        div.style.left = x + "px";
        div.style.top = y + "px";
        div.style.transform = `rotate(${rotateDeg}deg)`;

        nodeAngles[idx] = angle; // raw radians — used by getCanvasPos
    });

    // Sync canvas size
    if (arrowCanvas) {
        const leftEl = circleEl.parentElement;
        arrowCanvas.width = leftEl.offsetWidth;
        arrowCanvas.height = leftEl.offsetHeight;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE STATE VISUALS
// ═══════════════════════════════════════════════════════════════════════════

// Update node visual appearance based on simulation state
function applyNodeVisual(idx, simNode) {
    const div = items[idx];
    const badge = div.querySelector(".node-badge");
    const bubble = div.querySelector(".node-bubble");

    div.classList.remove("node--informed", "node--dead", "node--slow");

    if (simNode.state === "dead") {
        div.classList.add("node--dead");
        if (badge) badge.textContent = "✕";
    } else if (simNode.state === "slow") {
        div.classList.add("node--slow");
        if (badge) badge.textContent = "~";
    } else {
        if (badge) badge.textContent = "";
        if (simNode.data.version > 0) div.classList.add("node--informed");
    }

    if (bubble) {
        const msgTxt = simNode.data.value ? simNode.data.value.substring(0, 14) : "—";
        const verTxt = simNode.data.version > 0 ? `v${simNode.data.version}` : "—";
        bubble.querySelector(".b-id").textContent = `N${simNode.id}`;
        bubble.querySelector(".b-msg").textContent = msgTxt;
        bubble.querySelector(".b-ver").textContent = verTxt;
    }
}

// Flash animation for newly informed nodes
function flashInformed(idx) {
    const div = items[idx];
    div.classList.remove("just-informed");
    void div.offsetWidth;
    div.classList.add("just-informed");
    setTimeout(() => div.classList.remove("just-informed"), 700);
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION HELPER — canvas-relative coords
// ═══════════════════════════════════════════════════════════════════════════

// Get canvas coordinates for a node by index
function getCanvasPos(idx) {
    if (nodeAngles[idx] === undefined) return null;

    const leftEl = circleEl.parentElement;
    const leftRect = leftEl.getBoundingClientRect();
    const circleRect = circleEl.getBoundingClientRect();

    const angle = nodeAngles[idx];
    const minBySpacing = ((AVATAR_SIZE + PAD) * total) / (2 * Math.PI);
    const orbitR = Math.max(MIN_RADIUS, minBySpacing);
    const circleR = orbitR + AVATAR_SIZE / 2 + PAD;

    // Circle centre in .left-div local coords (= canvas coords)
    const ccx = (circleRect.left - leftRect.left) + circleR;
    const ccy = (circleRect.top - leftRect.top) + circleR;

    return {
        x: ccx + orbitR * Math.cos(angle),
        y: ccy + orbitR * Math.sin(angle)
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAW ARROW
// ═══════════════════════════════════════════════════════════════════════════

// Create animated arrow between two nodes
function drawArrow(fromIdx, toIdx, isSlow) {
    const a = getCanvasPos(fromIdx);
    const b = getCanvasPos(toIdx);
    if (!a || !b) return;

    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const r = AVATAR_SIZE / 2 + 4; // offset from node centre

    activeArrows.push({
        x1: a.x + (dx / len) * r,
        y1: a.y + (dy / len) * r,
        x2: b.x - (dx / len) * r,
        y2: b.y - (dy / len) * r,
        isSlow,
        born: performance.now()
    });

    if (!rafId) rafId = requestAnimationFrame(arrowLoop);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUTTON HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Disable apply button during simulation
function setButtonRunning() {
    applyBtn.disabled = true;
    applyBtn.textContent = "Running…";
    applyBtn.style.opacity = "0.55";
    applyBtn.style.cursor = "not-allowed";
}

// Enable apply button after simulation
function setButtonReady(label) {
    applyBtn.disabled = false;
    applyBtn.textContent = label || "Start";
    applyBtn.style.opacity = "1";
    applyBtn.style.cursor = "pointer";
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS & LOG
// ═══════════════════════════════════════════════════════════════════════════

let totalMessages = 0;

// Update statistics display
function updateStats(nodes, round) {
    const live = nodes.filter(n => n.state !== "dead");
    document.getElementById("statInformed").textContent = live.filter(n => n.data.version > 0).length;
    document.getElementById("statPending").textContent = live.filter(n => n.data.version === 0).length;
    document.getElementById("statDead").textContent = nodes.filter(n => n.state === "dead").length;
    document.getElementById("statSlow").textContent = nodes.filter(n => n.state === "slow").length;
    document.getElementById("statMsgs").textContent = totalMessages;
    document.getElementById("statRound").textContent = round >= 0 ? round : "—";
}

// Add entry to log panel
function addLog(text, cls) {
    const log = document.getElementById("roundLog");
    log.querySelectorAll(".log-empty").forEach(e => e.remove());
    const entry = document.createElement("div");
    entry.className = "log-entry" + (cls ? " " + cls : "");
    entry.textContent = text;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// Clear log panel
function clearLog() { document.getElementById("roundLog").innerHTML = ""; }

// Clear results display
function clearResults() {
    document.getElementById("resultBox").style.display = "none";
    document.getElementById("resultBody").textContent = "";
}

// ═══════════════════════════════════════════════════════════════════════════
// TOLERANCE BANNER
// ═══════════════════════════════════════════════════════════════════════════

// Update fault tolerance banner
function updateToleranceBanner(nodes) {
    const banner = document.getElementById("toleranceBanner");
    if (!banner) return;
    const dead = nodes.filter(n => n.manualDead).length;
    const slow = nodes.filter(n => n.manualSlow).length;
    const live = nodes.filter(n => n.state !== "dead").length;
    if (dead === 0 && slow === 0) { banner.style.display = "none"; return; }
    banner.style.display = "block";
    const pct = Math.round((live / nodes.length) * 100);
    banner.innerHTML =
        `<span class="tol-icon">⚡</span> Tolerating <strong>${dead}</strong> dead` +
        (slow > 0 ? ` + <strong>${slow}</strong> slow` : "") +
        ` — <strong>${pct}%</strong> of cluster reachable`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOSSIP SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

let simNodes = [];
let simRound = 0;
let simInterval = null;
let delayedQueue = [];

// Get scenario configuration values
function getScenario() { return parseInt(document.getElementById("scenario").value); }
function getFanout() { return Math.max(1, parseInt(document.getElementById("fanout").value) || 2); }
function getDeadInit() { return Math.max(0, parseInt(document.getElementById("deadCount").value) || 0); }
function getSlowInit() { return Math.max(0, parseInt(document.getElementById("slowCount").value) || 0); }
function getMsgInput() { return document.getElementById("msgInput").value.trim() || "some gossip"; }

// Select random peers for gossip, respecting slow node behavior
function selectPeers(src, fanout) {
    let c = simNodes.filter(n => n.id !== src.id && n.state !== "dead");
    c = c.filter(n => n.state !== "slow" || Math.random() < 0.5);
    c.sort(() => Math.random() - 0.5);
    return c.slice(0, fanout);
}

// Update node states based on last seen round
function updateNodeStates() {
    simNodes.forEach(n => {
        if (n.manualDead || n.lastSeenRound === null) return;
        const gap = simRound - n.lastSeenRound;
        if (gap > 3) n.state = "dead";
        else if (gap > 1) n.state = "slow";
        else n.state = "live";
    });
}

// Initialize simulation with current configuration
function initSim() {
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
    clearLog();
    clearResults();
    clearArrows();
    totalMessages = 0;
    delayedQueue = [];

    const sc = getScenario();
    let dead = sc >= 2 ? Math.min(getDeadInit(), total - 1) : 0;
    let slow = sc >= 3 ? Math.min(getSlowInit(), total - dead - 1) : 0;

    const types = Array(total).fill("live");
    const assigned = [];
    function pickUnique() {
        let idx;
        do { idx = Math.floor(Math.random() * total); } while (assigned.includes(idx));
        assigned.push(idx); return idx;
    }
    for (let i = 0; i < dead; i++) types[pickUnique()] = "dead";
    for (let i = 0; i < slow; i++) types[pickUnique()] = "slow";

    let src = 0;
    while (types[src] !== "live") src++;

    const msgValue = getMsgInput();
    simNodes = Array.from({ length: total }, (_, i) => ({
        id: i,
        state: types[i],
        manualDead: types[i] === "dead",
        manualSlow: types[i] === "slow",
        data: { value: i === src ? msgValue : "", version: i === src ? 1 : 0 },
        lastSeenRound: i === src ? 0 : null
    }));

    simRound = 0;
    simNodes.forEach((n, i) => applyNodeVisual(i, n));
    updateStats(simNodes, simRound);
    updateToleranceBanner(simNodes);

    const fanout = getFanout();
    addLog(`▶ source: N${src}  msg: "${msgValue}"  fanout: ${fanout}`, "log--start");
    if (dead > 0 || slow > 0)
        addLog(`  dead: ${dead} node(s)  slow: ${slow} node(s)`, "log--info");

    setButtonRunning();
    simInterval = setInterval(stepSim, 5000);
}

// Execute one round of gossip simulation
function stepSim() {
    simRound++;
    addLog(`── Round ${simRound} ──────────────────`, "log--skip");

    const fanout = getFanout();

    // Process delayed messages (for slow nodes)
    const toProcess = delayedQueue.filter(m => m.processRound === simRound);
    delayedQueue = delayedQueue.filter(m => m.processRound !== simRound);
    toProcess.forEach(msg => {
        const target = simNodes[msg.targetId];
        if (!target || target.state === "dead") return;
        if (msg.data.version > target.data.version) {
            target.data = { ...msg.data };
            target.lastSeenRound = simRound;
            applyNodeVisual(msg.targetId, target);
            flashInformed(msg.targetId);
            addLog(`  ⟳ N${msg.targetId} applied delayed  ver:${msg.data.version}`, "log--new");
        }
    });

    // Gossip propagation from informed nodes
    simNodes.filter(n => n.state !== "dead" && n.data.version > 0).forEach(src => {
        if (src.state === "slow") {
            if (src._skipNext) { src._skipNext = false; addLog(`  ↷ N${src.id} (slow) skipped`, "log--skip"); return; }
            src._skipNext = true;
        }
        src.lastSeenRound = simRound;
        const peers = selectPeers(src, fanout);
        if (!peers.length) return;

        peers.forEach(target => {
            if (src.data.version <= target.data.version) {
                addLog(`  · N${src.id} → N${target.id}  skip (v${target.data.version})`, "log--skip");
                return;
            }
            totalMessages++;
            if (target.state === "slow") {
                delayedQueue.push({ targetId: target.id, data: { ...src.data }, processRound: simRound + 1 });
                drawArrow(src.id, target.id, true);
                addLog(`  ⟶ N${src.id} → N${target.id}(slow)  delayed→R${simRound + 1}`, "log--slow");
            } else {
                target.data = { ...src.data };
                target.lastSeenRound = simRound;
                applyNodeVisual(target.id, target);
                flashInformed(target.id);
                drawArrow(src.id, target.id, false);
                addLog(`  ✓ N${src.id} → N${target.id}  ver:${src.data.version}`, "log--new");
            }
        });
    });

    // Update node states based on communication gaps
    updateNodeStates();
    simNodes.forEach((n, i) => applyNodeVisual(i, n));
    updateStats(simNodes, simRound);
    updateToleranceBanner(simNodes);

    simNodes.forEach(n => {
        if (n.lastSeenRound === null || n.manualDead) return;
        const gap = simRound - n.lastSeenRound;
        if (gap > 3 && n.state === "dead") addLog(`  ✗ N${n.id} → DEAD  (${gap}r silent)`, "log--dead");
        else if (gap > 1 && n.state === "slow") addLog(`  ~ N${n.id} → SLOW  (${gap}r silent)`, "log--warn");
    });

    // Check for convergence
    const live = simNodes.filter(n => n.state !== "dead");
    const versions = [...new Set(live.map(n => n.data.version))];
    const converged = live.every(n => n.data.version > 0) && versions.length === 1 && versions[0] > 0;

    if (converged || simRound >= 40) {
        clearInterval(simInterval); simInterval = null;
        const missed = live.filter(n => n.data.version === 0).length;
        addLog(converged
            ? `✓ Converged at round ${simRound}`
            : `⚠ Stopped at round ${simRound} — ${missed} not reached`, "log--done");

        document.getElementById("resultBox").style.display = "block";
        const d = simNodes.filter(n => n.state === "dead").length;
        const s = simNodes.filter(n => n.state === "slow").length;
        document.getElementById("resultBody").textContent =
            `Status         : ${converged ? "Converged ✓" : "Partial ⚠"}\n` +
            `Rounds         : ${simRound}\n` +
            `Messages sent  : ${totalMessages}\n` +
            `Live informed  : ${live.filter(n => n.data.version > 0).length} / ${live.length}\n` +
            (missed > 0 ? `Missed (alive) : ${missed}\n` : "") +
            `Dead nodes     : ${d}   (tolerated: ${d > 0 ? "yes ✓" : "n/a"})\n` +
            `Slow nodes     : ${s}   (tolerated: ${s > 0 ? "yes ✓" : "n/a"})\n` +
            `Fanout         : ${getFanout()}`;

        setButtonReady("Restart");
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO FIELD VISIBILITY
// ═══════════════════════════════════════════════════════════════════════════

// Show/hide fault injection fields based on scenario
function updateFieldVisibility() {
    const sc = getScenario();
    document.getElementById("fieldDead").classList.toggle("field--disabled", sc < 2);
    document.getElementById("fieldSlow").classList.toggle("field--disabled", sc < 3);
}

document.getElementById("scenario").addEventListener("change", () => {
    updateFieldVisibility();
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
    clearLog();
    clearResults();
    clearArrows();
    document.getElementById("roundLog").innerHTML = '<div class="log-empty">Press Apply to start</div>';
    // Reset stats
    totalMessages = 0;
    document.getElementById("statInformed").textContent = "0";
    document.getElementById("statPending").textContent = "—";
    document.getElementById("statDead").textContent = "0";
    document.getElementById("statSlow").textContent = "0";
    document.getElementById("statMsgs").textContent = "0";
    document.getElementById("statRound").textContent = "—";
    // Hide tolerance banner
    const banner = document.getElementById("toleranceBanner");
    if (banner) banner.style.display = "none";
    setButtonReady("Start");
});
updateFieldVisibility();

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

document.getElementById("plus").addEventListener("click", () => {
    if (total < MAX_COUNT) { total++; render(); }
});
document.getElementById("minus").addEventListener("click", () => {
    if (total > MIN_COUNT) { total--; render(); }
});
document.getElementById("applyBtn").addEventListener("click", () => {
    if (applyBtn.disabled) return;
    render();
    setTimeout(initSim, 60);
});

window.addEventListener("resize", () => {
    if (!arrowCanvas) return;
    const leftEl = circleEl.parentElement;
    arrowCanvas.width = leftEl.offsetWidth;
    arrowCanvas.height = leftEl.offsetHeight;
});

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════

initCanvas();
render();