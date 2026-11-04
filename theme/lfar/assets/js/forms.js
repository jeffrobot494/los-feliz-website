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

// Donorbox and Petfinder: offer the direct page when the widget never draws.
// No extra request. Donorbox tells us it loaded by posting its height. Petfinder
// counts only once pet cards are actually in the widget.
(function () {
	function noteFor(html) {
		var note = document.createElement('p');
		note.className = 'lfar-widget-fallback';
		note.hidden = true;
		note.innerHTML = html;
		return note;
	}
	function show(box, note) {
		if (!note.hidden && box.classList.contains('is-down')) return;
		box.classList.add('is-down');
		note.hidden = false;
	}
	function hide(box, note) {
		box.classList.remove('is-down');
		note.hidden = true;
	}

	document.querySelectorAll('iframe[name="donorbox"]').forEach(function (frame) {
		var box = frame.closest('.widget') || frame.parentNode;
		var note = noteFor('The donation form did not load. <a href="https://donorbox.org/los-feliz-animal-rescue-1" target="_blank" rel="noopener">Give on Donorbox</a>.');
		box.appendChild(note);
		var ok = false;
		function up() { ok = true; hide(box, note); }
		window.addEventListener('message', function (e) {
			var data = e.data;
			if (!data || data.from !== 'dbox') return;
			if (parseInt(data.height, 10) > 0) up();
		});
		frame.addEventListener('error', function () { if (!ok) show(box, note); });
		setTimeout(function () { if (!ok) show(box, note); }, 8000);
	});

	var scroller = document.querySelector('pet-scroller');
	var toggle = document.querySelector('.pf-toggle');
	var panel = document.getElementById('pf-panel');
	if (scroller && toggle && panel) {
		var note = noteFor('The pet list did not load. <a href="https://www.petfinder.com/search/pets-for-adoption/?shelter_id%5B0%5D=CA3083" target="_blank" rel="noopener">See adoptable animals on Petfinder</a>.');
		toggle.insertAdjacentElement('afterend', note);
		function eachRoot(fn) {
			var pending = [scroller];
			var seen = [];
			while (pending.length) {
				var node = pending.shift();
				if (!node || seen.indexOf(node) !== -1) continue;
				seen.push(node);
				fn(node);
				if (node.shadowRoot) pending.push(node.shadowRoot);
				if (!node.querySelectorAll) continue;
				var nested = node.querySelectorAll('*');
				for (var i = 0; i < nested.length; i++) {
					if (nested[i].shadowRoot) pending.push(nested[i].shadowRoot);
				}
			}
		}
		// Branding ("Powered by Petfinder") is not a pet. Only a listing link or a photo from Petfinder's CDN counts.
		function petsRendered() {
			var pets = false;
			var error = false;
			eachRoot(function (root) {
				var text = root.textContent || '';
				if (/unable to reach petfinder/i.test(text)) error = true;
				if (!root.querySelectorAll) return;
				var links = root.querySelectorAll('a[href]');
				for (var i = 0; i < links.length; i++) {
					var href = links[i].getAttribute('href') || '';
					if (/\/details(?:[\/?#]|$)/i.test(href)) pets = true;
				}
				var imgs = root.querySelectorAll('img[src]');
				for (var j = 0; j < imgs.length; j++) {
					if (/cloudfront\.net/i.test(imgs[j].getAttribute('src') || '')) pets = true;
				}
			});
			return pets && !error;
		}
		var tries = 0;
		var timer = setInterval(function () {
			tries++;
			if (petsRendered()) {
				clearInterval(timer);
				hide(panel, note);
				return;
			}
			if (tries >= 16) show(panel, note);
			if (tries >= 40) clearInterval(timer);
		}, 500);
	}
})();
