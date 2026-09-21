// Auto-update the footer year so it never goes stale.
document.getElementById("year").textContent = new Date().getFullYear();

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
