/* Granule Cell Quiz — vanilla JS, no build step. Data comes from data.js (window.QUIZ). */
(function () {
  'use strict';
  const D = window.QUIZ;
  const TOPICS = D.topics;
  const T = Object.fromEntries(TOPICS.map(t => [t.id, t]));
  const QS = D.questions;
  const Q = Object.fromEntries(QS.map(q => [q.id, q]));
  const P = D.papers;
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.setAttribute('style', v);
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- persistence (per browser; fails safe) ---------- */
  const KEY = 'gcquiz.v1';
  let store = { stats: {}, prefs: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.stats) store = s; } catch (e) { /* private mode etc. */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } };
  const stat = id => store.stats[id] || { n: 0, c: 0, last: null };
  const record = (id, ok) => {
    const s = stat(id); s.n++; if (ok) s.c++; s.last = ok ? 1 : 0; s.t = Date.now();
    store.stats[id] = s; save();
  };

  /* ---------- settings ---------- */
  const prefs = Object.assign({ topics: TOPICS.map(t => t.id), type: 'all', diffs: [1, 2, 3], len: '10', pool: 'all' }, store.prefs);
  const savePrefs = () => { store.prefs = prefs; save(); };

  /* ---------- helpers ---------- */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const topicStyle = id => `--tc: var(--t-${id})`;
  const dots = d => '●'.repeat(d) + '○'.repeat(3 - d);
  const diffName = d => ['', 'Core', 'Key finding', 'Detailed'][d];
  const typeName = t => t === 'predict' ? 'Predict the result' : 'Concept check';
  const short = k => { const p = P[k]; return p ? `${p.author} ${p.year}` : k; };
  const zoteroLink = k => `zotero://select/library/items/${k}`;
  const doiLink = k => P[k] && P[k].doi ? `https://doi.org/${P[k].doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(P[k] ? P[k].title : k)}`;

  function citeNode(k, fig) {
    const p = P[k];
    return el('div', { class: 'cite' },
      fig ? el('b', {}, `${short(k)}, ${fig.label}. `) : null,
      el('span', { class: 'ttl' }, p.title + '. '),
      el('i', {}, p.journal || ''), p.journal ? '. ' : '',
      el('span', { class: 'links' },
        el('a', { href: doiLink(k), target: '_blank', rel: 'noopener' }, p.doi ? 'DOI' : 'Search'),
        el('a', { href: zoteroLink(k), title: 'Open in Zotero' }, 'Zotero')));
  }
  function alsoNode(q) {
    const a = (q.also || []).filter(k => P[k] && k !== q.source);
    if (!a.length) return null;
    const n = el('div', { class: 'also' }, 'See also: ');
    a.forEach((k, i) => { if (i) n.append(', '); n.append(el('a', { href: doiLink(k), target: '_blank', rel: 'noopener', title: P[k].title }, short(k))); });
    return n;
  }
  function figureNode(q) {
    const f = q.figure;
    const img = el('img', { src: f.file, alt: f.caption, loading: 'lazy' });
    const wrap = el('div', { class: 'imgwrap', onclick: () => openLightbox(f.file, `${short(q.source)}, ${f.label}. ${f.caption}`) }, img);
    return el('figure', { class: 'panel' }, wrap,
      el('figcaption', {}, el('b', {}, `${f.label}. `), f.caption));
  }
  function answerBody(q, withAnswer) {
    return [
      withAnswer ? el('div', { class: 'answer' }, '✓ ' + q.options[q.answer]) : null,
      el('p', { class: 'explain' }, q.explanation),
      el('p', { class: 'takeaway', style: topicStyle(q.topic) }, q.takeaway),
      figureNode(q),
      citeNode(q.source, q.figure),
      alsoNode(q),
    ].filter(Boolean);
  }

  /* ---------- views ---------- */
  const VIEWS = ['setup', 'run', 'end', 'browse', 'papers'];
  function show(v) {
    VIEWS.forEach(x => $('#view-' + x).classList.toggle('hidden', x !== v));
    const tab = (v === 'browse' || v === 'papers') ? v : 'quiz';
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === tab));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.view;
    if (v === 'quiz') { if (run && !run.done) show('run'); else renderSetup(); }
    else if (v === 'browse') renderBrowse();
    else renderPapers();
  }));

  /* ---------- setup ---------- */
  function pool() {
    return QS.filter(q => prefs.topics.includes(q.topic)
      && (prefs.type === 'all' || q.type === prefs.type)
      && prefs.diffs.includes(q.difficulty)
      && (prefs.pool === 'all' || (prefs.pool === 'unseen' && !stat(q.id).n) || (prefs.pool === 'missed' && stat(q.id).last === 0)));
  }
  function renderSetup() {
    const nPapers = Object.keys(P).length;
    $('#setup-lead').textContent = `${QS.length} questions from ${nPapers} papers in your library on how granule cells work: their synapses and dendrites, their place in the bulb circuit, their inputs from cortex and neuromodulatory centres, adult neurogenesis, brain state and learning. Every answer shows the figure panel it comes from.`;
    const chips = $('#topic-chips'); chips.innerHTML = '';
    TOPICS.forEach(t => {
      const qs = QS.filter(q => q.topic === t.id);
      const seen = qs.filter(q => stat(q.id).n);
      const right = qs.filter(q => stat(q.id).last === 1).length;
      const on = prefs.topics.includes(t.id);
      chips.append(el('button', {
        class: 'chip' + (on ? '' : ' off'), style: topicStyle(t.id), 'aria-pressed': on,
        onclick: () => { prefs.topics = on ? prefs.topics.filter(x => x !== t.id) : prefs.topics.concat(t.id); savePrefs(); renderSetup(); }
      },
        el('div', { class: 'name' }, t.name, el('span', { class: 'count' }, seen.length ? `${right}/${qs.length} right` : `${qs.length} questions`)),
        el('div', { class: 'blurb' }, t.blurb),
        el('div', { class: 'mastery' }, el('i', { style: `width:${100 * right / qs.length}%` }))));
    });
    syncSeg('#type-seg', [prefs.type]);
    syncSeg('#diff-seg', prefs.diffs.map(String));
    syncSeg('#len-seg', [prefs.len]);
    syncSeg('#pool-seg', [prefs.pool]);
    const n = pool().length;
    const len = prefs.len === 'all' ? n : Math.min(n, +prefs.len);
    $('#pool-count').textContent = n ? `${len} of ${n} matching questions` : 'No questions match these settings';
    $('#start-btn').disabled = !n;
    const seenAll = QS.filter(q => stat(q.id).n).length;
    const rightAll = QS.filter(q => stat(q.id).last === 1).length;
    $('#stats-strip').textContent = seenAll ? `So far: ${seenAll} of ${QS.length} questions seen, ${rightAll} answered correctly on the latest attempt.` : '';
    show('setup');
  }
  function syncSeg(sel, on) { document.querySelectorAll(sel + ' button').forEach(b => b.classList.toggle('on', on.includes(b.dataset.v))); }
  function bindSeg(sel, key, multi) {
    document.querySelectorAll(sel + ' button').forEach(b => b.addEventListener('click', () => {
      if (multi) {
        const v = +b.dataset.v;
        const s = new Set(prefs[key]); s.has(v) ? s.delete(v) : s.add(v);
        if (!s.size) return; prefs[key] = [...s].sort();
      } else prefs[key] = b.dataset.v;
      savePrefs(); renderSetup();
    }));
  }
  bindSeg('#type-seg', 'type'); bindSeg('#diff-seg', 'diffs', true); bindSeg('#len-seg', 'len'); bindSeg('#pool-seg', 'pool');
  $('#topics-all').addEventListener('click', () => { prefs.topics = TOPICS.map(t => t.id); savePrefs(); renderSetup(); });
  $('#topics-none').addEventListener('click', () => { prefs.topics = []; savePrefs(); renderSetup(); });
  $('#start-btn').addEventListener('click', () => {
    let list = shuffle(pool());
    if (prefs.len !== 'all') list = list.slice(0, +prefs.len);
    start(list.map(q => q.id));
  });

  /* ---------- run ---------- */
  let run = null;
  function start(ids) {
    run = { ids, i: 0, results: [], done: false };
    renderQuestion(); show('run');
  }
  function renderQuestion() {
    const q = Q[run.ids[run.i]];
    const order = shuffle(q.options.map((_, i) => i));
    run.order = order; run.answered = false;
    $('#progress-fill').style.width = `${100 * run.i / run.ids.length}%`;
    const right = run.results.filter(r => r.ok).length;
    $('#run-score').textContent = `${right}/${run.results.length} correct`;
    const card = $('#q-card'); card.innerHTML = ''; card.style.cssText = topicStyle(q.topic);
    card.append(
      el('div', { class: 'meta' },
        el('span', { class: 'badge topic' }, T[q.topic].name),
        el('span', { class: 'badge' }, typeName(q.type)),
        el('span', { class: 'dots', title: diffName(q.difficulty) }, dots(q.difficulty)),
        el('span', { class: 'qnum' }, `${run.i + 1} / ${run.ids.length}`)),
      q.setup ? el('div', { class: 'setup-box' }, el('b', {}, q.type === 'predict' ? 'The experiment' : 'Context'), q.setup) : null,
      el('p', { class: 'qtext' }, q.question),
      el('div', { class: 'opts' }, order.map((oi, k) =>
        el('button', { class: 'opt', 'data-oi': oi, onclick: () => answer(oi) }, el('span', { class: 'k' }, String(k + 1)), el('span', {}, q.options[oi])))),
      el('div', { id: 'reveal' }));
    card.querySelector('.opt').focus({ preventScroll: true });
  }
  function answer(oi) {
    if (run.answered) return;
    run.answered = true;
    const q = Q[run.ids[run.i]];
    const ok = oi === q.answer;
    run.results.push({ id: q.id, ok });
    record(q.id, ok);
    document.querySelectorAll('#q-card .opt').forEach(b => {
      const v = +b.dataset.oi; b.disabled = true;
      if (v === q.answer) b.classList.add('correct');
      else if (v === oi) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const last = run.i === run.ids.length - 1;
    const r = $('#reveal'); r.className = 'reveal';
    r.append(
      el('div', { class: 'verdict ' + (ok ? 'good' : 'bad') }, ok ? 'Correct.' : 'Not quite.'),
      ...answerBody(q, false),
      el('div', { class: 'next-row' },
        el('span', { class: 'kbd' }, 'Enter ↵'),
        el('button', { class: 'primary', id: 'next-btn', onclick: next }, last ? 'See results' : 'Next question')));
    const right = run.results.filter(x => x.ok).length;
    $('#run-score').textContent = `${right}/${run.results.length} correct`;
    $('#progress-fill').style.width = `${100 * (run.i + 1) / run.ids.length}%`;
    $('#next-btn').focus({ preventScroll: true });
  }
  function next() {
    if (!run || !run.answered) return;
    if (run.i < run.ids.length - 1) { run.i++; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else finish();
  }
  function finish() {
    run.done = true;
    const n = run.results.length, right = run.results.filter(r => r.ok).length;
    $('#end-title').textContent = n ? `${right} of ${n} correct` : 'Quiz ended';
    $('#end-lead').textContent = !n ? 'No questions answered.' : right === n ? 'A clean sweep.' : `${Math.round(100 * right / n)}% — the cards you missed are below, with their answers and figures.`;
    const bars = $('#end-bars'); bars.innerHTML = '';
    TOPICS.forEach(t => {
      const rs = run.results.filter(r => Q[r.id].topic === t.id);
      if (!rs.length) return;
      const c = rs.filter(r => r.ok).length;
      bars.append(el('div', { class: 'tbar', style: topicStyle(t.id) }, el('span', {}, t.name),
        el('div', { class: 'track' }, el('i', { style: `width:${100 * c / rs.length}%` })), el('span', { class: 'v' }, `${c}/${rs.length}`)));
    });
    const missed = run.results.filter(r => !r.ok).map(r => Q[r.id]);
    $('#missed-head').classList.toggle('hidden', !missed.length);
    $('#retry-missed-btn').classList.toggle('hidden', !missed.length);
    const box = $('#end-missed'); box.innerHTML = '';
    missed.forEach(q => box.append(browseCard(q)));
    show('end');
  }
  $('#again-btn').addEventListener('click', renderSetup);
  $('#retry-missed-btn').addEventListener('click', () => start(shuffle(run.results.filter(r => !r.ok).map(r => r.id))));
  $('#quit-btn').addEventListener('click', () => { if (run && run.results.length) finish(); else renderSetup(); });

  /* ---------- browse ---------- */
  function browseCard(q) {
    const s = stat(q.id);
    const mark = s.n ? (s.last ? ' ✓' : ' ✗') : '';
    const d = el('details', { class: 'bcard', id: 'card-' + q.id, style: topicStyle(q.topic) },
      el('summary', {},
        el('div', { class: 'meta', style: 'margin:0' },
          el('span', { class: 'badge topic' }, T[q.topic].name),
          el('span', { class: 'badge' }, typeName(q.type)),
          el('span', { class: 'dots', title: diffName(q.difficulty) }, dots(q.difficulty)),
          el('span', { class: 'qnum' }, short(q.source) + mark)),
        el('div', { class: 'sq' }, q.question),
        el('div', { class: 'st' }, q.takeaway)),
      el('div', { class: 'bbody' }));
    d.addEventListener('toggle', () => {
      const b = d.querySelector('.bbody');
      if (d.open && !b.childNodes.length) {
        if (q.setup) b.append(el('div', { class: 'setup-box' }, el('b', {}, q.type === 'predict' ? 'The experiment' : 'Context'), q.setup));
        b.append(...answerBody(q, true));
      }
    });
    return d;
  }
  function renderBrowse(focusId) {
    const sel = $('#browse-topic');
    if (!sel.options.length) {
      sel.append(el('option', { value: '' }, 'All topics'), ...TOPICS.map(t => el('option', { value: t.id }, t.name)));
    }
    const term = $('#browse-search').value.trim().toLowerCase();
    const topic = sel.value;
    const list = $('#browse-list'); list.innerHTML = '';
    let total = 0;
    TOPICS.forEach(t => {
      if (topic && t.id !== topic) return;
      const qs = QS.filter(q => q.topic === t.id && (!term || hay(q).includes(term)));
      if (!qs.length) return;
      total += qs.length;
      list.append(el('div', { class: 'group-head', style: topicStyle(t.id) }, el('h3', {}, t.name), el('span', {}, `${qs.length} cards · ${t.blurb}`)));
      qs.forEach(q => list.append(browseCard(q)));
    });
    if (!total) list.append(el('div', { class: 'empty' }, 'Nothing matches that search.'));
    show('browse');
    if (focusId) {
      const c = document.getElementById('card-' + focusId);
      if (c) { c.open = true; c.dispatchEvent(new Event('toggle')); setTimeout(() => c.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
    }
  }
  const hay = q => [q.question, q.setup, q.takeaway, q.explanation, q.figure.caption, ...q.options, short(q.source), P[q.source].title, ...(q.also || []).map(short)].join(' ').toLowerCase();
  let bt; $('#browse-search').addEventListener('input', () => { clearTimeout(bt); bt = setTimeout(() => renderBrowse(), 150); });
  $('#browse-topic').addEventListener('change', () => renderBrowse());
  $('#expand-all').addEventListener('click', e => {
    const cards = document.querySelectorAll('#browse-list details');
    const open = e.target.textContent === 'Expand all';
    cards.forEach(c => { c.open = open; });
    e.target.textContent = open ? 'Collapse all' : 'Expand all';
  });

  /* ---------- papers ---------- */
  function renderPapers() {
    const term = $('#paper-search').value.trim().toLowerCase();
    const uses = {};
    QS.forEach(q => [q.source, ...(q.also || [])].forEach(k => { (uses[k] = uses[k] || []).includes(q.id) || uses[k].push(q.id); }));
    const keys = Object.keys(P).sort((a, b) => P[a].author.localeCompare(P[b].author) || P[a].year.localeCompare(P[b].year));
    const list = $('#paper-list'); list.innerHTML = '';
    let n = 0;
    keys.forEach(k => {
      const p = P[k];
      if (term && !`${p.author} ${p.year} ${p.title} ${p.journal}`.toLowerCase().includes(term)) return;
      n++;
      list.append(el('div', { class: 'paper' },
        el('div', { class: 'ttl' }, p.title),
        el('div', { class: 'src' }, `${p.author} (${p.year}) `, el('i', {}, p.journal || ''), ' · ',
          el('a', { href: doiLink(k), target: '_blank', rel: 'noopener' }, p.doi ? 'DOI' : 'Search'), ' · ',
          el('a', { href: zoteroLink(k) }, 'Zotero')),
        el('div', { class: 'qs' }, (uses[k] || []).map(id => el('button', { style: topicStyle(Q[id].topic), title: Q[id].question, onclick: () => { $('#browse-search').value = ''; $('#browse-topic').value = ''; renderBrowse(id); } }, id)))));
    });
    if (!n) list.append(el('div', { class: 'empty' }, 'No papers match.'));
    show('papers');
  }
  $('#paper-search').addEventListener('input', () => renderPapers());

  /* ---------- lightbox ---------- */
  function openLightbox(src, cap) { $('#lightbox-img').src = src; $('#lightbox-cap').textContent = cap; $('#lightbox').classList.remove('hidden'); }
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'Escape') { $('#lightbox').classList.add('hidden'); return; }
    if ($('#view-run').classList.contains('hidden') || !run) return;
    if (!run.answered && /^[1-4]$/.test(e.key)) {
      const b = document.querySelectorAll('#q-card .opt')[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    } else if (run.answered && (e.key === 'Enter' || e.key === 'ArrowRight')) {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'next-btn') return; // button handles it
      e.preventDefault(); next();
    }
  });

  $('#reset-btn').addEventListener('click', () => {
    if (!window.confirm('Forget all answers recorded in this browser?')) return;
    store.stats = {}; save(); renderSetup();
  });

  renderSetup();
})();
