// Переезд.Дом — сайт: поиск цен на первом экране, бегунок бюджета, связь списка стран с глобусом,
// появление блоков при прокрутке. Без скрипта всё читается: поиск показывает Тбилиси, бегунок спрятан.
(function () {
  var root = document.documentElement;
  var rub = function (n) { return n.toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽'; };
  var thousands = function (n) { return Math.round(n / 1000).toLocaleString('ru-RU').replace(/\s/g, ' '); };

  // Поиск: страна → город → комнаты → медиана, обычный разброс и две ссылки
  var form = document.getElementById('poisk');
  var searchTag = document.getElementById('search-data');
  if (form && searchTag) {
    var data = JSON.parse(searchTag.textContent);
    var country = document.getElementById('s-country');
    var city = document.getElementById('s-city');
    var rooms = document.getElementById('s-rooms');
    var result = document.getElementById('s-result');
    var roomWords = { '1': 'студия или 1 комната', '2': '2 комнаты', '3': '3 комнаты', '4': '4 комнаты и больше' };
    var current = function () {
      var c = data.find(function (x) { return x.code === country.value; });
      return c && c.cities[Number(city.value)];
    };
    var fillCities = function () {
      var c = data.find(function (x) { return x.code === country.value; });
      city.innerHTML = '';
      (c ? c.cities : []).forEach(function (item, i) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = item.name;
        city.appendChild(o);
      });
    };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
    var show = function () {
      var c = current();
      if (!c) { result.innerHTML = ''; return; }
      var r = c.rent[rooms.value];
      var what = '<b>' + esc(c.name) + ', ' + roomWords[rooms.value] + '</b>';
      var head;
      if (r) {
        var note = ' — медиана по ' + r[3] + ' объявлениям' + (r[1] != null ? ', обычно ' + thousands(r[1]) + '–' + thousands(r[2]) + ' тыс. ₽' : '') + '.';
        if (c.new) note += ' Новых за сутки: ' + c.new + '.';
        head = '<p class="r-head"><span class="r-price">' + rub(r[0]) + '</span> <span class="r-unit">в месяц</span></p><p class="r-note">' + what + note + '</p>';
      } else {
        head = '<p class="r-note">' + what + ': таких квартир сейчас слишком мало, чтобы назвать цену. Всего объявлений об аренде в городе: ' + c.count + '.</p>';
      }
      // 3D-макет центра выбранного города, если он есть
      var model = c.model ? '<figure class="r-model"><img src="' + c.model + '" width="720" height="540" alt="3D-макет центра: ' + esc(c.name) + '" decoding="async"><figcaption>' + esc(c.name) + ' · ' + esc(form.dataset.date || '') + '</figcaption></figure>' : '';
      result.classList.toggle('has-model', !!c.model);
      result.innerHTML = model + head + '<p class="r-links"><a href="' + c.url + '">Все цены города</a><a href="' + c.bot + '">Свежие квартиры в боте</a></p>';
    };
    country.addEventListener('change', function () { fillCities(); show(); focusGlobe(country.value); });
    city.addEventListener('change', show);
    rooms.addEventListener('change', show);
    form.addEventListener('submit', function (e) { e.preventDefault(); show(); result.classList.remove('flash'); void result.offsetWidth; result.classList.add('flash'); });
  }

  // Глобус: наведение или фокус на стране в списке поворачивает глобус к ней
  function focusGlobe(code) { document.dispatchEvent(new CustomEvent('globe:focus', { detail: code })); }
  document.querySelectorAll('.c-row[data-code]').forEach(function (row) {
    row.addEventListener('pointerenter', function () { focusGlobe(row.dataset.code); });
    row.addEventListener('pointerleave', function () { focusGlobe(null); });
    row.addEventListener('focus', function () { focusGlobe(row.dataset.code); });
    row.addEventListener('blur', function () { focusGlobe(null); });
  });

  // Бегунок «бюджет на двушку»: в скольких городах каждой страны медиана двушки укладывается в бюджет
  var range = document.getElementById('budget');
  var budgetTag = document.getElementById('budget-data');
  if (range && budgetTag) {
    var medians = JSON.parse(budgetTag.textContent);
    range.closest('.budget').hidden = false;
    var out = document.getElementById('budget-out');
    var word = function (n) { return n % 10 === 1 && n % 100 !== 11 ? 'городе' : 'городах'; };
    var update = function () {
      var budget = Number(range.value);
      out.textContent = rub(budget);
      range.style.setProperty('--fill', ((budget - range.min) / (range.max - range.min) * 100).toFixed(1) + '%');
      document.querySelectorAll('.c-row[data-code]').forEach(function (row) {
        var list = medians[row.dataset.code] || [];
        var fits = list.filter(function (m) { return m <= budget; }).length;
        var mark = row.querySelector('.fit');
        if (!mark) return;
        mark.classList.toggle('none', fits === 0);
        mark.textContent = fits ? '· по бюджету — в ' + fits + ' ' + word(fits) + ' из ' + list.length : '· по бюджету — пока нет';
      });
    };
    range.addEventListener('input', update);
    update();
  }

  // Появление: заголовок, текст, картинка — по очереди, один раз, когда блок входит в экран
  var items = document.querySelectorAll('.rise');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('js');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  // 3D-глобус (three.js ≈ 670 КБ, сжатым ≈ 170 КБ) грузится после отрисовки страницы, в свободное время:
  // иначе на телефоне его разбор задерживает первый экран (Lighthouse 23.11: LCP 7,4 с на мобильном)
  var globeHost = document.querySelector('[data-globe][data-src]');
  if (globeHost) {
    var loadGlobe = function () { import(globeHost.getAttribute('data-src')).catch(function () { /* без глобуса страница работает */ }); };
    var idle = function () { (window.requestIdleCallback || function (cb) { setTimeout(cb, 300); })(loadGlobe, { timeout: 1500 }); };
    if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle);
  }

  // Тёмная тема: кнопка в шапке, выбор — в localStorage (в <head> его читает маленький скрипт, чтобы не мигало)
  var themeBtn = document.querySelector('.theme');
  if (themeBtn) {
    var themeColor = document.querySelector('meta[name="theme-color"]');
    var setTheme = function (dark) {
      if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      if (themeColor) themeColor.content = dark ? '#08132a' : '#1b5fd8';
    };
    setTheme(root.dataset.theme === 'dark');
    themeBtn.hidden = false;
    themeBtn.addEventListener('click', function () {
      var dark = root.dataset.theme !== 'dark';
      setTheme(dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* приватный режим — просто без запоминания */ }
    });
  }

  // Шапка: текущий раздел главной подсвечен (полоска под словом) — по клику сразу, при прокрутке — по блоку в середине экрана
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.bar .links a'));
  var mark = function (id) {
    navLinks.forEach(function (a) {
      if (a.hash === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  navLinks.forEach(function (a) { a.addEventListener('click', function () { if (document.getElementById(a.hash.slice(1))) mark(a.hash.slice(1)); }); });
  var navSections = navLinks.map(function (a) { return document.getElementById(a.hash.slice(1)); }).filter(Boolean);
  if (navSections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { mark(entry.target.id); return; }
        // выше первого раздела (первый экран) или ниже последнего (вопросы, подвал) — ничего не подсвечено
        var top = entry.boundingClientRect.top;
        if ((entry.target === navSections[0] && top > 0) || (entry.target === navSections[navSections.length - 1] && top < 0)) mark(null);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navSections.forEach(function (s) { spy.observe(s); });
  }

  // Закреплённая шапка (десктоп): фон появляется, как только страница сдвинулась
  var bar = document.querySelector('.bar');
  if (bar) {
    var stick = function () { bar.classList.toggle('bar--stuck', window.scrollY > 8); };
    window.addEventListener('scroll', stick, { passive: true });
    stick();
  }

  // Плавная прокрутка колесом, как на augen.pro: Lenis, доезд за 0,8 с с мягким торможением (easeOutQuart).
  // На телефоне палец крутит страницу как обычно (Lenis не трогает касания); при «уменьшить движение» — без Lenis.
  // Ссылки на разделы («/#tseny», «#top») едут тем же движением с поправкой на закреплённую шапку.
  if (window.Lenis && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var lenis = new window.Lenis({ duration: 0.8, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    var frame = function (time) { lenis.raf(time); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || !a.hash || a.origin !== location.origin || a.pathname !== location.pathname) return;
      var target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      var stuck = bar && getComputedStyle(bar).position === 'sticky';
      lenis.scrollTo(target, { offset: stuck ? -(bar.offsetHeight + 16) : 0 });
      if (target.tabIndex >= 0 || target.hasAttribute('tabindex')) target.focus({ preventScroll: true }); // «к содержимому»: фокус в main
      if (history.pushState) history.pushState(null, '', a.hash);
    });
  }

  // Частые вопросы: на широком экране все ответы открыты сразу, тремя колонками; на телефоне — аккордеон
  var faq = document.querySelector('.faq');
  if (faq) {
    var qa = Array.prototype.slice.call(faq.querySelectorAll('.qa details'));
    var wide = window.matchMedia('(min-width: 900px)');
    var layoutFaq = function () {
      faq.classList.toggle('faq--grid', wide.matches);
      qa.forEach(function (d, i) {
        if (wide.matches) { d.removeAttribute('name'); d.open = true; } else { d.setAttribute('name', 'faq'); d.open = i === 0; }
      });
    };
    qa.forEach(function (d) {
      d.querySelector('summary').addEventListener('click', function (e) { if (wide.matches) e.preventDefault(); });
    });
    layoutFaq();
    wide.addEventListener('change', layoutFaq);
  }
})();
