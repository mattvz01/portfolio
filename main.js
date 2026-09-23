// Auto-update the footer year so it never goes stale (if present).
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Keep --header-h / --logos-h / --vph in sync with the real header, logo-strip
// and viewport so the hero sizes itself to leave the logo strip flush at the
// bottom of the first screen — on real devices too (iOS home indicator, the
// bottom Safari bar, etc.), which CSS vh/svh don't always get right.
const headerEl = document.querySelector(".site-header");
const logosEl = document.querySelector(".logos");
if (headerEl) {
  const root = document.documentElement.style;
  let lastW = window.innerWidth;
  const setFrameVars = () => {
    root.setProperty("--header-h", headerEl.offsetHeight + "px");
    if (logosEl) root.setProperty("--logos-h", logosEl.offsetHeight + "px");
  };
  // Lock the viewport height from the actual innerHeight. Re-lock only on true
  // width changes (rotation) — NOT on height-only resizes, which on mobile are
  // just the toolbar showing/hiding during scroll and would jump the layout.
  const setViewport = () => root.setProperty("--vph", window.innerHeight + "px");
  setFrameVars();
  setViewport();
  window.addEventListener("load", () => {
    setFrameVars();
    setViewport();
  });
  window.addEventListener("orientationchange", () => {
    setFrameVars();
    setViewport();
  });
  window.addEventListener("resize", () => {
    setFrameVars();
    if (window.innerWidth !== lastW) {
      lastW = window.innerWidth;
      setViewport();
    }
  });
}

// "Back to top" links (footer + wordmark) always return to the true top so the
// header resets to its default, expanded state. Feature-detect smooth scroll —
// older mobile Safari ignores the options form, so fall back to a plain jump.
document.querySelectorAll('a[href="#top"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    if ("scrollBehavior" in document.documentElement.style) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo(0, 0);
    }
  });
});

// Desktop: vertically centre the floating controller on the hero title (its
// middle line). Robust to wrapping/height changes; cleared on tablet/mobile
// where the controller sits inline with the tags.
const launcherAlignEl = document.getElementById("game-launcher");
const heroAlignEl = document.querySelector(".hero");
const heroTitleAlignEl = document.querySelector(".hero-title");
if (launcherAlignEl && heroAlignEl && heroTitleAlignEl) {
  const alignLauncher = () => {
    if (window.innerWidth > 1024) {
      const hr = heroAlignEl.getBoundingClientRect();
      const tr = heroTitleAlignEl.getBoundingClientRect();
      launcherAlignEl.style.top = (tr.top + tr.bottom) / 2 - hr.top + "px";
    } else {
      launcherAlignEl.style.top = "";
    }
  };
  alignLauncher();
  window.addEventListener("load", alignLauncher);
  window.addEventListener("resize", alignLauncher);
}

// Footer drawer reveal (desktop): the page ENDS at the experience section. Only
// a deliberate second gesture — trying to scroll PAST the end — opens the
// drawer. It reveals from the bottom up (clip), so the text stays pinned to the
// bottom like the front panel of a drawer being pulled open. Scrolling back up
// closes it before the page scrolls again.
(function () {
  const footer = document.querySelector(".site-footer");
  const page = document.querySelector(".page");
  if (!footer || !page) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const active = () => !reduce; // desktop (wheel) + touch; static on reduced-motion

  const FULL = 460; // wheel px for a full open
  const TOUCH_FULL = 260; // touch-drag px for a full open
  const SNAP = 0.3; // release past this → latch open, else close
  let amt = 0; // live open amount (0..1), driven by the pull
  let shown = 0; // eased display value
  let raf = null;
  let endTimer = null;

  const atBottom = () =>
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2;
  const ease = (t) => t * t * (3 - 2 * t);

  const render = () => {
    shown += (amt - shown) * 0.16;
    if (Math.abs(amt - shown) < 0.0006) shown = amt;
    const h = footer.offsetHeight || 1;
    // Lift the PAGE up to uncover the drawer beneath — content is pushed up, not
    // covered. The drawer/text stay pinned at the bottom.
    page.style.transform = "translateY(" + (-ease(shown) * h).toFixed(1) + "px)";
    raf = shown !== amt ? requestAnimationFrame(render) : null;
  };
  const kick = () => { if (raf == null) raf = requestAnimationFrame(render); };
  const setAmt = (v) => { amt = v < 0 ? 0 : v > 1 ? 1 : v; kick(); };

  const scheduleRelease = () => {
    clearTimeout(endTimer);
    endTimer = setTimeout(() => setAmt(amt > SNAP ? 1 : 0), 140);
  };

  window.addEventListener(
    "wheel",
    (e) => {
      if (!active()) return;
      const isOpen = amt > 0.001;
      if (e.deltaY > 0 && (atBottom() || isOpen)) {
        // deliberate pull past the end → open
        e.preventDefault();
        setAmt(amt + e.deltaY / FULL);
        scheduleRelease();
      } else if (e.deltaY < 0 && isOpen) {
        // pull back up → close (consumed until fully closed)
        e.preventDefault();
        setAmt(amt + e.deltaY / FULL);
        scheduleRelease();
      }
    },
    { passive: false }
  );

  // Touch equivalent for mobile/tablet: a deliberate drag up at the very end
  // opens the drawer; drag back down closes it.
  let touchLastY = null;
  let touchEngaged = false;
  window.addEventListener(
    "touchstart",
    (e) => {
      if (!active()) return;
      touchLastY = e.touches[0].clientY;
      touchEngaged = atBottom() || amt > 0.001;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (!active() || touchLastY == null) return;
      const y = e.touches[0].clientY;
      const dy = touchLastY - y; // > 0 = finger moving up = revealing
      touchLastY = y;
      const isOpen = amt > 0.001;
      if (touchEngaged && (atBottom() || isOpen) && (dy > 0 || isOpen)) {
        setAmt(amt + dy / TOUCH_FULL);
        if (e.cancelable) e.preventDefault();
      }
    },
    { passive: false }
  );
  window.addEventListener(
    "touchend",
    () => {
      if (touchLastY == null) return;
      touchLastY = null;
      if (active() && (amt > 0.001 || touchEngaged)) setAmt(amt > SNAP ? 1 : 0);
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    if (!active()) {
      amt = shown = 0;
      page.style.transform = "";
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }
  });
})();

// Footer statement line: scale the font so "Stop scrolling." fills the content
// width (up to the max-width) and responds to the viewport. Two passes settle
// the two-font line; re-run once webfonts load and on resize.
const footerBigEl = document.getElementById("footer-big");
if (footerBigEl) {
  const measureTextWidth = () => {
    // Range width = the real text bounds (block scrollWidth clamps to the
    // container when the text is narrower, which breaks the fit).
    const range = document.createRange();
    range.selectNodeContents(footerBigEl);
    return range.getBoundingClientRect().width;
  };
  const footerEl = document.querySelector(".site-footer");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fitFooterBig = () => {
    const parent = footerBigEl.parentElement;
    if (!parent || !parent.clientWidth) return;
    const target = parent.clientWidth;
    let size = 120;
    footerBigEl.style.fontSize = size + "px";
    for (let i = 0; i < 3; i++) {
      const w = measureTextWidth();
      if (!w) break;
      size = size * (target / w);
      footerBigEl.style.fontSize = size + "px";
    }
    // Footer drawer height relative to the text: shorter on desktop, taller on
    // mobile. (Reduced-motion uses the static footer, no fixed height.)
    if (footerEl) {
      if (reduceMotion) {
        footerEl.style.height = "";
      } else {
        const mult = window.innerWidth > 1024 ? 1.34 : 2;
        footerEl.style.height = Math.round(size * mult) + "px";
      }
    }
  };
  fitFooterBig();
  window.addEventListener("load", fitFooterBig);
  window.addEventListener("resize", fitFooterBig);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitFooterBig);
  }
}

// About photo: fan the emojis out from behind the portrait when the stage
// scrolls into view, and retract them when it scrolls away (either direction).
const portraitStage = document.querySelector(".portrait-stage");
if (portraitStage) {
  const stageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) =>
        portraitStage.classList.toggle("revealed", entry.isIntersecting)
      );
    },
    // Higher threshold → retract kicks in sooner as the photo starts to
    // scroll out of view (and reveals once it's mostly on screen).
    { threshold: 0.9 }
  );
  stageObserver.observe(portraitStage);
}

// Scrollspy links + helpers (defined first so the scroll handler can use them).
const spyLinks = [...document.querySelectorAll('.nav a[href^="#"]:not(.nav-cta)')];
const setActive = (id) => {
  spyLinks.forEach((a) =>
    a.classList.toggle("active", id && a.getAttribute("href").slice(1) === id)
  );
};

// Collapse the nav once scrolled past the hero; expand again the moment the
// intro text comes back into view on the way up.
// - Collapse only after the hero has fully scrolled off (gentle, deliberate).
// - Expand as soon as the hero title re-enters the lower part of the viewport
//   (snappy — the nav pops open just as you see the intro again).
const header = document.querySelector(".site-header");
const heroTitle = document.querySelector(".hero-title");
if (header && heroTitle) {
  let lastY = window.scrollY;
  const onScroll = () => {
    const titleTop = heroTitle.getBoundingClientRect().top;
    const vh = window.innerHeight;
    // Collapse once the intro title has scrolled above the viewport.
    if (titleTop < -40) header.classList.add("scrolled");
    // Expand once the intro title rises back into the lower ~85% of the screen.
    else if (titleTop < vh * 0.85) header.classList.remove("scrolled");
    // Fully back at the top (hero clearly in view) → clear any active section.
    if (titleTop > 0) setActive(null);

    // Mobile only: hide the nav when scrolling down, reveal it scrolling up.
    const y = window.scrollY;
    if (window.matchMedia("(max-width: 720px)").matches) {
      if (y > lastY && y > 80) header.classList.add("nav-hidden");
      else if (y < lastY) header.classList.remove("nav-hidden");
    } else {
      header.classList.remove("nav-hidden");
    }
    lastY = y;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Scrollspy — highlight the nav link for whichever section is in view.
if (spyLinks.length) {
  // Click: activate at once (the smooth-scroll then confirms via the observer).
  spyLinks.forEach((a) =>
    a.addEventListener("click", () => setActive(a.getAttribute("href").slice(1)))
  );

  const sections = spyLinks
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

  // Scroll: whichever section occupies the upper-middle of the viewport wins.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((section) => observer.observe(section));
}

// Seamless logo marquee.
//
// The trick to a gapless loop: the visible row of logos must be wider than
// the viewport, and we animate by the width of exactly ONE copy of that row.
// When the animation ends, copy #2 sits precisely where copy #1 began, so it
// loops with no jump and no empty space — regardless of screen width.
const track = document.getElementById("logo-track");
if (track) {
  const originals = [...track.querySelectorAll(".logo-item")];

  const setup = () => {
    // Reset to just the original logos.
    track.querySelectorAll('[data-clone="true"]').forEach((n) => n.remove());

    // Measure one full set (original logos + their margins).
    const setWidth = originals.reduce((sum, el) => {
      const cs = getComputedStyle(el);
      return (
        sum +
        el.getBoundingClientRect().width +
        parseFloat(cs.marginLeft) +
        parseFloat(cs.marginRight)
      );
    }, 0);

    // Clone the whole set enough times that the track is at least twice the
    // viewport wide — guarantees the strip always covers the screen.
    const needed = Math.max(2, Math.ceil((window.innerWidth * 2) / setWidth));
    for (let i = 1; i < needed; i++) {
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.setAttribute("data-clone", "true");
        track.appendChild(clone);
      });
    }

    // Animate by exactly one set width, at a steady speed (~35px/sec).
    const duration = setWidth / 35;
    track.style.setProperty("--scroll-distance", `-${setWidth}px`);
    track.style.animationDuration = `${duration}s`;
  };

  setup();

  // Re-run on resize so the clone count stays correct.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 200);
  });
}

/* ─────────────  LOGO INVADERS  ─────────────
   A tiny Space-Invaders riff hidden behind the pixel ship in the hero.
   Click the ship → the page becomes an arcade where you shoot down the
   company logos before they land. Self-contained; no dependencies. */
(function () {
  const launcher = document.getElementById("game-launcher");
  const stage = document.getElementById("game-stage");
  const canvas = document.getElementById("invaders-canvas");
  if (!launcher || !stage || !canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("game-score");
  const livesEl = document.getElementById("game-lives");
  const exitBtn = document.getElementById("game-exit");
  const msgEl = document.getElementById("game-msg");

  // Pixel-ship sprite, shared by the launcher icon and the in-game player.
  const SHIP = [
    "     D     ",
    "    DGD    ",
    "    DGD    ",
    "   DGGGD   ",
    "   DBGBD   ",
    "  DGGGGGD  ",
    "  DGWGWGD  ",
    " DDGGGGGDD ",
    " D DGGGD D ",
    " D  DGD  D ",
    "     F     ",
    "    FFF    ",
  ];
  const PAL = { D: "#14130f", G: "#a8e86b", W: "#ffffff", F: "#ff9a3c", B: "#c8f5a0" };
  const SHIP_COLS = SHIP[0].length;
  const SHIP_ROWS = SHIP.length;
  function drawShip(c, x, y, px) {
    for (let r = 0; r < SHIP_ROWS; r++) {
      const row = SHIP[r];
      for (let col = 0; col < SHIP_COLS; col++) {
        const fill = PAL[row[col]];
        if (!fill) continue;
        c.fillStyle = fill;
        c.fillRect(x + col * px, y + r * px, px, px);
      }
    }
  }

  // Flat pixel-art game controller for the launcher icon (grey body, black
   // outline, colour button cross — drawn on a 24×14 pixel grid).
  const PAD_PX = {
    K: "#1b1b1b", L: "#ccd1d6", D: "#a8aeb4",
    B: "#34a8dd", G: "#36b39a", R: "#e0362b", Y: "#f2ce1e",
  };
  const padCanvas = launcher.querySelector(".game-launcher-pad");
  if (padCanvas) {
    const c = padCanvas.getContext("2d");
    const px = Math.floor(padCanvas.width / 24);
    const fill = (x, y, w, h, col) => {
      c.fillStyle = col;
      c.fillRect(x * px, y * px, w * px, h * px);
    };
    // Body silhouette — one span per row gives the rounded corners. No black
    // outline: light grey up top, darker band lower down.
    const body = [
      [0, 4, 19], [1, 3, 20], [2, 2, 21], [3, 1, 22], [4, 1, 22], [5, 1, 22],
      [6, 1, 22], [7, 1, 22], [8, 1, 22], [9, 2, 21], [10, 3, 20], [11, 4, 19],
    ];
    body.forEach(([row, a, b]) =>
      fill(a, row, b - a + 1, 1, row >= 7 ? PAD_PX.D : PAD_PX.L)
    );
    // D-pad (black plus — vertical arm sits symmetric around the crossbar)
    fill(5, 4, 2, 4, PAD_PX.K);
    fill(4, 5, 4, 2, PAD_PX.K);
    // Colour cross: blue top, green left, red right, yellow bottom
    fill(16, 3, 2, 2, PAD_PX.B);
    fill(14, 5, 2, 2, PAD_PX.G);
    fill(18, 5, 2, 2, PAD_PX.R);
    fill(16, 7, 2, 2, PAD_PX.Y);
  }

  // Cliché design feedback — the phrases you get to shoot down (≤ 3 words).
  const PHRASES = [
    "Make it pop", "Bigger logo", "More white space", "Make it modern",
    "Add a gradient", "Needs more punch", "Make it sexy", "Less is more",
    "Jazz it up", "On brand?", "Ship it", "Simplify it",
    "Make it viral", "Trust the process", "Pixel perfect", "Add drop shadow",
    "Delight users", "Think bigger", "Make it edgy", "Elevate it",
    "Can it pop?", "More engaging", "Just one tweak", "Make it premium",
    "Move it up", "Just vibes", "Make it clean", "Add motion",
    "More contrast", "Feels generic", "Make it fun", "Round the corners",
    "Bolder type", "Not quite it", "Add some flair", "Make it iconic",
  ];

  // ---- state ----
  let W = 0, H = 0, dpr = 1;
  let running = false, raf = 0, lastT = 0, gameState = "ready";
  let player, bullets, invaders, bombs, particles, stars;
  let invDir, invStepDown, killed, total, score, lives, invuln, fireCD, bombCD;
  let blockX = 0, invFont = '600 16px "Open Runde", system-ui, sans-serif';
  const keys = { left: false, right: false, fire: false };
  let pointerX = null, pointerDown = false;

  const pad = (n) => String(n).padStart(4, "0");

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeStars() {
    stars = [];
    const n = Math.round((W * H) / 11000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() * 1.6 + 0.4,
        v: Math.random() * 16 + 6,
      });
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function initGame() {
    resize();
    const shipPx = Math.max(3, Math.round(Math.min(W, H) / 150));
    player = {
      px: shipPx,
      w: SHIP_COLS * shipPx,
      h: SHIP_ROWS * shipPx,
      x: 0,
      y: H - Math.max(70, H * 0.12),
      speed: 460,
    };
    player.x = W / 2 - player.w / 2;

    bullets = [];
    bombs = [];
    particles = [];

    // Phrase chips laid out in rows. Widths vary with the text, so each row
    // is measured and centred; the whole block then slides as one unit.
    const cols = W > 900 ? 4 : W > 620 ? 3 : 2;
    const rows = 6;
    const tints = ["#eef7e6", "#e9f0f7", "#f7ecec", "#f2eef7", "#f6f4e8"];
    const fontSize = Math.round(Math.max(13, Math.min(19, W / 62)));
    invFont = "600 " + fontSize + 'px "Open Runde", system-ui, sans-serif';
    ctx.font = invFont;
    const padX = Math.round(fontSize * 0.9);
    const chipH = fontSize + Math.round(fontSize * 1.1);
    const gapX = Math.round(fontSize * 1.1);
    const gapY = Math.round(fontSize * 1.2);
    const startY = Math.max(78, H * 0.12);

    // Pick a fresh, shuffled set of phrases each game.
    const pool = PHRASES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    invaders = [];
    let picked = 0;
    for (let r = 0; r < rows; r++) {
      // Build this row's chips, measure them, then centre the row.
      const rowChips = [];
      let rowW = 0;
      for (let c = 0; c < cols; c++) {
        const phrase = pool[picked % pool.length];
        picked++;
        const w = Math.ceil(ctx.measureText(phrase).width) + padX * 2;
        rowChips.push({ phrase, w });
        rowW += w + (c > 0 ? gapX : 0);
      }
      let cx = (W - rowW) / 2;
      for (let c = 0; c < cols; c++) {
        const rc = rowChips[c];
        invaders.push({
          baseX: cx,
          y: startY + r * (chipH + gapY),
          w: rc.w,
          h: chipH,
          alive: true,
          phrase: rc.phrase,
          tint: tints[(r * cols + c) % tints.length],
        });
        cx += rc.w + gapX;
      }
    }
    total = invaders.length;
    killed = 0;
    blockX = 0;
    invDir = 1;
    invStepDown = chipH * 0.55;
    score = 0;
    lives = 3;
    invuln = 0;
    fireCD = 0;
    bombCD = 1.4;
    makeStars();
    gameState = "ready";
    updateHUD();
    showStart();
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? color : "#ffffff",
        s: 2 + Math.random() * 3,
      });
    }
  }

  function loseLife() {
    lives--;
    invuln = 1.6;
    spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "#ff9a3c");
    updateHUD();
    if (lives <= 0) endGame(false);
  }

  function update(dt) {
    for (const s of stars) {
      s.y += s.v * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }
    if (gameState !== "playing") return;

    // player
    let vx = 0;
    if (keys.left) vx -= 1;
    if (keys.right) vx += 1;
    if (vx) player.x += vx * player.speed * dt;
    if (pointerDown && pointerX != null) {
      const target = pointerX - player.w / 2;
      player.x += (target - player.x) * Math.min(1, dt * 14);
    }
    player.x = Math.max(8, Math.min(W - player.w - 8, player.x));

    // firing
    fireCD -= dt;
    if ((keys.fire || pointerDown) && fireCD <= 0) {
      bullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 14, v: 640 });
      fireCD = 0.26;
    }
    for (const b of bullets) b.y -= b.v * dt;
    bullets = bullets.filter((b) => b.y + b.h > 0 && !b.dead);

    // invader block (chips share one horizontal offset, blockX)
    let minX = Infinity, maxX = -Infinity, anyAlive = false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      anyAlive = true;
      minX = Math.min(minX, inv.baseX + blockX);
      maxX = Math.max(maxX, inv.baseX + blockX + inv.w);
    }
    if (anyAlive) {
      const speed = 44 + (killed / total) * 120;
      let stepDown = false;
      if (invDir > 0 && maxX + speed * dt > W - 8) stepDown = true;
      if (invDir < 0 && minX - speed * dt < 8) stepDown = true;
      if (stepDown) {
        invDir *= -1;
        for (const inv of invaders) inv.y += invStepDown;
      } else {
        blockX += invDir * speed * dt;
      }
    }

    // bombs
    bombCD -= dt;
    if (bombCD <= 0 && anyAlive) {
      const alive = invaders.filter((i) => i.alive);
      const src = alive[Math.floor(Math.random() * alive.length)];
      bombs.push({ x: src.baseX + blockX + src.w / 2 - 3, y: src.y + src.h, w: 6, h: 14, v: 250 });
      bombCD = 0.85 + Math.random() * 0.9;
    }
    for (const bm of bombs) bm.y += bm.v * dt;
    bombs = bombs.filter((bm) => bm.y < H && !bm.dead);

    // bullet → invader
    for (const b of bullets) {
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const ix = inv.baseX + blockX;
        if (b.x < ix + inv.w && b.x + b.w > ix &&
            b.y < inv.y + inv.h && b.y + b.h > inv.y) {
          inv.alive = false;
          b.dead = true;
          killed++;
          score += 100;
          spawnExplosion(ix + inv.w / 2, inv.y + inv.h / 2, inv.tint);
          updateHUD();
          break;
        }
      }
    }
    bullets = bullets.filter((b) => !b.dead);

    // bomb → player
    invuln -= dt;
    if (invuln <= 0) {
      for (const bm of bombs) {
        if (bm.x < player.x + player.w && bm.x + bm.w > player.x &&
            bm.y < player.y + player.h && bm.y + bm.h > player.y) {
          bm.dead = true;
          loseLife();
          break;
        }
      }
      bombs = bombs.filter((bm) => !bm.dead);
    }

    // particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 340 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    // win / lose
    if (killed >= total) { endGame(true); return; }
    for (const inv of invaders) {
      if (inv.alive && inv.y + inv.h >= player.y) { endGame(false); return; }
    }
  }

  function drawChip(inv) {
    const x = inv.baseX + blockX;
    roundRect(ctx, x, inv.y, inv.w, inv.h, 9);
    ctx.fillStyle = inv.tint;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(20,19,15,0.14)";
    ctx.stroke();
    ctx.fillStyle = "#14130f";
    ctx.font = invFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(inv.phrase, x + inv.w / 2, inv.y + inv.h / 2 + 1);
  }

  function draw() {
    ctx.fillStyle = "#0b0a09";
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = "rgba(168,232,107," + (0.2 + s.s / 3) + ")";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    for (const inv of invaders) if (inv.alive) drawChip(inv);

    ctx.fillStyle = "#a8e86b";
    for (const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#ff6b6b";
    for (const bm of bombs) ctx.fillRect(bm.x, bm.y, bm.w, bm.h);

    // player (blink while briefly invulnerable)
    if (!(invuln > 0 && Math.floor(invuln * 10) % 2)) {
      drawShip(ctx, player.x, player.y, player.px);
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = "SCORE " + pad(score);
    if (livesEl) livesEl.textContent = "♥".repeat(Math.max(0, lives));
  }

  function makeBtn(label, ghost, onClick) {
    const b = document.createElement("button");
    b.className = "game-btn" + (ghost ? " ghost" : "");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function showStart() {
    msgEl.innerHTML = "";
    const title = document.createElement("div");
    title.className = "game-msg-title";
    title.textContent = "FEEDBACK INVADERS";
    const hint = document.createElement("div");
    hint.className = "game-msg-hint";
    hint.innerHTML =
      "◀ ▶ or drag to move &nbsp;•&nbsp; SPACE / tap to fire<br>shoot the design notes before they land";
    const btns = document.createElement("div");
    btns.className = "game-msg-btns";
    btns.append(
      makeBtn("START", false, startPlay),
      makeBtn("EXIT", true, quit)
    );
    msgEl.append(title, hint, btns);
    msgEl.classList.add("show");
  }

  function endGame(win) {
    gameState = win ? "win" : "over";
    msgEl.innerHTML = "";
    const title = document.createElement("div");
    title.className = "game-msg-title";
    title.textContent = win ? "YOU WIN!" : "GAME OVER";
    const sc = document.createElement("div");
    sc.className = "game-msg-score";
    sc.textContent = "SCORE " + pad(score);
    const btns = document.createElement("div");
    btns.className = "game-msg-btns";
    btns.append(
      makeBtn("PLAY AGAIN", false, initGame),
      makeBtn("EXIT", true, quit)
    );
    msgEl.append(title, sc, btns);
    msgEl.classList.add("show");
  }

  function startPlay() {
    msgEl.classList.remove("show");
    msgEl.innerHTML = "";
    gameState = "playing";
  }

  function launch() {
    stage.classList.remove("closing");
    stage.classList.add("active");
    stage.setAttribute("aria-hidden", "false");
    document.body.classList.add("game-playing");
    initGame();
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function quit() {
    running = false;
    cancelAnimationFrame(raf);
    keys.left = keys.right = keys.fire = false;
    pointerDown = false;
    // Play the CRT switch-off, then tear the overlay down.
    stage.classList.add("closing");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      stage.classList.remove("active", "closing");
      stage.setAttribute("aria-hidden", "true");
      document.body.classList.remove("game-playing");
    }, reduce ? 0 : 380);
  }

  // ---- input ----
  launcher.addEventListener("click", launch);
  if (exitBtn) exitBtn.addEventListener("click", quit);

  window.addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    else if (e.key === " " || e.key === "Spacebar") { keys.fire = true; e.preventDefault(); }
    else if (e.key === "Escape") quit();
    else if (e.key === "Enter" && gameState !== "playing") startPlay();
  });
  window.addEventListener("keyup", (e) => {
    if (!running) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
    else if (e.key === " " || e.key === "Spacebar") keys.fire = false;
  });

  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointerX = Math.min(r.width, Math.max(0, e.clientX - r.left));
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (gameState === "ready") return;
    pointerDown = true;
    setPointer(e);
  });
  window.addEventListener("pointermove", (e) => { if (pointerDown) setPointer(e); });
  window.addEventListener("pointerup", () => { pointerDown = false; });

  window.addEventListener("resize", () => { if (running) resize(); });
})();

/* ─────────────  DOT FIELD  ─────────────
   A precise dot grid behind a section, focused on an element. Two influence
   fields: visibility (alpha) radiates from an eased point that follows the
   cursor and rests on the focal element; the lime-green tint concentrates
   around the focal element (and lifts on hover of an optional rumble element,
   when nearby dots also jitter). The grid never moves — only colour/visibility
   (and the local rumble). Canvas + rAF; only near-field dots drawn. Static on
   touch / reduced-motion. */
function createDotField(config) {
  const section = config.section;
  const canvas = config.canvas;
  const focalEl = config.focal;
  const rumbleEl = config.rumbleEl || null;
  if (!section || !canvas) return;
  const ctx = canvas.getContext("2d");

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GREEN = [150, 222, 92]; // lime, same family as the Stepstone highlight
  const GREY = [178, 183, 190]; // neutral light grey
  const SPACING = 22; // grid pitch
  const DOT_R = 1.2; // dot radius (a touch smaller than before)
  const FIELD = config.field || 400; // visibility radius around the eased centre
  const GREEN_FIELD = config.greenField || 310; // green-tint radius (around focal)
  const RUMBLE_R = config.rumbleR || 150; // dots within this of focal can rumble
  const MAX_ALPHA = 0.8;

  let W = 0, H = 0, dpr = 1;
  let dots = [];
  const focal = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const centre = { x: 0, y: 0 };
  let seeded = false;
  let mouseInside = false;
  let rumble = 0, rumbleTarget = 0;
  let raf = 0, running = false;
  let crect = null; // cached canvas rect (avoids layout thrash on mousemove)

  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  function build() {
    // Base everything on the canvas box (it may be full-bleed, wider than the
    // section) so the grid can extend beyond the content max-width.
    const rect = canvas.getBoundingClientRect();
    crect = rect;
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    const ox = (W % SPACING) / 2;
    const oy = (H % SPACING) / 2;
    for (let y = oy; y <= H; y += SPACING) {
      for (let x = ox; x <= W; x += SPACING) {
        dots.push({ x, y, seed: Math.random() * Math.PI * 2 });
      }
    }

    if (focalEl) {
      const fr = focalEl.getBoundingClientRect();
      focal.x = fr.left - rect.left + fr.width / 2;
      focal.y = fr.top - rect.top + fr.height / 2;
    } else {
      focal.x = W / 2;
      focal.y = H / 2;
    }
    if (!mouseInside) {
      target.x = focal.x;
      target.y = focal.y;
    }
    if (!seeded) {
      centre.x = focal.x;
      centre.y = focal.y;
      seeded = true;
    }
  }

  function paint(now, animate) {
    if (animate) {
      centre.x = lerp(centre.x, target.x, 0.09);
      centre.y = lerp(centre.y, target.y, 0.09);
      rumble = lerp(rumble, rumbleTarget, 0.12);
    } else {
      centre.x = focal.x;
      centre.y = focal.y;
      rumble = 0;
    }

    ctx.clearRect(0, 0, W, H);
    const time = now / 1000;
    const fieldSq = FIELD * FIELD;

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const mdx = d.x - centre.x;
      const mdy = d.y - centre.y;
      const mSq = mdx * mdx + mdy * mdy;
      if (mSq > fieldSq) continue;
      const mt = 1 - Math.sqrt(mSq) / FIELD;
      let alpha = mt * mt * MAX_ALPHA * (1 + 0.3 * rumble);
      if (alpha < 0.012) continue;

      const cdx = d.x - focal.x;
      const cdy = d.y - focal.y;
      const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
      const ct = 1 - cDist / GREEN_FIELD;
      const green = smooth(0.25, 0.9, ct + 0.18 * rumble);
      const r = (GREY[0] + (GREEN[0] - GREY[0]) * green) | 0;
      const g = (GREY[1] + (GREEN[1] - GREY[1]) * green) | 0;
      const b = (GREY[2] + (GREEN[2] - GREY[2]) * green) | 0;

      let px = d.x;
      let py = d.y;
      if (rumble > 0.001 && cDist < RUMBLE_R) {
        const rf = (1 - cDist / RUMBLE_R) * rumble;
        const amp = 1.8 * rf;
        px += Math.sin(time * 27 + d.seed) * amp;
        py += Math.cos(time * 23 + d.seed * 1.7) * amp;
      }

      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
      ctx.beginPath();
      ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!running) return;
    paint(now, true);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  build();

  // Touch devices (mobile/tablet): no dot field at all.
  if (!fine) return;

  // Desktop with reduced motion: a single static field, no animation.
  if (reduce) {
    paint(performance.now(), false);
    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        build();
        paint(performance.now(), false);
      }, 150);
    });
    return;
  }

  // Track the cursor across the whole canvas band (full-bleed on the hero), and
  // ease back to the focal element when it leaves. Cached rect avoids reflow.
  const refreshRect = () => (crect = canvas.getBoundingClientRect());
  window.addEventListener("scroll", refreshRect, { passive: true });
  window.addEventListener(
    "mousemove",
    (e) => {
      if (!crect) return;
      const x = e.clientX - crect.left;
      const y = e.clientY - crect.top;
      if (x >= 0 && x <= crect.width && y >= 0 && y <= crect.height) {
        target.x = x;
        target.y = y;
        mouseInside = true;
      } else if (mouseInside) {
        mouseInside = false;
        target.x = focal.x;
        target.y = focal.y;
      }
    },
    { passive: true }
  );
  if (rumbleEl) {
    rumbleEl.addEventListener("mouseenter", () => (rumbleTarget = 1));
    rumbleEl.addEventListener("mouseleave", () => (rumbleTarget = 0));
  }

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(build, 150);
  });

  // Only animate while the section is on screen.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => (en.isIntersecting ? start() : stop())),
    { threshold: 0 }
  );
  io.observe(section);
}

// Hero: dot field focused on the pixel controller (rumbles on hover).
createDotField({
  section: document.querySelector(".hero"),
  canvas: document.getElementById("hero-dots"),
  focal: document.getElementById("game-launcher"),
  rumbleEl: document.getElementById("game-launcher"),
});

// About: dot field focused on the portrait photo (cursor-follow only).
createDotField({
  section: document.getElementById("about"),
  canvas: document.getElementById("about-dots"),
  focal: document.querySelector(".about-portrait"),
});
