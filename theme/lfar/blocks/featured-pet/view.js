// Featured pet: once the pet is no longer on Petfinder's adoptable list, show the card as "Adopted!"
// and point its button at the full list instead of the adoption form.
(function () {
	[].forEach.call(document.querySelectorAll('.feat-card[data-pet-id]'), function (card) {
		var id = card.dataset.petId;
		if (!id || !window.lfarPetfinder) return; // the built-in example has no listing to check
		window.lfarPetfinder.isAdopted(id).then(function (adopted) {
			if (adopted) markAdopted(card);
		});
	});

	function markAdopted(card) {
		var name = card.dataset.petName;
		card.classList.add('is-adopted');
		var tag = card.querySelector('.feat-tag');
		if (tag) tag.textContent = 'Adopted!';

		var facts = card.querySelector('.pet-facts');
		if (facts) {
			var note = document.createElement('p');
			note.className = 'adopted-note';
			note.innerHTML = '<strong></strong> Plenty of friends are still waiting for theirs.';
			note.firstChild.textContent = name + ' found a home!';
			facts.after(note);
		}

		var apply = card.querySelector('.apply-for');
		if (apply) {
			var btn = document.createElement('button');
			btn.className = 'btn';
			btn.type = 'button';
			btn.textContent = 'Meet who’s still waiting';
			btn.addEventListener('click', openFullList);
			apply.replaceWith(btn);
		}
	}

	// The Adopt page's "See all adoptable animals" panel: open it if it's closed, then scroll to it.
	function openFullList() {
		var toggle = document.getElementById('pf-btn');
		var panel = document.getElementById('pf-panel');
		if (!toggle) return;
		if (panel && !panel.classList.contains('open')) toggle.click();
		toggle.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
})();
