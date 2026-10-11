// Renders each page from the files in /data. Lab members edit those files through the
// admin page (Pages CMS) — no code changes needed to add people, papers or news.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = name => fetch('data/' + name + '.json', { cache: 'no-cache' }).then(r => r.json());
  const main = document.querySelector('main[data-page]');
  if (!main) return;
  const page = main.dataset.page;
  const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const anchor = p => (p.date + '-' + p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fill = (sel, html) => { const el = main.querySelector(sel); if (el) el.innerHTML = html; };

  // ---------- People ----------
  const TIERS = ['Principal Investigator', 'Postdoc', 'Graduate Student', 'Staff & Students'];
  const STAFF_ORDER = [/technician/i, /research assistant/i, /co-op/i, /./];   // techs first in the last tier
  const CARD = { 'Principal Investigator': 300, 'Postdoc': 260, 'Graduate Student': 260 }, GAP = 34;
  const ALUM_GROUPS = [
    ['Postdocs', r => /postdoc/i.test(r)],
    ['Staff Researchers', r => /staff|research associate/i.test(r)],
    ['Graduate Students', r => /phd|ms student/i.test(r)],
    ['Research Technicians & Assistants', r => /technician|research assistant/i.test(r)],
    ['Co-Op, Summer & Undergraduate Students', r => true],
  ];
  const lastName = n => n.replace(/,.*$/, '').trim().split(/\s+/).pop();
  const initials = n => n.replace(/,.*$/, '').split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).slice(0, 2).join('');
  // even rows: fewest empty slots (4 people -> 2x2, not 3 + 1)
  function evenCols(n, max) { if (n <= max) return n; let best = max;
    for (let c = max; c >= 2; c--) if ((c - n % c) % c < (best - n % best) % best) best = c; return best; }

  function card(p) {
    const photo = p.photo
      ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` + (p.hover_photo ? `<img class="hover" src="${esc(p.hover_photo)}" alt="" loading="lazy">` : '')
      : `<span class="initials" aria-hidden="true">${esc(initials(p.name))}</span>`;
    const awards = (p.awards || []).filter(Boolean);
    return `<article class="person">
      <div class="photo${p.hover_photo ? ' swap' : ''}">${photo}</div>
      <div class="name">${esc(p.name)}</div>
      ${p.title ? `<div class="title">${esc(p.title)}</div>` : ''}
      ${p.email ? `<div class="email">${esc(p.email)}</div>` : ''}
      ${p.scholar ? `<a class="scholar" href="${esc(p.scholar)}" target="_blank" rel="noopener">${/scholar\.google/.test(p.scholar) ? 'Google Scholar' : 'Profile'}</a>` : ''}
      ${awards.length ? `<ul class="awards">${awards.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }

  function renderPeople(d) {
    const cls = { 'Principal Investigator': 'pi', 'Postdoc': 'postdocs', 'Graduate Student': 'grads', 'Staff & Students': 'staff' };
    let html = TIERS.map(t => {
      let ppl = d.current.filter(p => (p.tier || 'Staff & Students') === t);
      if (t === 'Staff & Students') ppl = ppl.map((p, i) => [STAFF_ORDER.findIndex(r => r.test(p.title || '')), i, p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
      if (!ppl.length) return '';
      const w = CARD[t] ? ` style="max-width:${evenCols(ppl.length, 3) * (CARD[t] + GAP)}px"` : '';
      return `<section class="tier ${cls[t]}" aria-label="${esc(t)}"><div class="grid"${w}>${ppl.map(card).join('')}</div></section>`;
    }).join('');
    const used = new Set();
    const groups = ALUM_GROUPS.map(([label, test]) => {
      const rows = d.alumni.filter(a => !used.has(a) && test(a.role || ''));
      rows.forEach(a => used.add(a));
      rows.sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));
      return rows.length ? `<h3 class="alum-group">${label}</h3><ul class="alumni">${rows.map(a =>
        `<li><b>${esc(a.name)}</b>, <span class="role">${esc(a.role)}</span></li>`).join('')}</ul>` : '';
    }).join('');
    html += `<section class="tier alum"><h2>Previous Lab Members / Alumni</h2>${groups}</section>`;
    main.innerHTML = html;
    main.addEventListener('click', e => { const c = e.target.closest('.person');
      if (c && c.querySelector('img.hover') && !e.target.closest('a')) c.classList.toggle('flip'); });
  }

  // ---------- Publications ----------
  function renderPubs(d) {
    const byYear = {};
    d.papers.forEach(p => (byYear[p.year] = byYear[p.year] || []).push(p));
    fill('.pub-list', Object.keys(byYear).sort((a, b) => b - a).map(y =>
      `<section class="pub-year"><h2>${esc(y)}</h2><ol>${byYear[y].map(p =>
        `<li>${esc(p.citation).replace(/(Andermann,?\s*M\.?\s?L\.?)/g, '<strong>$1</strong>')}${p.link ? ` <a class="doi" href="${esc(p.link)}" target="_blank" rel="noopener">Paper</a>` : ''}</li>`).join('')}</ol></section>`).join(''));
  }

  // ---------- News ----------
  function renderNews(d) {
    const posts = [...d.posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    fill('.post-list', posts.map(p => {
      const pics = (p.photos || []).filter(Boolean);
      const gallery = pics.length ? `<div class="gallery n${Math.min(pics.length, 4)}">${pics.map(s => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</div>` : '';
      return `<article class="post" id="${anchor(p)}"><time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
        <h2>${esc(p.title)}</h2>${p.text ? `<p>${esc(p.text)}</p>` : ''}${gallery}
        ${p.link ? `<a class="doi" href="${esc(p.link)}" target="_blank" rel="noopener">Read the paper</a>` : ''}</article>`;
    }).join(''));
  }

  // ---------- Home / Research / Contact ----------
  function renderSite(s) {
    if (page === 'home') {
      fill('.thesis', `<a href="research.html">${esc(s.tagline)}</a>`);
      fill('.lede', esc(s.home_intro));
    }
    if (page === 'research') {
      fill('.subtitle', esc(s.research_title));
      fill('.prose', (s.research_paragraphs || []).map(p => `<p>${esc(p)}</p>`).join(''));
    }
    if (page === 'contact') {
      fill('.c-name', esc(s.contact_name)); fill('.c-title', esc(s.contact_title));
      fill('.c-reach', `${esc(s.contact_email)}<br>${esc(s.contact_phone)}`);
      fill('.c-address', esc(s.address).replace(/\n/g, '<br>'));
    }
  }

  const fail = () => { main.insertAdjacentHTML('beforeend', '<p class="subtitle">This section could not load. Refresh the page to try again.</p>'); };
  if (page === 'people') load('people').then(renderPeople).catch(fail);
  else if (page === 'publications') load('publications').then(renderPubs).catch(fail);
  else if (page === 'news') load('news').then(renderNews).catch(fail);
  else load('site').then(s => renderSite(s)).catch(fail);
})();
