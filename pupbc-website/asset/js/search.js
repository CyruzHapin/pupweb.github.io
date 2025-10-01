(() => {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim();
  const input = document.getElementById('q');
  if (input) input.value = q;

  const status = document.getElementById('status');
  const resultsEl = document.getElementById('results');

  const PAGES = [
    { url: '../homepage.html', title: 'Home' },
    { url: 'about.html', title: 'About' },
    { url: 'programs.html', title: 'Academic Programs' },
    { url: 'admission_guide.html', title: 'Admissions' },
    { url: 'services.html', title: 'Student Services' },
    { url: 'event.html', title: 'Events' },
    { url: 'contact.html', title: 'Contact' },
    { url: 'announcement.html', title: 'Announcements' },
    { url: 'faq.html', title: 'FAQ' },
    { url: 'campuslife.html', title: 'Campus Life' },
    { url: 'downloadform.html', title: 'Downloadable Forms' },
  ];

  const norm = (s) => (s || '').toLowerCase();

  // Simple fuzzy score similar to homepage.js
  function score(query, text) {
    const qn = norm(query);
    const tn = norm(text);
    if (!qn || !tn) return 0;
    if (tn === qn) return 1.0;
    if (tn.startsWith(qn)) return 0.95;
    const idx = tn.indexOf(qn);
    if (idx !== -1) return 0.85;
    // subsequence
    let ti = 0; let matched = 0;
    for (let i = 0; i < qn.length; i++) {
      const ch = qn[i];
      while (ti < tn.length && tn[ti] !== ch) ti++;
      if (ti < tn.length) { matched++; ti++; } else break;
    }
    if (matched / qn.length > 0.6) return 0.7;
    return 0;
  }

  function strip(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      text.slice(0, idx) +
      '<mark>' + text.slice(idx, idx + query.length) + '</mark>' +
      text.slice(idx + query.length)
    );
  }

  async function run() {
    if (!q) {
      status.textContent = 'Type a keyword to search the site.';
      return;
    }
    status.textContent = 'Searching…'; try { window.Progress?.start(); } catch {}

    const items = await Promise.all(PAGES.map(async (p) => {
      try {
        const res = await fetch(p.url, { cache: 'no-store' });
        const html = await res.text();
        const text = strip(html).replace(/\s+/g, ' ').trim();
        const sTitle = score(q, p.title);
        const sBody = score(q, text);
        const s = Math.max(sTitle, sBody);
        if (s <= 0) return null;
        // Make snippet
        const idx = text.toLowerCase().indexOf(q.toLowerCase());
        let snippet = '';
        if (idx !== -1) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(text.length, idx + 80);
          snippet = (start>0?'…':'') + text.slice(start, end) + (end<text.length?'…':'');
        } else {
          snippet = text.slice(0, 160) + (text.length>160?'…':'');
        }
        return {
          url: p.url,
          title: p.title,
          snippet,
          score: s
        };
      } catch (e) {
        return null;
      }
    }));

    const results = items.filter(Boolean).sort((a,b)=>b.score-a.score).slice(0, 20);
    status.textContent = results.length ? '' : 'No results found.'; try { window.Progress?.done(); } catch {}
    resultsEl.innerHTML = results.map(r => `
      <article class="result">
        <h3><a href="${r.url}">${r.title}</a></h3>
        <small>${r.url}</small>
        <p class="snippet">${highlight(r.snippet, q)}</p>
      </article>
    `).join('');
  }

  run();

  // Allow re-search from the input
  document.querySelector('.search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (document.getElementById('q')?.value || '').trim();
    if (!val) return;
    const url = `search.html?q=${encodeURIComponent(val)}`;
    if (typeof navigateWithTransition === 'function') navigateWithTransition(url);
    else location.href = url;
  });
})();



