// Loading bar + page transition helpers
const Progress = (() => {
  let el, bar, timer, value = 0, visible = false;
  function ensure(){
    if (el) return;
    el = document.createElement('div');
    el.className = 'progress';
    bar = document.createElement('div');
    bar.className = 'bar';
    el.appendChild(bar);
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
    // If body already available (defer scripts), append immediately
    if (document.body) document.body.appendChild(el);
  }
  function set(n){
    ensure();
    value = Math.max(0, Math.min(100, n));
    bar.style.width = value + '%';
    if (!visible){ el.classList.add('show'); visible = true; }
  }
  function start(){
    clearInterval(timer);
    set(2);
    timer = setInterval(() => {
      const next = value + Math.random()*5 + 3; // trickle
      set(Math.min(90, next));
      if (value >= 90) { clearInterval(timer); }
    }, 300);
  }
  function done(){
    clearInterval(timer);
    set(100);
    setTimeout(() => { if (el){ el.classList.remove('show'); bar.style.width = '0%'; visible=false; value=0; } }, 300);
  }
  return { start, set, done };
})();

// Start progress early on load
try { Progress.start(); } catch {}

// Page transition helpers (fade in/out)
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function navigateWithTransition(url){
  if (!url) return;
  if (prefersReducedMotion) { window.location.href = url; return; }
  try { Progress.start(); } catch {}
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, 220);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!prefersReducedMotion) {
    requestAnimationFrame(() => document.body.classList.add('page-loaded'));
  }
  try { Progress.done(); } catch {}
});

// Intercept internal link clicks for smooth exit
document.addEventListener('click', (e) => {
  if (prefersReducedMotion) return;
  const a = e.target.closest && e.target.closest('a');
  if (!a) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
  const dest = new URL(a.href, window.location.href);
  if (dest.origin !== window.location.origin) return; // external link
  e.preventDefault();
  navigateWithTransition(dest.href);
});

// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const mobilePanel = document.getElementById('mobilePanel');
hamburger?.addEventListener('click', () => {
  const open = mobilePanel.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(open));
  mobilePanel.setAttribute('aria-hidden', String(!open));
});

// Back to top + header logo pop-in on downward scroll
const backTop = document.getElementById('backTop');
const header = document.querySelector('header');
const showAt = 300;
let lastY = 0;
const logoThreshold = 50;
window.addEventListener('scroll', () => {
  const y = window.scrollY || document.documentElement.scrollTop;
  backTop?.classList.toggle('show', y > showAt);

  if (header) {
    const down = y > lastY;
    if (down && y > logoThreshold) {
      header.classList.add('scrolled'); // show nav logo with pop-in
    } else if (!down || y <= logoThreshold) {
      header.classList.remove('scrolled'); // hide when scrolling up or near top
    }
  }
  lastY = y;
});
backTop?.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));

// Current year in footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Keep header unchanged on scroll (no 'scrolled' class toggling)

(() => {
  const form = document.querySelector('.search-form');
  if (!form) return;
  const input = form.querySelector('input[name="q"]');
  if (!input) return;

  // Page routes with keywords for fuzzy matching
  const routes = [
    { label: 'Home', url: 'homepage.html', keywords: ['home','homepage','main'] },
    { label: 'About', url: 'pages/about.html', keywords: ['about','history','mission','vision','university'] },
    { label: 'Academic Programs', url: 'pages/programs.html', keywords: ['program','programs','course','courses','curriculum','degree','bscs','bsit'] },
    { label: 'Admissions', url: 'pages/admission_guide.html', keywords: ['admission','admissions','enroll','enrollment','requirements','apply','application'] },
    { label: 'Student Services', url: 'pages/services.html', keywords: ['service','services','scholarship','guidance','library','clinic','student services'] },
    { label: 'Events', url: 'pages/event.html', keywords: ['event','events','calendar','schedule'] },
    { label: 'Contact', url: 'pages/contact.html', keywords: ['contact','email','phone','address','location'] },
  ];

  // Suggestion dropdown container
  const box = document.createElement('div');
  box.className = 'search-suggest';
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', 'Search suggestions');
  form.appendChild(box);

  let open = false;
  let activeIndex = -1;
  let current = [];
  let onPageCache = null; // cache of on-page candidates
  let lastQuery = '';

  // --- Fuzzy matching helpers (typo tolerant) ---
  const norm = (s) => (s || '').toLowerCase().trim();

  // Subsequence match: allows missing letters but in order. Returns positions if full subsequence matches.
  function subseqPositions(query, text) {
    const q = norm(query), t = norm(text);
    let ti = 0; const pos = [];
    for (let qi = 0; qi < q.length; qi++) {
      const ch = q[qi];
      let found = false;
      while (ti < t.length) {
        if (t[ti] === ch) { pos.push(ti); ti++; found = true; break; }
        ti++;
      }
      if (!found) return null;
    }
    return pos;
  }

  // Limited Levenshtein: early-exit if distance > maxDist
  function levenshteinWithin(a, b, maxDist = 2) {
    a = norm(a); b = norm(b);
    if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
    const prev = new Array(b.length + 1).fill(0);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let minInRow = Infinity;
      let curr = new Array(b.length + 1);
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost
        );
        if (curr[j] < minInRow) minInRow = curr[j];
      }
      if (minInRow > maxDist) return maxDist + 1; // early exit
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
  }

  // Score a candidate against query; returns {score, positions}
  function scoreCandidate(query, label, keywords) {
    const q = norm(query);
    const l = norm(label);
    if (!q) return { score: 0, positions: [] };

    // Exact/prefix/substring bonuses
    if (l === q) return { score: 1.0, positions: [...Array(q.length).keys()] };
    if (l.startsWith(q)) return { score: 0.9, positions: Array.from({length:q.length}, (_,i)=>i) };
    const idx = l.indexOf(q);
    if (idx !== -1) return { score: 0.8, positions: Array.from({length:q.length}, (_,i)=>idx+i) };

    // Subsequence (letters in order, possibly missing)
    const pos = subseqPositions(q, l);
    if (pos) {
      const span = pos[pos.length - 1] - pos[0] + 1;
      const density = pos.length / Math.max(1, span);
      const score = 0.55 + Math.min(0.35, density * 0.35); // up to ~0.9
      return { score, positions: pos };
    }

    // Edit distance against label and keywords
    let best = Infinity;
    best = Math.min(best, levenshteinWithin(q, l, 2));
    for (const k of (keywords || [])) best = Math.min(best, levenshteinWithin(q, k, 2));
    if (best <= 2) {
      // Map distance 0..2 to score 0.85..0.65
      return { score: 0.85 - best * 0.1, positions: [] };
    }

    // No good match
    return { score: 0, positions: [] };
  }

  function highlightLabel(label, positions) {
    if (!positions || !positions.length) return escapeHtml(label);
    const chars = label.split("");
    const set = new Set(positions);
    let out = '';
    let open = false;
    for (let i = 0; i < chars.length; i++) {
      const is = set.has(i);
      if (is && !open) { out += '<mark>'; open = true; }
      if (!is && open) { out += '</mark>'; open = false; }
      out += escapeHtml(chars[i]);
    }
    if (open) out += '</mark>';
    return out;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildOnPageCandidates() {
    if (onPageCache) return onPageCache;
    const out = [];
    // IDs
    document.querySelectorAll('[id]').forEach(el => {
      const id = el.id?.trim();
      if (id && id.length > 1) out.push({ type: 'anchor', label: id.replace(/[-_]/g, ' '), el });
    });
    // Headings text
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      const txt = h.textContent?.trim();
      if (txt) out.push({ type: 'anchor', label: txt, el: h });
    });
    onPageCache = out;
    return out;
  }

  function render(list) {
    current = list;
    activeIndex = list.length ? 0 : -1;
    if (!list.length) {
      hide();
      return;
    }
    const html = list.map((s, i) => `
      <div class="item${i===activeIndex?' active':''}" role="option" aria-selected="${i===activeIndex}">
        <span class="label">${highlightLabel(s.label, s.positions)}</span>
        <span class="badge">${s.type === 'page' ? 'Page' : 'On this page'}</span>
      </div>
    `).join('');
    box.innerHTML = html;
    box.classList.add('open');
    open = true;
  }

  function hide() {
    box.classList.remove('open');
    box.innerHTML = '';
    open = false;
    activeIndex = -1;
  }

  function choose(index) {
    const sel = current[index];
    if (!sel) return;
    if (sel.type === 'page') {
      navigateWithTransition(sel.url);
    } else if (sel.type === 'anchor' && sel.el) {
      sel.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sel.type === 'site') {
      const q = encodeURIComponent(sel.query || lastQuery || input.value || '');
      if (q) {
        const inPages = location.pathname.includes('/pages/');
        const searchPath = inPages ? 'search.html' : 'pages/search.html';
        navigateWithTransition(`${searchPath}?q=${q}`);
      }
    }
    hide();
  }

  function computeSuggestions(q) {
    const query = norm(q);
    lastQuery = query;
    const results = [];

    // Pages
    for (const r of routes) {
      const { score, positions } = scoreCandidate(query, r.label, r.keywords);
      if (score > 0.55) results.push({ type: 'page', label: r.label, url: r.url, score, positions });
    }

    // On page
    const anchors = buildOnPageCandidates();
    for (const a of anchors) {
      const { score, positions } = scoreCandidate(query, a.label);
      if (score > 0.55) results.push({ ...a, score, positions });
    }

    // If nothing matches and query is not empty, relax threshold a bit
    if (!results.length && query) {
      for (const r of routes) {
        const { score, positions } = scoreCandidate(query, r.label, r.keywords);
        if (score > 0.4) results.push({ type: 'page', label: r.label, url: r.url, score, positions });
      }
    }

    results.sort((a, b) => (b.score - a.score) || ((a.type === 'page') ? -1 : 1));
    const top = results.slice(0, 7);
    // Always provide a fallback site-search option when user has typed something
    if (query) {
      top.push({ type: 'site', label: `Search site for "${q}"`, query, positions: [] });
    }
    return top;
  }

  // Mouse selection (use mousedown to run before blur)
  box.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.item');
    if (!item) return;
    const idx = Array.from(box.children).indexOf(item);
    e.preventDefault();
    choose(idx);
  });

  input.addEventListener('input', () => {
    const list = computeSuggestions(input.value);
    render(list);
  });

  input.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % current.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + current.length) % current.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(activeIndex);
      return;
    } else if (e.key === 'Escape') {
      hide();
      return;
    } else {
      return; // other keys handled by input event
    }
    // re-render active state only
    Array.from(box.children).forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
      el.setAttribute('aria-selected', String(i === activeIndex));
    });
  });

  input.addEventListener('focus', () => {
    const list = computeSuggestions(input.value);
    render(list);
  });

  input.addEventListener('blur', () => {
    // Delay hiding to allow click via mousedown
    setTimeout(hide, 100);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // If suggestions are open and a selection exists, choose it
    if (open && activeIndex >= 0) {
      choose(activeIndex);
      return;
    }
    const raw = (this.q?.value || '').trim();
    if (!raw) return;
    const query = norm(raw);

    // Use best suggestion if available
    const best = computeSuggestions(query)[0];
    if (best) {
      if (best.type === 'page') navigateWithTransition(best.url);
      else if (best.type === 'anchor' && best.el) best.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      hide();
      return;
    }

    alert('No results found for: ' + raw);
  });
})();

// Fix common encoding issues for "Biñan" across pages
document.addEventListener('DOMContentLoaded', () => {
  try {
    const replaceTo = 'Biñan';
    const patterns = [
      /Bi\uFFFDan/gi, // Bi�an shown due to replacement char
      /Bi\?an/gi,     // Bi?an variant
      /\bBinan\b/gi   // Unaccented Binan (but avoid emails separately)
    ];

    const shouldSkip = (text) => text.includes('@') || text.includes('mailto:');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let t = node.nodeValue;
      if (!t || shouldSkip(t)) return;
      patterns.forEach(p => { t = t.replace(p, replaceTo); });
      if (t !== node.nodeValue) node.nodeValue = t;
    });

    // Also fix document.title
    if (document.title) {
      let t = document.title;
      patterns.forEach(p => { t = t.replace(p, replaceTo); });
      document.title = t;
    }
    // And meta description
    const meta = document.querySelector('meta[name="description"]');
    if (meta && meta.content) {
      let c = meta.content;
      if (!shouldSkip(c)) {
        patterns.forEach(p => { c = c.replace(p, replaceTo); });
        meta.content = c;
      }
    }
  } catch { /* no-op */ }
});

// Example: dynamically set calendar timezone if needed
// const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
// const cal = document.getElementById('calendarFrame');
// if (cal && !cal.src.includes('ctz=')) cal.src += (cal.src.includes('?')?'&':'?') + 'ctz=' + encodeURIComponent(tz);
