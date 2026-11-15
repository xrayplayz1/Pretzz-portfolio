/* Motion Lab — dependency-free, progressive enhancement for the public portfolio.
   All effects respect reduced-motion settings and leave /admin untouched. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (selector, base = document) => base.querySelector(selector);
  const $$ = (selector, base = document) => [...base.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  let motionOn = !reducedMotion.matches;
  let heroActivation = 0;
  let hasLoadedContent = false;
  let introPlayed = false;
  const disposers = [];

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    disposers.push(() => target.removeEventListener(name, callback, options));
  }

  function activateHeadlines() {
    if (!motionOn) return;
    ['#headline', '#headline-accent', '#contact-title'].forEach((selector) => {
      const target = $(selector);
      if (!target) return;
      const value = target.textContent.trim();
      if (!value) return;
      if (target.dataset.motionText === value) return;
      target.dataset.motionText = value;
      target.setAttribute('aria-label', value);
      target.classList.remove('motion-active');
      target.classList.add('motion-copy');
      target.replaceChildren();
      // Text nodes are used rather than HTML strings to keep edited content safe.
      value.split(/(\s+)/).forEach((segment, index) => {
        if (!segment) return;
        if (/^\s+$/.test(segment)) {
          target.append(document.createTextNode(segment));
          return;
        }
        const mask = document.createElement('span');
        const glyph = document.createElement('span');
        mask.className = 'motion-word';
        mask.setAttribute('aria-hidden', 'true');
        glyph.className = 'motion-word-inner';
        glyph.style.setProperty('--word-index', String(index));
        glyph.textContent = segment;
        mask.append(glyph);
        target.append(mask);
      });
    });
    if (introPlayed) revealHero();
  }

  function revealHero() {
    if (!motionOn) return;
    cancelAnimationFrame(heroActivation);
    $$('#headline, #headline-accent').forEach((heading) => heading?.classList.remove('motion-active'));
    heroActivation = requestAnimationFrame(() => {
      heroActivation = requestAnimationFrame(() => {
        $$('#headline, #headline-accent').forEach((heading) => heading?.classList.add('motion-active'));
        root.classList.add('motion-hero-visible');
      });
    });
  }

  function intro() {
    if (!motionOn) return;
    let alreadyPlayed = false;
    try {alreadyPlayed = sessionStorage.getItem('portfolio-motion-intro') === '1';} catch {}
    if (alreadyPlayed) {
      introPlayed = true;
      revealHero();
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'motion-loader';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="motion-loader-corner">M / L <span>STUDIO 2026</span></div>
      <div class="motion-loader-center"><span class="motion-loader-star">✳</span><span class="motion-loader-kicker">BUILDING SOMETHING DIFFERENT</span><strong>PIXELS.<br><em>PERSONALITY.</em></strong></div>
      <div class="motion-loader-bottom"><span>LOADING THE PLAYGROUND</span><div class="motion-loader-bar"><span></span></div><span class="motion-loader-count">000%</span></div>`;
    document.body.append(overlay);
    const counter = $('.motion-loader-count', overlay);
    const bar = $('.motion-loader-bar span', overlay);
    let startTime;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      introPlayed = true;
      try {sessionStorage.setItem('portfolio-motion-intro', '1');} catch {}
      overlay.classList.add('is-leaving');
      revealHero();
      setTimeout(() => overlay.remove(), 850);
    };
    const tick = (time) => {
      if (done || !motionOn) return finish();
      if (startTime === undefined) startTime = time;
      const t = clamp((time - startTime) / 1150, 0, 1);
      const progress = Math.round((1 - Math.pow(1 - t, 2.8)) * 100);
      counter.textContent = `${String(progress).padStart(3, '0')}%`;
      bar.style.transform = `scaleX(${progress / 100})`;
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(finish, 160);
    };
    requestAnimationFrame(tick);
    // The intro is decorative; do not trap focus or delay access to the site.
    listen(document, 'keydown', (event) => {if (event.key === 'Escape') finish();});
  }

  function addScrollProgress() {
    const progress = document.createElement('div');
    progress.className = 'motion-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.append(document.createElement('span'));
    document.body.prepend(progress);
    const bar = progress.firstElementChild;
    let pending = false;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      const percent = scrollable > 0 ? clamp(scrollY / scrollable, 0, 1) : 0;
      bar.style.transform = `scaleX(${percent})`;
      root.classList.toggle('motion-scrolled', scrollY > 28);
      pending = false;
    };
    const schedule = () => {if (!pending) {pending = true; requestAnimationFrame(update);}};
    listen(window, 'scroll', schedule, {passive: true});
    listen(window, 'resize', schedule, {passive: true});
    update();
  }

  function addMarquee() {
    const hero = $('.hero');
    if (!hero || $('.motion-marquee')) return;
    const section = document.createElement('div');
    section.className = 'motion-marquee';
    section.setAttribute('aria-hidden', 'true');
    const track = document.createElement('div');
    track.className = 'motion-marquee-track';
    for (let copy = 0; copy < 2; copy++) {
      const group = document.createElement('div');
      group.className = 'motion-marquee-group';
      for (const word of ['BUILD', 'PLAY', 'CREATE', 'REPEAT']) {
        const label = document.createElement('span');
        label.textContent = word;
        const symbol = document.createElement('i');
        symbol.textContent = '✳';
        group.append(label, symbol);
      }
      track.append(group);
    }
    section.append(track);
    hero.after(section);
  }

  function addSparks() {
    const visual = $('.hero-visual');
    if (!visual || $('.motion-spark', visual)) return;
    const stars = [[8,19],[20,49],[76,17],[87,47],[11,80],[36,12],[63,85],[91,78],[56,25],[41,73],[26,29],[73,60]];
    stars.forEach(([x,y],i) => {
      const spark = document.createElement('span');
      spark.className = 'motion-spark';
      spark.style.setProperty('--sx', `${x}%`);
      spark.style.setProperty('--sy', `${y}%`);
      spark.style.setProperty('--sd', `${(i*.33).toFixed(2)}s`);
      spark.style.setProperty('--ss', `${(1.7+(i%4)*.56).toFixed(2)}s`);
      visual.append(spark);
    });
    const halo = document.createElement('div');
    halo.className = 'motion-halo';
    visual.append(halo);
  }

  function pointerEffects() {
    if (!finePointer.matches || !motionOn) return;
    const halo = document.createElement('div');
    const dot = document.createElement('div');
    halo.className = 'motion-cursor-halo';
    dot.className = 'motion-cursor-dot';
    halo.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(halo, dot);
    let x = -100, y = -100, hx = -100, hy = -100, visible = false;
    let active = true;
    const follow = () => {
      if (!active || !motionOn) return;
      hx = lerp(hx, x, 0.16);
      hy = lerp(hy, y, 0.16);
      halo.style.transform = `translate3d(${hx}px,${hy}px,0) translate(-50%,-50%)`;
      dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
    listen(document, 'pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      if (!visible) {visible = true; halo.classList.add('shown');dot.classList.add('shown');}
      const over = !!event.target.closest('a, button, .project-media, .service-card, .skill-pill');
      halo.classList.toggle('is-hovering', over);
    }, {passive: true});
    listen(document, 'pointerleave', () => {halo.classList.remove('shown');dot.classList.remove('shown');visible=false;});
    disposers.push(() => {active = false; halo.remove(); dot.remove();});

    const hero = $('.hero-visual');
    if (hero) {
      listen(hero, 'pointermove', (event) => {
        const bounds = hero.getBoundingClientRect();
        const dx = clamp((event.clientX - bounds.left)/bounds.width - .5,-.5,.5);
        const dy = clamp((event.clientY - bounds.top)/bounds.height - .5,-.5,.5);
        hero.style.setProperty('--hero-ry', `${(dx * 7).toFixed(2)}deg`);
        hero.style.setProperty('--hero-rx', `${(-dy * 7).toFixed(2)}deg`);
        hero.style.setProperty('--hero-px', `${((dx+.5)*100).toFixed(1)}%`);
        hero.style.setProperty('--hero-py', `${((dy+.5)*100).toFixed(1)}%`);
      }, {passive:true});
      listen(hero, 'pointerleave', () => {
        hero.style.setProperty('--hero-ry','0deg');hero.style.setProperty('--hero-rx','0deg');
        hero.style.setProperty('--hero-px','50%');hero.style.setProperty('--hero-py','50%');
      });
    }
  }

  function interactiveElements() {
    // Delegation works with project/service cards injected asynchronously by the API.
    let activeSurface = null;
    listen(document, 'pointermove', (event) => {
      if (!finePointer.matches || !motionOn) return;
      const target = event.target.closest('.project-media, .service-card, .btn, .header-contact, .text-link, .contact-email, .back-top');
      if (activeSurface && activeSurface !== target) reset(activeSurface);
      activeSurface = target;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = clamp((event.clientX - rect.left)/rect.width - .5, -.5,.5);
      const dy = clamp((event.clientY - rect.top)/rect.height - .5, -.5,.5);
      if (target.matches('.project-media')) {
        target.style.setProperty('--card-ry',`${(dx*8).toFixed(2)}deg`);
        target.style.setProperty('--card-rx',`${(-dy*8).toFixed(2)}deg`);
        target.style.setProperty('--spot-x',`${((dx+.5)*100).toFixed(1)}%`);
        target.style.setProperty('--spot-y',`${((dy+.5)*100).toFixed(1)}%`);
      } else if (target.matches('.service-card')) {
        target.style.setProperty('--spot-x',`${((dx+.5)*100).toFixed(1)}%`);
        target.style.setProperty('--spot-y',`${((dy+.5)*100).toFixed(1)}%`);
      } else {
        target.style.setProperty('--mag-x', `${(dx * 11).toFixed(1)}px`);
        target.style.setProperty('--mag-y', `${(dy * 11).toFixed(1)}px`);
      }
    }, {passive:true});
    function reset(target) {
      target.style.removeProperty('--card-ry');target.style.removeProperty('--card-rx');
      target.style.removeProperty('--spot-x');target.style.removeProperty('--spot-y');
      target.style.removeProperty('--mag-x');target.style.removeProperty('--mag-y');
    }
    listen(document, 'pointerout', (event) => {
      if (activeSurface && !activeSurface.contains(event.relatedTarget)) {
        reset(activeSurface);activeSurface = null;
      }
    }, {passive:true});
    listen(document, 'click', (event) => {
      if (!motionOn) return;
      const button = event.target.closest('.btn, .contact-email, .project-arrow, .header-contact');
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'motion-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      button.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), {once:true});
    });
  }

  function observeStats() {
    const stats = $('#stats');
    if (!stats || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        $$('.about-stat strong', entry.target).forEach((node) => {
          const original = node.textContent.trim();
          const match = original.match(/^(\d+)(.*)$/);
          if (!match || !motionOn) return;
          const target = Number(match[1]), suffix = match[2];
          if (target > 10000) return;
          let t0;
          const run = (time) => {
            if (!motionOn) {node.textContent=original;return;}
            if (!t0) t0=time;
            const t = clamp((time-t0)/1000,0,1);
            node.textContent = `${Math.round(target*(1-(1-t)**4))}${suffix}`;
            if (t < 1) requestAnimationFrame(run);
            else node.textContent = original;
          };
          requestAnimationFrame(run);
        });
      }
    }, {threshold: .4});
    observer.observe(stats);
    disposers.push(() => observer.disconnect());
  }

  function observeContact() {
    const contact = $('.contact-inner');
    const title = $('#contact-title');
    if (!contact || !title || !('IntersectionObserver' in window)) { title?.classList.add('motion-active'); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(item => item.isIntersecting)) {
        title.classList.add('motion-active');
        observer.disconnect();
      }
    }, {threshold:.13});
    observer.observe(contact);
    disposers.push(() => observer.disconnect());
  }

  function contentReady() {
    hasLoadedContent = true;
    if (!motionOn) return;
    activateHeadlines();
    // The server can update projects, services and skills; every new card gets a slight cascading delay.
    $$('.project-card').forEach((node,i) => node.style.setProperty('--motion-delay',`${Math.min(i % 3 * .1,.3)}s`));
    $$('.service-card').forEach((node,i) => node.style.setProperty('--motion-delay',`${Math.min(i * .11,.45)}s`));
    $$('.skill-pill').forEach((node,i) => node.style.setProperty('--pill-delay',`${Math.min(i*.055,.6)}s`));
    observeStats();
    observeContact();
  }

  function disableEffects() {
    motionOn = false;
    root.classList.remove('motion-enabled');
    root.classList.add('motion-hero-visible');
    $$('.motion-copy').forEach(el => {el.classList.add('motion-active');});
    $('.motion-loader')?.remove();
    $('.motion-cursor-halo')?.remove();$('.motion-cursor-dot')?.remove();
  }

  function init() {
    addScrollProgress();
    addMarquee();
    if (!motionOn) return;
    root.classList.add('motion-enabled');
    activateHeadlines();
    addSparks();
    intro();
    pointerEffects();
    interactiveElements();
    if (hasLoadedContent) contentReady();
  }

  listen(window, 'portfolio:rendered', contentReady);
  listen(reducedMotion, 'change', () => {
    if (reducedMotion.matches) disableEffects();
    else window.location.reload(); // Recreate the visual layers cleanly when animations are re-enabled.
  });
  if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', init, {once:true});
  else init();
})();
