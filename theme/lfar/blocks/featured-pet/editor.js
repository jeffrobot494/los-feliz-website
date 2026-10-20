// Featured pet block in the editor: the card as visitors see it, plus "Choose pet" (toolbar and photo) to pick
// another of LFAR's adoptable animals from Petfinder. The name and blurb stay editable after picking.
(function (wp) {
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var be = wp.blockEditor;
	var c = wp.components;
	var pf = window.lfarPetfinder;

	// The attributes a pick sets (block.json).
	var KEYS = ['petId', 'name', 'kind', 'facts', 'blurb', 'bullets', 'photo', 'alt', 'url'];

	function Picker(props) {
		var s = useState(null), res = s[0], setRes = s[1];
		var e = useState(''), error = e[0], setError = e[1];
		var f = useState('all'), filter = f[0], setFilter = f[1];

		useEffect(function () {
			pf.fetchPets().then(setRes, function (err) { setError(err.message); });
		}, []);

		var pets = res ? res.pets.filter(function (p) { return filter === 'all' || p.type === filter; }) : [];
		var body;
		if (error) body = el('p', { className: 'lfar-fp-msg' }, 'Couldn’t load animals from Petfinder (' + error + '). Close this and try again in a minute.');
		else if (!res) body = el('p', { className: 'lfar-fp-msg' }, el(c.Spinner), ' Loading LFAR’s animals from Petfinder…');
		else if (!pets.length) body = el('p', { className: 'lfar-fp-msg' }, 'No animals here right now.');
		else body = el('div', { className: 'lfar-fp-grid' }, pets.map(function (p) {
			var cur = p.petId === props.currentId;
			return el('button', {
				key: p.petId, type: 'button', className: 'lfar-fp-tile' + (cur ? ' is-current' : ''),
				onClick: function () { props.onPick(p); }
			},
				el('span', { className: 'lfar-fp-ph' },
					p.photo ? el('img', { src: p.photo, alt: '', loading: 'lazy' }) : null,
					cur ? el('span', { className: 'lfar-fp-badge' }, 'Featured') : null),
				el('span', { className: 'lfar-fp-nm' }, p.name),
				el('span', { className: 'lfar-fp-sub' }, p.facts));
		}));

		var filters = [['all', 'All'], ['Dog', 'Dogs'], ['Cat', 'Cats']];
		return el(c.Modal, { title: 'Choose the featured pet', onRequestClose: props.onClose, className: 'lfar-fp-modal', size: 'large' },
			el('div', { className: 'lfar-fp-bar' },
				el('span', { className: 'lfar-fp-count' }, res ? pets.length + ' adoptable' : ''),
				el('div', { className: 'lfar-fp-filters' }, filters.map(function (x) {
					return el(c.Button, { key: x[0], size: 'compact', variant: filter === x[0] ? 'primary' : 'secondary', onClick: function () { setFilter(x[0]); } }, x[1]);
				}))),
			body);
	}

	function Edit(props) {
		var a = props.attributes, set = props.setAttributes;
		var o = useState(false), open = o[0], setOpen = o[1];
		var ad = useState(false), adopted = ad[0], setAdopted = ad[1];

		useEffect(function () {
			setAdopted(false);
			if (a.petId) pf.isAdopted(a.petId).then(function (v) { setAdopted(v === true); });
		}, [a.petId]);

		function pick(p) {
			var next = {};
			KEYS.forEach(function (k) { next[k] = p[k]; });
			set(next);
			setOpen(false);
		}

		var photo = a.photo || (a.petId ? '' : pf.sherlockPhoto);
		var blockProps = be.useBlockProps({ className: 'feat-card' + (adopted ? ' is-adopted' : '') });
		var choose = function () { setOpen(true); };

		return el(wp.element.Fragment, null,
			el(be.BlockControls, { group: 'block' },
				el(c.ToolbarGroup, null, el(c.ToolbarButton, { onClick: choose }, 'Choose pet'))),
			el('div', blockProps,
				el('div', { className: 'feat-photo' },
					photo ? el('figure', { className: 'wp-block-image' }, el('img', { src: photo, alt: a.alt })) : null,
					el('span', { className: 'feat-tag' + (adopted ? ' is-adopted' : '') }, adopted ? 'Adopted!' : 'Featured pet'),
					el(c.Button, { className: 'lfar-fp-choose', variant: 'primary', icon: 'pets', onClick: choose }, 'Choose pet')),
				el('div', { className: 'feat-body custom' },
					el('h3', { className: 'wp-block-heading pet-name' }, 'Meet ',
						el(be.RichText, { tagName: 'span', value: a.name, allowedFormats: [], withoutInteractiveFormatting: true, placeholder: 'Name', 'aria-label': 'Pet name', onChange: function (v) { set({ name: v }); } })),
					el('p', { className: 'pet-facts' }, a.facts),
					adopted ? el('p', { className: 'adopted-note' },
						el('strong', null, 'Visitors see this card as adopted:'),
						' Petfinder no longer lists ' + a.name.replace(/<[^>]+>/g, '') + ' as adoptable. Click Choose pet to feature another animal.') : null,
					el(be.RichText, { tagName: 'p', value: a.blurb, allowedFormats: ['core/bold', 'core/italic'], placeholder: 'A few sentences about this pet', 'aria-label': 'About this pet', onChange: function (v) { set({ blurb: v }); } }),
					a.bullets.length ? el('ul', { className: 'wp-block-list' }, a.bullets.map(function (b, i) { return el('li', { key: i }, b); })) : null,
					a.url ? el('span', { className: 'pet-story' }, 'Read ' + a.name.replace(/<[^>]+>/g, '') + '’s full story on Petfinder →') : null,
					el('span', { className: 'btn apply-for' }, adopted ? 'Meet who’s still waiting' : 'Apply for ' + a.name.replace(/<[^>]+>/g, '')))),
			open ? el(Picker, { currentId: a.petId, onPick: pick, onClose: function () { setOpen(false); } }) : null);
	}

	wp.blocks.registerBlockType('lfar/featured-pet', { edit: Edit, save: function () { return null; } });
})(window.wp);
