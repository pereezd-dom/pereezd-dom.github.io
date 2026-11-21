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
      result.innerHTML = head + '<p class="r-links"><a href="' + c.url + '">Все цены города</a><a href="' + c.bot + '">Свежие квартиры в боте</a></p>';
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
})();
