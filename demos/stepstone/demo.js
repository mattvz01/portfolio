/* ──────────────────────────────────────────────────────────────
   Stepstone AI job search — product demo orchestration

   One persistent DOM morphs through five states. The whole film is
   a pure function of time: build() writes from→to tweens onto
   elements, render(t) evaluates them. That makes play, pause, scrub,
   restart and live parameter edits all the same operation.

   Shared elements (no screen crossfades):
     search fields  → compact criteria header   (#morphFields + ghosts)
     header AI spinner → modal highlight → Companion header (#aiSpin)
     modal card     → Companion page            (#sheet)
     suggestion card → user request bubble      (#morphBubble)
   ────────────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const phone = $("phone");
  const query = new URLSearchParams(location.search);
  const EMBED = query.has("embed");
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)");
  if (EMBED) document.documentElement.classList.add("is-embed");

  /* ═════════ Parameters ═════════ */
  const DEFAULTS = {
    speed: 1, // transition duration multiplier
    hold: 1, // scene hold multiplier
    stagger: 70, // ms between sibling entrances
    modalScale: 0.97,
    cardDist: 16, // px
    easing: "calm",
    touch: true,
    camera: true,
    loop: true,
    reduced: prefersReduced.matches,
  };
  const P = { ...DEFAULTS };

  /* ═════════ Easing ═════════ */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-6) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        if (sx(t) < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }
  // Entering: ease-out. Leaving: ease-in. Moving/transforming: ease-in-out.
  const EASE_SETS = {
    calm: { out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], inOut: [0.65, 0, 0.35, 1] },
    crisp: { out: [0.16, 1, 0.3, 1], in: [0.55, 0, 1, 0.45], inOut: [0.76, 0, 0.24, 1] },
    soft: { out: [0.25, 0.6, 0.35, 1], in: [0.45, 0, 0.8, 0.6], inOut: [0.45, 0, 0.55, 1] },
  };
  let EASE = {};
  const linear = (x) => x;
  const step = (x) => (x >= 1 ? 1 : 0);

  /* ═════════ Tween store ═════════ */
  const MOTION_PROPS = new Set(["x", "y", "scale", "sx", "rot"]);
  let tracks = new Map(); // el → Map(prop → segments[])
  let hooks = [];
  let R = false; // reduced-motion build

  function anim(el, props, at, dur, ease = "out") {
    if (Array.isArray(el)) return el.forEach((x) => anim(x, props, at, dur, ease));
    const fn = typeof ease === "function" ? ease : EASE[ease];
    for (const prop in props) {
      // Reduced motion: no travel, scale or spin — only opacity and colour change.
      if (R && MOTION_PROPS.has(prop) && !anim.keep) continue;
      const [from, to] = props[prop];
      if (!tracks.has(el)) tracks.set(el, new Map());
      const m = tracks.get(el);
      if (!m.has(prop)) m.set(prop, []);
      m.get(prop).push({ a: at, b: at + Math.max(dur, 1e-4), from, to, ease: fn });
    }
  }
  // Instant state change at a point in time.
  const set = (el, props, at) => anim(el, props, at, 1e-4, step);

  const lerp = (a, b, p) =>
    Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * p) : a + (b - a) * p;

  function valueAt(segs, t) {
    if (t <= segs[0].a) return segs[0].from;
    let s = segs[0];
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].a <= t) { s = segs[i]; break; }
    }
    if (t >= s.b) return s.to;
    return lerp(s.from, s.to, s.ease((t - s.a) / (s.b - s.a)));
  }

  const written = new WeakMap();
  function write(el, key, val, apply) {
    let w = written.get(el);
    if (!w) written.set(el, (w = {}));
    if (w[key] === val) return;
    w[key] = val;
    apply(val);
  }

  function render(t) {
    for (const [el, props] of tracks) {
      const v = {};
      for (const [prop, segs] of props) v[prop] = valueAt(segs, t);
      if ("x" in v || "y" in v || "scale" in v || "rot" in v || "sx" in v) {
        const tf =
          `translate3d(${(v.x || 0).toFixed(2)}px,${(v.y || 0).toFixed(2)}px,0)` +
          (v.scale !== undefined ? ` scale(${v.scale.toFixed(4)})` : "") +
          (v.sx !== undefined ? ` scaleX(${v.sx.toFixed(4)})` : "") +
          (v.rot !== undefined ? ` rotate(${v.rot.toFixed(2)}deg)` : "");
        write(el, "transform", tf, (s) => (el.style.transform = s));
      }
      if ("opacity" in v) {
        const o = Math.max(0, Math.min(1, v.opacity));
        write(el, "opacity", o.toFixed(3), (s) => {
          el.style.opacity = s;
          el.style.visibility = o <= 0.001 ? "hidden" : "visible";
        });
      }
      if ("clip" in v) {
        const [tp, rt, bt, lt, rad] = v.clip.map((n) => n.toFixed(2));
        write(el, "clip", `inset(${tp}px ${rt}px ${bt}px ${lt}px round ${rad}px)`, (s) => {
          el.style.clipPath = s;
          el.style.webkitClipPath = s;
        });
      }
      if ("chars" in v) {
        const full = el.dataset.text || "";
        write(el, "chars", Math.floor(v.chars + 1e-6), (n) => (el.textContent = full.slice(0, n)));
      }
      for (const k in v) {
        if (k.startsWith("--")) {
          write(el, k, v[k].toFixed(3), (s) => el.style.setProperty(k, s));
        }
      }
    }
    for (const h of hooks) h(t);
  }

  /* ═════════ Measurement (phone-space px) ═════════ */
  function rel(el) {
    const p = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = p.width / 375;
    return { x: (r.left - p.left) / k, y: (r.top - p.top) / k, w: r.width / k, h: r.height / k };
  }
  const center = (r, fx = 0.5, fy = 0.5) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy });
  // clip-path inset (top, right, bottom, left, radius) for a rect inside the 375×812 phone
  const inset = (r, rad) => [r.y, 375 - (r.x + r.w), 812 - (r.y + r.h), r.x, rad];

  function resetForMeasure() {
    for (const el of tracks.keys()) {
      el.style.transform = "";
      el.style.clipPath = "";
      el.style.webkitClipPath = "";
      const w = written.get(el);
      if (w) { delete w.transform; delete w.clip; delete w.chars; }
    }
    $$("[data-text]").forEach((el) => (el.textContent = el.dataset.text));
  }

  /* ═════════ Text helpers ═════════ */
  function splitWords(el) {
    if (el.dataset.split) return $$(".w", el);
    const words = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of node.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.appendChild(w);
          words.push(w);
        }
        node.replaceWith(frag);
      } else {
        const w = document.createElement("span");
        w.className = "w";
        node.replaceWith(w);
        w.appendChild(node);
        words.push(w);
      }
    }
    el.dataset.split = "1";
    return $$(".w", el);
  }

  // Human typing rhythm, deterministic per string.
  function typingEase(str) {
    let seed = 0;
    for (const c of str) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const gaps = Array.from(str, (c) => (c === " " ? 1.5 : 0.75 + rand() * 0.55));
    const total = gaps.reduce((a, b) => a + b, 0);
    let acc = 0;
    const marks = gaps.map((g) => (acc += g) / total);
    return (p) => {
      let n = 0;
      while (n < marks.length && marks[n] <= p + 1e-9) n++;
      return n / str.length;
    };
  }
  function typeInto(el, at, perChar) {
    const str = el.dataset.text;
    const dur = R ? 1e-4 : str.length * perChar;
    anim(el, { chars: [0, str.length] }, at, dur, R ? step : typingEase(str));
    return at + dur;
  }

  /* ═════════ Timeline ═════════ */
  const E = {}; // element refs
  ["curtain", "hdrSpin", "heroBg", "heroGrad", "headline", "seg", "fields", "inJob", "inLoc",
    "valJob", "valLoc", "caretJob", "caretLoc", "findBtn", "morphFields", "trackPlus", "trackTab",
    "tabLabel", "contentArea", "chipJob", "chipLoc", "chipLocLabel", "chipLocMi", "chipMan",
    "pencil", "impact", "toolbar", "job1", "job2", "fitJob1", "overlay", "sheet", "modal", "mTag",
    "mTitle", "mBody", "mFoot", "tryBtn", "laterBtn", "morphBubble", "companion", "back", "intro",
    "introDesc", "suggHead", "prompt1", "prompt2", "prompt3", "p1Icon", "p1Label", "p1Arrow",
    "interaction", "chat", "chatInner", "bubble", "answer", "matches", "m1Head", "m1Fit", "m1Act",
    "mDivider", "m2Head", "m2Fit", "m2Act", "reactions", "aiSpin", "aiRing", "aiSpinImg",
    "ghostJob", "ghostLoc", "touch", "cam",
  ].forEach((id) => (E[id] = $(id)));

  let D = 40; // total duration (s)
  let END = 40; // where a non-looping run stops (before the outro)
  let SCENES = [];

  function build() {
    R = !!P.reduced;
    const e = EASE_SETS[P.easing] || EASE_SETS.calm;
    EASE = { out: bezier(...e.out), in: bezier(...e.in), inOut: bezier(...e.inOut), linear, step };

    // Re-measure from a clean layout before writing any tweens.
    resetForMeasure();
    tracks = new Map();
    hooks = [];

    const introWords = splitWords(E.intro);
    const answerWords = splitWords(E.answer);

    const M = {
      job: rel(E.inJob), loc: rel(E.inLoc), find: rel(E.findBtn),
      fields: rel(E.fields), content: rel(E.contentArea),
      valJob: rel(E.valJob), valLoc: rel(E.valLoc),
      tabLabel: rel(E.tabLabel), chipLoc: rel(E.chipLocLabel),
      modal: rel(E.modal), tryBtn: rel(E.tryBtn),
      card: rel(E.prompt1), bubble: rel(E.bubble),
      reactions: rel(E.reactions), chat: rel(E.chat),
    };

    const S = P.speed;
    const H = P.hold;
    const G = P.stagger / 1000;
    const m = (d) => d * S; // motion durations
    const h = (d) => d * H; // reading holds
    const dist = P.cardDist;
    const TOUCH = P.touch && !R;

    /* Touch indicator — a quiet stand-in for the user's finger. */
    let tp = center(M.job, 0.62);
    set(E.touch, { x: [tp.x, tp.x], y: [tp.y, tp.y], opacity: [0, 0], scale: [1, 1] }, 0);
    const touch = {
      show(at, pt) {
        if (!TOUCH) return;
        set(E.touch, { x: [pt.x, pt.x], y: [pt.y, pt.y] }, at);
        tp = pt;
        anim(E.touch, { opacity: [0, 1], scale: [1.15, 1] }, at, m(0.3), "out");
      },
      move(at, pt, dur) {
        if (!TOUCH) return;
        anim(E.touch, { x: [tp.x, pt.x], y: [tp.y, pt.y] }, at, dur, "inOut");
        tp = pt;
      },
      press(at) {
        if (!TOUCH) return;
        anim(E.touch, { scale: [1, 0.82] }, at, 0.12, "out");
        anim(E.touch, { scale: [0.82, 1] }, at + 0.14, 0.22, "out");
      },
      hide(at) {
        if (!TOUCH) return;
        anim(E.touch, { opacity: [1, 0], scale: [1, 0.9] }, at, m(0.3), "in");
      },
    };
    // Button press: 1 → 0.98 → 1
    const press = (el, at) => {
      anim(el, { scale: [1, 0.98] }, at, 0.12, "out");
      anim(el, { scale: [0.98, 1] }, at + 0.14, 0.2, "out");
      return at + 0.34;
    };
    // Caret: solid while typing, blinking while focused.
    const caret = (el, on, off, typeStart, typeEnd) =>
      hooks.push((t) => {
        let o = 0;
        if (!R && t >= on && t < off) {
          o = t >= typeStart && t < typeEnd + 0.35 ? 1 : Math.floor((t - on) / 0.53) % 2 === 0 ? 1 : 0;
        }
        write(el, "opacity", o, (s) => (el.style.opacity = s));
      });

    let t = 0;

    /* ── Opening ── */
    anim(E.curtain, { opacity: [1, 0] }, 0, m(0.8), "out");
    if (!R) {
      // Hero gradient drifts very slowly — present, never noticed.
      hooks.push((tt) => {
        const x = -10 * Math.sin(tt * 0.21);
        const y = -5 * Math.sin(tt * 0.15 + 1);
        write(E.heroGrad, "transform", `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(1.02)`,
          (s) => (E.heroGrad.style.transform = s));
      });
    }

    /* ══ STATE 1 · Home / Search ══ */
    set(E.valJob, { chars: [0, 0] }, 0);
    set(E.valLoc, { chars: [0, 0] }, 0);
    set(E.inJob, { "--f": [0, 0] }, 0);
    set(E.inLoc, { "--f": [0, 0] }, 0);
    set(E.findBtn, { "--h": [0, 0], scale: [1, 1] }, 0);

    t = h(1.1);
    const pJob = center(M.job, 0.6);
    touch.show(t - m(0.35), pJob);
    touch.press(t);
    const focusJob = t + 0.06;
    anim(E.inJob, { "--f": [0, 1] }, focusJob, m(0.2), "out");
    const typeJob = focusJob + 0.3;
    const typeJobEnd = typeInto(E.valJob, typeJob, 0.068 * S);

    t = typeJobEnd + h(0.35);
    const pLoc = center(M.loc, 0.45);
    touch.move(t, pLoc, m(0.5));
    t += m(0.5);
    touch.press(t);
    const focusLoc = t + 0.06;
    anim(E.inJob, { "--f": [1, 0] }, focusLoc, m(0.18), "out");
    anim(E.inLoc, { "--f": [0, 1] }, focusLoc, m(0.2), "out");
    const typeLoc = focusLoc + 0.28;
    const typeLocEnd = typeInto(E.valLoc, typeLoc, 0.075 * S);
    caret(E.caretJob, focusJob, focusLoc, typeJob, typeJobEnd);

    t = typeLocEnd + h(0.35);
    const pFind = center(M.find, 0.52, 0.55);
    touch.move(t, pFind, m(0.55));
    anim(E.inLoc, { "--f": [1, 0] }, t + m(0.2), m(0.2), "out");
    caret(E.caretLoc, focusLoc, t + m(0.2), typeLoc, typeLocEnd);
    t += m(0.55);
    anim(E.findBtn, { "--h": [0, 1] }, t - 0.05, 0.2, "out"); // hover
    t += h(0.4);
    touch.press(t);
    const tx = press(E.findBtn, t); // transition begins on release
    SCENES.push({ name: "Home", t: 0 });

    /* ══ Home → Results: search compresses into the criteria header ══ */
    touch.hide(tx - 0.08);
    anim(E.findBtn, { opacity: [1, 0] }, tx, m(0.2), "in");
    anim(E.headline, { opacity: [1, 0], y: [0, -14] }, tx, m(0.36), "in");
    anim(E.seg, { opacity: [1, 0], y: [0, -10] }, tx + 0.03, m(0.32), "in");
    anim(E.heroBg, { opacity: [1, 0], scale: [1, 0.985] }, tx + 0.04, m(0.55), "in");

    const morphAt = tx + 0.04;
    const morphDur = m(0.72);
    const land = morphAt + morphDur;
    if (!R) {
      // The fields' grey surface becomes the criteria container.
      set(E.fields, { "--bgA": [1, 0] }, morphAt);
      set(E.morphFields, { opacity: [0, 1] }, morphAt);
      anim(E.morphFields, { clip: [inset(M.fields, 12), inset(M.content, 12)], "--mix": [0, 1] },
        morphAt, morphDur, "inOut");
      set(E.morphFields, { opacity: [1, 0] }, land + m(0.3));
      anim([E.inJob, E.inLoc], { opacity: [1, 0] }, morphAt, m(0.22), "in");

      // Shared text: "Product Manager" → search tab, "London" → location chip.
      const flight = (ghost, src, dst, srcLH, dstLH, s, at, dur) => {
        ghost.style.left = `${src.x}px`;
        ghost.style.top = `${src.y}px`;
        const dy = dst.y - src.y - (srcLH * s - dstLH) / 2;
        set(ghost, { opacity: [0, 1], x: [0, 0], y: [0, 0], scale: [1, 1] }, at);
        anim(ghost, { x: [0, dst.x - src.x], y: [0, dy], scale: [1, s] }, at, dur, "inOut");
        anim(ghost, { opacity: [1, 0] }, at + dur, m(0.16), "linear");
        return at + dur;
      };
      set(E.valJob, { opacity: [1, 0] }, morphAt);
      set(E.valLoc, { opacity: [1, 0] }, morphAt);
      const landJob = flight(E.ghostJob, M.valJob, M.tabLabel, 24, 20, 14 / 16, morphAt + 0.04, m(0.74));
      const landLoc = flight(E.ghostLoc, M.valLoc, M.chipLoc, 24, 18, 12 / 16, morphAt + 0.1, m(0.74));
      anim(E.tabLabel, { opacity: [0, 1] }, landJob, m(0.16), "linear");
      anim(E.chipLocLabel, { opacity: [0, 1] }, landLoc, m(0.16), "linear");
    } else {
      anim(E.fields, { opacity: [1, 0] }, tx, m(0.3), "in");
      set(E.tabLabel, { opacity: [1, 1] }, 0);
      set(E.chipLocLabel, { opacity: [1, 1] }, 0);
    }

    // Criteria header resolves around the landed text.
    anim(E.trackTab, { opacity: [0, 1], y: [4, 0] }, land - m(0.28), m(0.32), "out");
    anim(E.trackPlus, { opacity: [0, 1] }, land - m(0.15), m(0.3), "out");
    anim(E.contentArea, { opacity: [0, 1] }, land - 0.02, m(0.22), "out");
    anim(E.chipJob, { opacity: [0, 1] }, land, m(0.25), "out");
    anim(E.chipLoc, { opacity: [0, 1] }, land + G * 0.5, m(0.25), "out");
    anim(E.chipLocMi, { opacity: [0, 1] }, land + m(0.15), m(0.25), "out");
    anim(E.chipMan, { opacity: [0, 1], x: [-4, 0] }, land + G * 1.5, m(0.3), "out");
    anim(E.pencil, { opacity: [0, 1] }, land + G * 2, m(0.3), "out");
    anim(E.impact, { opacity: [0, 1], y: [4, 0] }, land + G * 2.5, m(0.35), "out");

    // Results move into place, first card leads.
    const listAt = land + 0.08;
    anim(E.toolbar, { opacity: [0, 1], y: [dist * 0.5, 0] }, listAt, m(0.4), "out");
    anim(E.job1, { opacity: [0, 1], y: [dist, 0], scale: [0.98, 1] }, listAt + G * 1.2, m(0.55), "out");
    anim(E.job2, { opacity: [0, 1], y: [dist * 1.25, 0], scale: [0.98, 1] }, listAt + G * 3, m(0.6), "out");
    const bars1 = $$(".bar b", E.fitJob1);
    bars1.forEach((b, i) =>
      anim(b, { opacity: [0, 1], sx: [0.2, 1] }, listAt + m(0.5) + i * 0.08, m(0.28), "out"));
    SCENES.push({ name: "Results", t: tx });

    /* ══ STATE 3 · What's new ══ */
    const tm = listAt + m(0.6) + h(4.0);
    anim(E.overlay, { opacity: [0, 1] }, tm, m(0.45), "out");
    set(E.aiSpin, { opacity: [0, 1], x: [0, 0] }, tm);
    anim(E.aiRing, { opacity: [0, 1], scale: [0.8, 1] }, tm + 0.12, m(0.35), "out");
    const modalAt = tm + 0.16;
    anim(E.modal, { opacity: [0, 1], scale: [P.modalScale, 1], y: [8, 0] }, modalAt, m(0.5), "out");
    [E.mTag, E.mTitle, E.mBody, E.mFoot].forEach((el, i) =>
      anim(el, { opacity: [0, 1], y: [4, 0] }, modalAt + 0.08 + i * G * 0.7, m(0.38), "out"));
    set(E.tryBtn, { "--h": [0, 0], scale: [1, 1] }, 0);
    SCENES.push({ name: "What’s new", t: tm });

    t = modalAt + m(0.5) + h(3.4);
    const pTry = center(M.tryBtn, 0.5, 0.6);
    touch.show(t - m(0.3), { x: pTry.x + 18, y: pTry.y + 26 });
    touch.move(t, pTry, m(0.45));
    t += m(0.45);
    anim(E.tryBtn, { "--h": [0, 1] }, t - 0.05, 0.2, "out");
    t += h(0.45);
    touch.press(t);
    const tc = press(E.tryBtn, t);

    /* ══ What's new → Companion: the modal card becomes the page ══ */
    touch.hide(tc - 0.05);
    if (!R) {
      set(E.sheet, { opacity: [0, 1], clip: [inset(M.modal, 16), inset(M.modal, 16)] }, tc);
      anim(E.modal, { opacity: [1, 0] }, tc, m(0.22), "in");
      anim(E.sheet, { clip: [inset(M.modal, 16), [0, 0, 0, 0, 24]] }, tc + 0.06, m(0.72), "inOut");
    } else {
      set(E.sheet, { clip: [[0, 0, 0, 0, 24], [0, 0, 0, 0, 24]] }, 0);
      anim(E.modal, { opacity: [1, 0] }, tc, m(0.3), "in");
      anim(E.sheet, { opacity: [0, 1] }, tc + 0.1, m(0.45), "inOut");
    }
    anim(E.overlay, { opacity: [1, 0] }, tc + 0.3, m(0.45), "out");
    // The highlighted AI spinner travels to the Companion header.
    const spinDx = 176 - 335;
    if (!R) anim(E.aiSpin, { x: [0, spinDx] }, tc + 0.12, m(0.72), "inOut");
    else {
      // Hand the spinner over while the page fades, without travel.
      anim(E.aiSpin, { opacity: [1, 0] }, tc, m(0.25), "in");
      anim.keep = true;
      set(E.aiSpin, { x: [0, spinDx] }, tc + m(0.3));
      anim.keep = false;
      anim(E.aiSpin, { opacity: [0, 1] }, tc + m(0.35), m(0.35), "out");
    }
    anim(E.aiRing, { opacity: [1, 0] }, tc + 0.12, m(0.3), "in");

    /* ══ STATE 4 · Companion intro ══ */
    const ci = tc + 0.06 + m(0.6);
    anim(E.back, { opacity: [0, 1], x: [-4, 0] }, ci, m(0.4), "out");
    anim(E.interaction, { opacity: [0, 1], y: [8, 0] }, ci + 0.05, m(0.5), "out");
    set(E.intro, { opacity: [1, 1], y: [0, 0] }, 0);
    introWords.forEach((w, i) =>
      anim(w, { opacity: [0, 1], y: [6, 0] }, ci + 0.12 + i * (R ? 0 : G * 0.45), m(0.5), "out"));
    const introEnd = ci + 0.12 + introWords.length * (R ? 0 : G * 0.45);
    anim(E.introDesc, { opacity: [0, 1], y: [8, 0] }, introEnd + m(0.1), m(0.5), "out");
    const suggAt = introEnd + m(0.45);
    anim(E.suggHead, { opacity: [0, 1] }, suggAt, m(0.4), "out");
    [E.prompt1, E.prompt2, E.prompt3].forEach((el, i) =>
      anim(el, { opacity: [0, 1], y: [12, 0], scale: [1, 1] }, suggAt + 0.08 + i * G * 1.4, m(0.5), "out"));
    set(E.prompt1, { "--h": [0, 0], "--bgA": [1, 1] }, 0);
    SCENES.push({ name: "Companion", t: tc });

    t = suggAt + m(0.6) + h(3.4);
    const pCard = center(M.card, 0.55, 0.58);
    touch.show(t - m(0.3), { x: pCard.x + 24, y: pCard.y + 40 });
    touch.move(t, pCard, m(0.45));
    t += m(0.45);
    anim(E.prompt1, { "--h": [0, 1] }, t - 0.05, 0.22, "out");
    t += h(0.45);
    touch.press(t);
    const tq = press(E.prompt1, t);

    /* ══ Companion → Matches: the suggestion becomes the request ══ */
    touch.hide(tq - 0.05);
    const out = (el, at) => anim(el, { opacity: [1, 0], y: [0, -8] }, at, m(0.3), "in");
    out(E.intro, tq);
    out(E.introDesc, tq + 0.03);
    out(E.suggHead, tq + 0.05);
    anim([E.prompt2, E.prompt3], { opacity: [1, 0] }, tq + 0.02, m(0.25), "in");
    const bubbleAt = tq + 0.04;
    const bubbleDur = m(0.78);
    if (!R) {
      set(E.prompt1, { "--bgA": [1, 0] }, bubbleAt);
      anim(E.prompt1, { "--h": [1, 0] }, tq - 0.2, 0.2, "out");
      anim([E.p1Icon, E.p1Label, E.p1Arrow], { opacity: [1, 0] }, bubbleAt, m(0.2), "in");
      set(E.morphBubble, { opacity: [0, 1] }, bubbleAt);
      anim(E.morphBubble, { clip: [inset(M.card, 16), inset(M.bubble, 12)], "--mix": [0, 1] },
        bubbleAt, bubbleDur, "inOut");
      set(E.morphBubble, { opacity: [1, 0] }, bubbleAt + bubbleDur + m(0.3));
    } else {
      anim(E.prompt1, { opacity: [1, 0] }, tq, m(0.3), "in");
    }
    anim(E.bubble, { opacity: [0, 1] }, bubbleAt + bubbleDur - 0.06, m(0.24), "out");

    /* ══ STATE 5 · Personalised matches ══ */
    const think = bubbleAt + bubbleDur;
    const answerAt = think + h(1.25);
    // Thinking: the AI spinner turns, eases to rest as the answer starts streaming.
    anim(E.aiSpinImg, { rot: [0, 720] }, think - 0.1, answerAt - think + 0.6, "inOut");
    const wordGap = R ? 0 : Math.max(0.03, G * 0.85);
    answerWords.forEach((w, i) =>
      anim(w, { opacity: [0, 1], y: [4, 0] }, answerAt + i * wordGap, m(0.42), "out"));
    const answerEnd = answerAt + answerWords.length * wordGap;

    const cardsAt = answerEnd + h(0.45);
    anim(E.matches, { opacity: [0, 1], y: [dist * 0.75, 0], scale: [0.98, 1] }, cardsAt, m(0.55), "out");
    const row = (head, fit, act, at) => {
      anim(head, { opacity: [0, 1], y: [6, 0] }, at, m(0.45), "out");
      anim(fit, { opacity: [0, 1] }, at + m(0.3), m(0.3), "out");
      $$(".bar b", fit).forEach((b, i) =>
        anim(b, { opacity: [0, 1], sx: [0.2, 1] }, at + m(0.42) + i * 0.09, m(0.3), "out"));
      const txt = fit.querySelector(".fit-text");
      anim(txt, { opacity: [0, 1], x: [-3, 0] }, at + m(0.62), m(0.35), "out");
      anim(act, { opacity: [0, 1], y: [4, 0] }, at + m(0.75), m(0.4), "out");
      return at + m(0.75) + m(0.4);
    };
    const r1 = row(E.m1Head, E.m1Fit, E.m1Act, cardsAt + m(0.15));
    anim(E.mDivider, { opacity: [0, 1], sx: [0, 1] }, r1 - m(0.1), m(0.5), "inOut");
    const r2At = r1 + h(0.35);
    const r2 = row(E.m2Head, E.m2Fit, E.m2Act, r2At);
    // The thread scrolls just enough to keep the newest content in view.
    const overflow = Math.max(0, M.reactions.y + M.reactions.h + 16 - (M.chat.y + M.chat.h));
    anim(E.chatInner, { y: [0, -overflow] }, r2At - 0.1, m(0.8), "inOut");
    // Reduced motion can't scroll the thread, so it stops short of the feedback row.
    anim(E.reactions, { opacity: [0, R ? 0 : 1] }, r2 + m(0.15), m(0.4), "out");
    SCENES.push({ name: "Matches", t: tq });

    /* ── Settle, then fade through white for the loop ── */
    END = r2 + h(6.5);
    D = END + m(0.9);
    anim(E.curtain, { opacity: [0, 1] }, END, m(0.9), "inOut");

    /* ── Camera: a slow, barely-there push that resets between scenes ── */
    if (P.camera && !R) {
      const c = E.cam;
      const k = [
        [0, 1, 0], [tx, 1.014, 0],
        [land + m(0.2), 1.004, 0], [tm, 1.012, 0],
        [modalAt + m(0.8), 1.022, 10], [tc, 1.026, 10],
        [ci + m(0.4), 1.006, 0], [tq, 1.016, 0],
        [think + m(0.6), 1.008, 0], [END, 1.022, -6],
      ];
      set(c, { scale: [1, 1], y: [0, 0] }, 0);
      for (let i = 1; i < k.length; i++) {
        const [a, s0, y0] = k[i - 1];
        const [b, s1, y1] = k[i];
        anim(c, { scale: [s0, s1], y: [y0, y1] }, a, b - a, "inOut");
      }
    } else {
      set(E.cam, { scale: [1, 1], y: [0, 0] }, 0);
    }

    SCENES = SCENES.filter((s, i, a) => a.findIndex((x) => x.name === s.name) === i);
    for (const props of tracks.values()) for (const segs of props.values()) segs.sort((a, b) => a.a - b.a);
  }

  /* ═════════ Player ═════════ */
  let time = 0;
  let playing = false;
  let lastNow = null;
  let raf = 0;
  let onScreen = true;

  function setTime(t) {
    time = Math.max(0, Math.min(D, t));
    render(time);
    syncUI();
  }
  function tick(now) {
    raf = 0;
    if (!playing) return;
    if (lastNow !== null) {
      time += Math.min(0.1, (now - lastNow) / 1000);
      const stopAt = P.loop ? D : END;
      if (time >= stopAt) {
        if (P.loop) time -= D;
        else { time = END; pause(); }
      }
    }
    lastNow = now;
    render(time);
    syncUI();
    if (playing) raf = requestAnimationFrame(tick);
  }
  function play() {
    if (time >= END && !P.loop) time = 0;
    playing = true;
    lastNow = null;
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(tick);
    syncUI();
  }
  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    syncUI();
  }
  function rebuild(keepProgress = true) {
    const frac = D ? time / D : 0;
    SCENES = [];
    build();
    time = keepProgress ? frac * D : 0;
    render(time);
    buildSceneMarkers();
    syncUI();
  }

  /* ═════════ Fit the phone to its stage ═════════ */
  const stage = $("stage");
  const fitEl = $("fitbox");
  function fit() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    const pad = EMBED ? Math.min(w, hgt) * 0.06 : 32;
    const glass = 16 * 2; // frosted container around the phone
    const s = Math.max(0.1, Math.min((hgt - pad * 2) / (812 + glass), (w - pad * 2) / (375 + glass)));
    fitEl.style.setProperty("--fit", s.toFixed(4));
  }
  new ResizeObserver(fit).observe(stage);

  /* ═════════ Controls ═════════ */
  const playBtn = $("playBtn");
  const scrub = $("scrub");
  const timeEl = $("time");
  const scenesEl = $("scenes");
  const form = $("params");
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function syncUI() {
    if (EMBED) return;
    playBtn.classList.toggle("is-paused", !playing);
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    scrub.max = D.toFixed(2);
    scrub.value = time.toFixed(2);
    timeEl.textContent = `${fmt(time)} / ${fmt(D)}`;
    let cur = 0;
    SCENES.forEach((s, i) => { if (time >= s.t - 0.01) cur = i; });
    $$("button", scenesEl).forEach((b, i) => b.classList.toggle("is-on", i === cur));
  }
  function buildSceneMarkers() {
    if (EMBED) return;
    scenesEl.innerHTML = "";
    SCENES.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.name;
      b.title = s.name;
      b.style.left = `${(s.t / D) * 100}%`;
      b.addEventListener("click", () => setTime(s.t + 0.001));
      scenesEl.appendChild(b);
    });
  }

  function readParams() {
    const fd = new FormData(form);
    P.speed = +fd.get("speed");
    P.hold = +fd.get("hold");
    P.stagger = +fd.get("stagger");
    P.modalScale = +fd.get("modalScale");
    P.cardDist = +fd.get("cardDist");
    P.easing = fd.get("easing");
    P.touch = fd.has("touch");
    P.camera = fd.has("camera");
    P.loop = fd.has("loop");
    P.reduced = fd.has("reduced");
    $$("output", form).forEach((o) => {
      const k = o.dataset.for;
      const v = P[k];
      o.textContent =
        k === "stagger" ? `${v} ms` : k === "cardDist" ? `${v} px` : k === "modalScale" ? v.toFixed(3) : `${v.toFixed(2)}×`;
    });
  }
  function writeParams() {
    for (const k of ["speed", "hold", "stagger", "modalScale", "cardDist", "easing"]) form.elements[k].value = P[k];
    for (const k of ["touch", "camera", "loop", "reduced"]) form.elements[k].checked = P[k];
  }

  if (!EMBED) {
    playBtn.addEventListener("click", () => (playing ? pause() : play()));
    $("restartBtn").addEventListener("click", () => { setTime(0); play(); });
    let wasPlaying = false;
    scrub.addEventListener("pointerdown", () => { wasPlaying = playing; pause(); });
    scrub.addEventListener("input", () => setTime(+scrub.value));
    scrub.addEventListener("change", () => { if (wasPlaying) play(); wasPlaying = false; });
    $("settingsBtn").addEventListener("click", (ev) => {
      form.hidden = !form.hidden;
      ev.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    });
    form.addEventListener("input", () => { readParams(); rebuild(true); });
    form.addEventListener("reset", (ev) => {
      ev.preventDefault();
      Object.assign(P, DEFAULTS);
      writeParams();
      readParams();
      rebuild(true);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.target.closest("input, select, button")) return;
      if (ev.code === "Space") { ev.preventDefault(); playing ? pause() : play(); }
      else if (ev.key === "ArrowRight") setTime(time + (ev.shiftKey ? 5 : 1));
      else if (ev.key === "ArrowLeft") setTime(time - (ev.shiftKey ? 5 : 1));
      else if (ev.key.toLowerCase() === "r") { setTime(0); play(); }
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && playing && !raf && onScreen) { lastNow = null; raf = requestAnimationFrame(tick); }
  });
  if (EMBED && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen && playing && !raf) { lastNow = null; raf = requestAnimationFrame(tick); }
    }).observe(document.body);
  }

  // Small handle for the host page (and for iterating from devtools).
  window.stepstoneDemo = {
    play, pause, seek: setTime,
    get time() { return time; },
    get duration() { return D; },
    get scenes() { return SCENES.slice(); },
  };

  /* ═════════ Boot ═════════ */
  function start() {
    fit();
    if (!EMBED) writeParams();
    if (!EMBED) readParams();
    rebuild(false);
    phone.classList.add("is-ready");
    if (EMBED && P.reduced) {
      // Reduced motion in the portfolio card: a still of the payoff, no autoplay.
      setTime(END - 0.01);
    } else {
      play();
    }
  }
  // Layout must use final fonts before shared-element positions are measured.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  });
  if (document.fonts) {
    document.fonts.addEventListener?.("loadingdone", () => { if (phone.classList.contains("is-ready")) rebuild(true); });
  }
  prefersReduced.addEventListener?.("change", (ev) => {
    P.reduced = ev.matches;
    if (!EMBED) writeParams();
    rebuild(true);
  });
})();
