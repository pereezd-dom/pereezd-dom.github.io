// Переезд.Дом — сайт: вкладки городов, бегунок бюджета, появление блоков при прокрутке.
// Всё работает и без скрипта: вкладки показывают первый город, бегунок прячется, блоки видны сразу.
(function () {
  var root = document.documentElement;

  // Вкладки «Сколько стоит двушка»: фото, цифры и две кнопки — у каждого города свои
  var tabs = document.querySelectorAll('[role="tab"]');
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t, i) { t.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
      document.querySelectorAll('[role="tabpanel"]').forEach(function (p, i) { p.hidden = i !== index; });
      document.querySelectorAll('[data-city]').forEach(function (el) { el.hidden = Number(el.dataset.city) !== index; });
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = (index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  });

  // Бегунок «бюджет на двушку»: в скольких городах каждой страны медиана двушки укладывается в бюджет
  var range = document.getElementById('budget');
  var dataTag = document.getElementById('budget-data');
  if (range && dataTag) {
    var medians = JSON.parse(dataTag.textContent);
    range.closest('.budget').hidden = false;
    var out = document.getElementById('budget-out');
    var fmt = function (n) { return n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽'; };
    var word = function (n) {
      var d = n % 10, h = n % 100;
      if (d === 1 && h !== 11) return 'городе';
      return 'городах';
    };
    var update = function () {
      var budget = Number(range.value);
      out.textContent = fmt(budget);
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
