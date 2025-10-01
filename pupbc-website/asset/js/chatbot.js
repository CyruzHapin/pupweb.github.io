// Simple FAQ Chatbot (client-side, no external services)
(function(){
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }

  function norm(s){ return (s||'').toLowerCase().trim(); }

  function createEl(tag, cls, html){ const el = document.createElement(tag); if(cls) el.className = cls; if(html!=null) el.innerHTML = html; return el; }

  function buildWidget(faqs){
    const toggle = createEl('button', 'bot-toggle', '<span aria-hidden="true">💬</span><span class="label">FAQ</span>');
    toggle.type = 'button'; toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-expanded', 'false');

    const panel = createEl('div', 'bot-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'FAQ Chat'); panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = ''+
      '<div class="bot-head">'+
        '<div class="t">FAQ Assistant</div>'+
        '<button class="x" aria-label="Close">×</button>'+
      '</div>'+
      '<div class="bot-body" id="botBody" aria-live="polite"></div>'+
      '<form class="bot-bar" id="botForm" autocomplete="off">'+
        '<input type="text" id="botInput" placeholder="Ask a question..." aria-label="Type your question" />'+
        '<button class="send" aria-label="Send">↩</button>'+
      '</form>';

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const body = panel.querySelector('#botBody');
    const form = panel.querySelector('#botForm');
    const input = panel.querySelector('#botInput');
    const closeBtn = panel.querySelector('.bot-head .x');

    function open(){ panel.classList.add('open'); toggle.setAttribute('aria-expanded','true'); input.focus(); }
    function close(){ panel.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.focus(); }

    toggle.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
    closeBtn.addEventListener('click', close);

    function addMsg(text, who){ const m = createEl('div', who==='user'?'msg user':'msg bot'); m.innerHTML = text; body.appendChild(m); body.scrollTop = body.scrollHeight; }

    function suggest(questions){
      if(!questions || !questions.length) return;
      const wrap = createEl('div', 'suggest');
      questions.slice(0,3).forEach(q => {
        const b = createEl('button', 'pill', q.q);
        b.type='button';
        b.addEventListener('click', () => { input.value = q.q; input.focus(); });
        wrap.appendChild(b);
      });
      body.appendChild(wrap); body.scrollTop = body.scrollHeight;
    }

    function match(query){
      const q = norm(query);
      if(!q) return null;
      let scored = faqs.map(item => {
        const lq = norm(item.q), la = norm(item.a);
        let score = 0;
        if(lq===q) score = 1.0;
        else if(lq.startsWith(q)) score = 0.9;
        else if(lq.includes(q)) score = 0.8;
        else if(la.includes(q)) score = 0.6;
        else {
          // very light-weight subsequence match
          let ti = 0, hit=0; for(let i=0;i<q.length && ti<lq.length;i++){ const ch=q[i]; while(ti<lq.length && lq[ti]!==ch) ti++; if(ti<lq.length){ hit++; ti++; } }
          if(hit>=Math.max(2, Math.floor(q.length*0.6))) score = 0.55;
        }
        return { item:item, score };
      });
      scored.sort((a,b)=>b.score-a.score);
      const top = scored[0];
      if(!top || top.score < 0.55) return { best:null, alts: scored.filter(s=>s.score>0.4).slice(0,3).map(s=>s.item) };
      return { best: top.item, alts: scored.slice(1,4).map(s=>s.item) };
    }

    function reply(text){
      const res = match(text);
      if(res && res.best){
        addMsg('<b>'+res.best.q+'</b><br>'+res.best.a, 'bot');
        if(res.alts && res.alts.length){
          const t = res.alts.map(x=>x.q);
          addMsg('Related questions:', 'bot');
          suggest(res.alts);
        }
      } else {
        addMsg("Sorry, I couldn't find an exact answer. Try one of these:", 'bot');
        suggest((res && res.alts && res.alts.length)? res.alts : faqs.slice(0,3));
      }
    }

    // Greeting with top suggestions
    addMsg('Hi! Ask me about admissions, requirements, office hours, forms, or anything on this page.', 'bot');
    suggest(faqs.slice(0,3));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if(!q) return;
      addMsg(q, 'user');
      input.value='';
      setTimeout(()=> reply(q), 150);
    });
  }

  ready(async () => {
    try{
      // 1) Try to collect FAQs from this page
      const items = Array.from(document.querySelectorAll('[data-faq] .faq-item'));
      let faqs = items.map(el => ({
        q: (el.querySelector('.q')?.textContent || '').trim(),
        a: (el.querySelector('.a')?.innerHTML || '').trim()
      })).filter(x => x.q && x.a);

      // 2) If none found, try to fetch the FAQ page and parse
      if(!faqs.length){
        const candidates = ['pages/faq.html','../pages/faq.html','./pages/faq.html'];
        for(const url of candidates){
          try{
            const res = await fetch(url, { credentials:'same-origin' });
            if(!res.ok) continue;
            const html = await res.text();
            const dom = new DOMParser().parseFromString(html, 'text/html');
            const els = Array.from(dom.querySelectorAll('[data-faq] .faq-item'));
            faqs = els.map(el => ({
              q: (el.querySelector('.q')?.textContent || '').trim(),
              a: (el.querySelector('.a')?.innerHTML || '').trim()
            })).filter(x => x.q && x.a);
            if(faqs.length) break;
          }catch{};
        }
      }

      if(!faqs.length) return; // No FAQ source available; don't attach widget
      buildWidget(faqs);
    }catch(err){ console.warn('Chatbot init failed:', err); }
  });
})();
