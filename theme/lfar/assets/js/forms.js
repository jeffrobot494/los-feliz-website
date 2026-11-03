// Glue between the page designs and Fluent Forms.
(function () {
	var $ = function (s, c) { return (c || document).querySelector(s); };
	var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

	// Old links to the foster form on the Adopt page now live under Get Involved.
	if (location.hash === '#apply-foster' && /\/adopt\/?$/.test(location.pathname)) {
		location.replace('/get-involved/#foster');
		return;
	}

	var applyBtn = document.querySelector('.adopt-now');
	var applySec = document.getElementById('apply');
	if (applyBtn && applySec && 'IntersectionObserver' in window) {
		new IntersectionObserver(function (entries) {
			applyBtn.hidden = entries[0].isIntersecting;
		}, { threshold: 0.2 }).observe(applySec);
	}

	// Adopt page: the Adopt / Foster cards switch between the two application forms.
	var radios = $$('.lfar-intent input[name="intent"]');
	if (radios.length) {
		var sync = function () {
			var v = (radios.filter(function (r) { return r.checked; })[0] || radios[0]).value;
			$$('.lfar-form').forEach(function (f) { f.hidden = !f.classList.contains('lfar-form-' + v); });
		};
		radios.forEach(function (r) { r.addEventListener('change', sync); });
		sync();

		var setValue = function (el, v) {
			el.value = v;
			el.dispatchEvent(new Event('input', { bubbles: true }));
			el.dispatchEvent(new Event('change', { bubbles: true }));
		};
		var goTo = function (intent, pet, type) {
			var r = radios.filter(function (x) { return x.value === intent; })[0];
			if (r) { r.checked = true; sync(); }
			if (pet) {
				var name = $('.lfar-form-adopt input[name="animal_name"]');
				if (name) setValue(name, pet);
			}
			if (type) {
				var kind = { dog: 'Dog', puppy: 'Dog', cat: 'Cat', kitten: 'Cat' }[type] || 'Other';
				var k = $('.lfar-form-adopt input[name="animal_kind"][value="' + kind + '"]');
				if (k && !k.checked) k.click();
			}
			var target = $('#signup') || $('#apply');
			if (target) target.scrollIntoView({ behavior: 'smooth' });
			if (r && r.nextElementSibling) {
				var card = r.nextElementSibling;
				card.classList.remove('pulse');
				setTimeout(function () { card.classList.add('pulse'); }, 700);
			}
		};
		// "Apply for ___" buttons on the pet cards
		$$('.apply-for').forEach(function (b) { b.addEventListener('click', function () { goTo('adopt', b.dataset.pet, b.dataset.type || 'dog'); }); });
		$$('.go-adopt').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); goTo('adopt'); }); });
		$$('.go-foster').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); goTo('foster'); }); });
		// links from other pages: /adopt/#apply-foster opens the foster form
		if (location.hash === '#apply-foster') setTimeout(function () { goTo('foster'); }, 300);
	} else {
		// Foster is its own form on Get Involved, so the Adopt page has no toggle.
		$$('.apply-for').forEach(function (b) {
			b.addEventListener('click', function () {
				var name = document.querySelector('.lfar-form-adopt input[name="animal_name"]');
				if (name && b.dataset.pet) {
					name.value = b.dataset.pet;
					name.dispatchEvent(new Event('input', { bubbles: true }));
					name.dispatchEvent(new Event('change', { bubbles: true }));
				}
				var kind = { dog: 'Dog', puppy: 'Dog', cat: 'Cat', kitten: 'Cat' }[b.dataset.type] || '';
				if (kind) {
					var k = document.querySelector('.lfar-form-adopt input[name="animal_kind"][value="' + kind + '"]');
					if (k && !k.checked) k.click();
				}
				var target = document.getElementById('apply') || document.getElementById('signup');
				if (target) target.scrollIntoView({ behavior: 'smooth' });
			});
		});
	}
})();
