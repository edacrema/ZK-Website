/* ══════════════════════════════════════════════════
   ZETAKAPPA FUTURES — Global JavaScript
   ══════════════════════════════════════════════════ */

/* ── INCLUDE LOADER ── */
(async function loadIncludes() {
  const slots = [
    { id: 'nav-slot', file: 'includes/nav.html' },
    { id: 'footer-slot', file: 'includes/footer.html' }
  ];
  for (const { id, file } of slots) {
    const el = document.getElementById(id);
    if (!el) continue;
    try {
      const res = await fetch(file);
      if (res.ok) {
        el.innerHTML = await res.text();
        el.style.display = 'contents';
      }
    } catch (e) {
      // Silently fail — nav/footer just won't load (file:// protocol)
    }
  }

  // After includes loaded, initialize nav and language
  initNav();
  initLang();
  initObserver();
  initMobileMenu();
  markActiveNav();
})();

/* ── NAV SCROLL ── */
function initNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('sc', scrollY > 40);
  });
  // Apply immediately if already scrolled
  if (scrollY > 40) nav.classList.add('sc');
}

/* ── LANGUAGE SYSTEM ── */
function initLang() {
  var stored = localStorage.getItem('zkLang');
  if (!stored) {
    // Auto-detect from domain: .com → English, everything else → Italian
    var host = window.location.hostname;
    stored = (host.indexOf('zetakappa.com') !== -1) ? 'en' : 'it';
  }
  applyLang(stored);
}

function setLang(lang) {
  applyLang(lang);
  localStorage.setItem('zkLang', lang);
}

function applyLang(lang) {
  const body = document.body;
  const html = document.documentElement;

  if (lang === 'en') {
    body.classList.add('en');
    html.lang = 'en';
  } else {
    body.classList.remove('en');
    html.lang = 'it';
  }

  // Update toggle buttons (may be in includes, so query each time)
  document.querySelectorAll('.lbtn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.lang === lang);
  });
}

// Expose globally for onclick handlers
window.setLang = setLang;

/* ── INTERSECTION OBSERVER ── */
function initObserver() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('vis');
        obs.unobserve(e.target); // one-shot
      }
    });
  }, { threshold: .1 });
  document.querySelectorAll('.fu').forEach(el => obs.observe(el));
}

/* ── MOBILE MENU ── */
function initMobileMenu() {
  const btn = document.querySelector('.hamburger');
  const overlay = document.querySelector('.mobile-nav');
  if (!btn || !overlay) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    overlay.classList.toggle('open');
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  });

  // Close on link click
  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      btn.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

/* ── ACTIVE NAV LINK ── */
function markActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll('.nav-a, .mobile-nav a').forEach(a => {
    if (a.dataset.nav === page) a.classList.add('active');
  });
}
