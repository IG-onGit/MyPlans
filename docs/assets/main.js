(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var RULES = {
    yaml: [['c', /#[^\n]*/], ['s', /"[^"\n]*"|'[^'\n]*'/], ['o', /\[ASAP\]/], ['p', /^[ \t]*[^\s#\-][^\n:]*(?=:[ \t]*$)/m], ['x', /^[ \t]*-(?=\s)|:/m]],
    bash: [['c', /#[^\n]*/], ['s', /"[^"\n]*"|'[^'\n]*'/], ['o', /--?[A-Za-z][\w-]*/], ['k', /\b(?:git|code)\b/], ['f', /\b(?:add|commit|push)\b/]],
    json: [['p', /"[^"\n]*"(?=\s*:)/], ['s', /"[^"\n]*"/], ['n', /\b\d+\b/], ['k', /\b(?:true|false|null)\b/], ['x', /[{}\[\],:]/]]
  };
  RULES.yml = RULES.yaml; RULES.sh = RULES.bash;

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function highlight(src, lang) {
    var rules = RULES[lang];
    if (!rules) return esc(src);
    var re = new RegExp(rules.map(function (r) { return '(' + r[1].source + ')'; }).join('|'), 'gm');
    var out = '', last = 0, m;
    while ((m = re.exec(src))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      var k = 1;
      while (m[k] === undefined) k++;
      out += esc(src.slice(last, m.index)) + '<span class="tok-' + rules[k - 1][0] + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

  document.addEventListener('DOMContentLoaded', function () {
    /* 1. Code blocks */
    document.querySelectorAll('pre > code[data-lang]').forEach(function (code) {
      var raw = code.textContent.replace(/\n$/, ''), pre = code.parentNode, lang = code.dataset.lang;
      var wrap = document.createElement('div');
      wrap.className = 'code';
      wrap.innerHTML = '<div class="top"><i></i><i></i><i></i><span></span><button type="button" class="copy">' + icon('copy') + '<b>Copy</b></button></div>';
      wrap.querySelector('span').textContent = code.dataset.title || lang;
      try { code.innerHTML = highlight(raw, lang); } catch (e) { code.textContent = raw; }
      code.tabIndex = 0;
      pre.parentNode.replaceChild(wrap, pre);
      wrap.appendChild(pre);
      wrap.querySelector('.copy').addEventListener('click', function () {
        var label = this.querySelector('b');
        function done() { label.textContent = 'Copied'; setTimeout(function () { label.textContent = 'Copy'; }, 1800); }
        function fallback() {
          var t = document.createElement('textarea');
          t.value = raw; document.body.appendChild(t); t.select();
          try { document.execCommand('copy'); } catch (e) {}
          t.remove(); done();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(done, fallback);
        else fallback();
      });
    });

    /* 2. Burger menu */
    var burger = document.querySelector('.burger'), root = document.documentElement;
    if (burger) {
      var target = document.getElementById(burger.getAttribute('aria-controls'));
      window.MP_closeMenu = function () {
        root.classList.remove('menu-open'); target.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
        burger.querySelector('use').setAttribute('href', '#i-menu');
      };
      burger.addEventListener('click', function () {
        if (root.classList.contains('menu-open')) return window.MP_closeMenu();
        root.classList.add('menu-open'); target.classList.add('open');
        burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
        burger.querySelector('use').setAttribute('href', '#i-x');
      });
      target.addEventListener('click', function (e) { if (e.target.closest('a')) window.MP_closeMenu(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.MP_closeMenu(); });
      window.matchMedia('(min-width:821px)').addEventListener('change', function (m) { if (m.matches) window.MP_closeMenu(); });
    }

    /* 3. Docs sections */
    var sections = [].slice.call(document.querySelectorAll('.doc-section'));
    if (sections.length) {
      var links = document.querySelectorAll('[data-section]');
      var site = document.title.split(' | ').pop();
      var show = function (id, push) {
        var s = sections.filter(function (x) { return x.id === id; })[0] || sections[0];
        sections.forEach(function (x) { x.classList.toggle('active', x === s); });
        links.forEach(function (a) {
          if (a.dataset.section === s.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
        document.title = s.querySelector('h1').textContent + ' | ' + site;
        if (push) history.pushState(null, '', '#' + s.id);
        window.scrollTo(0, 0);
        if (window.MP_closeMenu) window.MP_closeMenu();
      };
      document.addEventListener('click', function (e) {
        var a = e.target.closest('[data-section],[data-goto]');
        if (!a) return;
        e.preventDefault();
        show(a.dataset.section || a.dataset.goto, true);
      });
      window.addEventListener('popstate', function () { show(location.hash.slice(1)); });
      show(location.hash.slice(1));
      setTimeout(function () { window.scrollTo(0, 0); }, 0);
    }
  });
})();
