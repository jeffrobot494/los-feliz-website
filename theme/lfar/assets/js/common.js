// Shared behavior for pages that aren't one of the six mockups (posts, archives, new pages).
(function () {
	// mark the current nav item
	var p = location.pathname.replace(/\/?$/, '/');
	[].forEach.call(document.querySelectorAll('#menu a'), function (a) {
		var h; try { h = new URL(a.href).pathname.replace(/\/?$/, '/'); } catch (e) { return; }
		if (h === p) { a.setAttribute('aria-current', 'page'); if (!a.parentNode.classList.contains('nav-donate')) a.classList.add('active'); }
	});

	// mobile menu
	var burger = document.getElementById('burger'), menu = document.getElementById('menu');
	if (burger && menu) {
		burger.addEventListener('click', function () { var o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); burger.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });
		menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
	}

	// newsletter (placeholder until the real form is connected: nothing is sent)
	var nf = document.getElementById('nl-form'), ne = document.getElementById('nl-email'), nn = document.getElementById('nl-note');
	if (nf && ne && nn) {
		nf.addEventListener('submit', function (e) {
			e.preventDefault();
			if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne.value.trim())) { nn.className = 'nl-note'; nn.textContent = 'Enter an email address like name@example.com.'; ne.focus(); return; }
			nn.className = 'nl-note ok'; nn.textContent = 'Thanks! You\'re signed up.'; ne.value = '';
		});
	}

	// back to top
	var toTop = document.getElementById('toTop');
	if (toTop) {
		var onScroll = function () { toTop.classList.toggle('show', window.scrollY > 500); };
		window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
		toTop.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
	}
})();
