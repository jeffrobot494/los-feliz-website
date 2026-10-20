// LFAR's adoptable animals from Petfinder, for the Featured pet block (the editor's picker and the front end's "Adopted!" check).
//
// Petfinder retired its public API in December 2025. This is the data feed behind Petfinder's own pet list widget
// (the <pet-scroller> on the Adopt page). It isn't documented, so keep the query in the same shape as the widget's:
// the feed refuses requests it doesn't recognize, and a query with an unknown field is refused outright.
window.lfarPetfinder = (function () {
	var ENDPOINT = 'https://psl.petfinder.com/graphql';
	var ORG = '6e34d75b-3e29-4c83-a4ed-b0e626926ea1'; // LFAR, Petfinder org CA3083
	var PHOTOS = 'https://dbw3zep4prcju.cloudfront.net/';
	var SITE = 'https://www.petfinder.com/';
	var QUERY = 'query SearchAnimal($pagination: PaginationInfoInput!, $filters: AnimalSearchFiltersInput!)\n { searchAnimal(pagination: $pagination\n   sort: { field: "animal_type", order: "desc" } filters: $filters) { \ntotalCount\nanimals { \n    animalId \n    animalName\n    animalType\n    description\n    behavior { houseTrained }\n    primaryPhotoId\n    \n    physical {\n       size {\n        label\n       }\n       breed {\n         primary\n         mixed\n       }\n       age { label value }\n       sex\n    } \n      publicUrl {\n        url\n      }\n } } }';
	var PAGE_SIZE = 100;

	var cached = null;

	// { pets: [...], complete: false if LFAR has more animals than one request returns }
	function fetchPets() {
		if (cached) return cached;
		cached = fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: QUERY,
				variables: {
					isConsumer: true,
					filters: { breeds: [], size: [], sex: [], age: [], adoption_status: 'adoptable', organization_id: [ORG] },
					pagination: { fromPage: 0, pageSize: PAGE_SIZE }
				}
			})
		}).then(function (r) {
			if (!r.ok) throw new Error('Petfinder answered ' + r.status);
			return r.json();
		}).then(function (d) {
			var res = d.data.searchAnimal;
			return { pets: res.animals.map(toPet), complete: res.animals.length >= res.totalCount };
		});
		cached.catch(function () { cached = null; }); // let the next call try again
		return cached;
	}

	// A Petfinder animal as the block's attributes. Every value comes from the listing; only the wording around it is ours.
	function toPet(a) {
		var p = a.physical || {};
		var type = a.animalType || 'Pet';
		var age = (p.age && p.age.label) || '';
		var baby = p.age && p.age.value === 'Baby';
		var breed = p.breed && p.breed.primary ? p.breed.primary + (p.breed.mixed ? ' mix' : '') : '';
		var name = (a.animalName || '').replace(/\s*\((m|f|male|female)\)\s*$/i, '').trim();
		var bullets = [];
		if (breed) bullets.push(breed);
		if (p.size && p.size.label) bullets.push(p.size.label + ' size');
		if (a.behavior && a.behavior.houseTrained === 'Yes') bullets.push(type === 'Cat' ? 'Litter-trained' : 'House-trained');
		return {
			petId: a.animalId,
			name: name,
			type: type,
			kind: type === 'Dog' ? (baby ? 'puppy' : 'dog') : type === 'Cat' ? (baby ? 'kitten' : 'cat') : 'other',
			facts: [type, age, p.sex].filter(Boolean).join(' · '),
			blurb: blurb(a.description || ''),
			bullets: bullets,
			photo: a.primaryPhotoId ? PHOTOS + a.primaryPhotoId : '',
			alt: name + ', ' + (breed ? article(breed) + ' ' + breed + ' ' + type.toLowerCase() : article(type) + ' ' + type.toLowerCase()),
			url: a.publicUrl && a.publicUrl.url ? SITE + a.publicUrl.url : ''
		};
	}

	function article(w) { return /^[aeiou]/i.test(w) ? 'an' : 'a'; }

	// The opening of the description, cut at a sentence end. Skips a headline first line like "Kairo: The Ultimate Lap Cat!".
	function blurb(text) {
		var paras = text.split(/\n\s*\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
		if (paras.length > 1 && paras[0].length < 80 && !/[.!?]["”’)]?\s+\S/.test(paras[0])) paras.shift();
		var body = paras.join(' ');
		var sentences = body.match(/[^.!?]+[.!?]+["”’)]*\s*/g) || [body];
		var out = '';
		for (var i = 0; i < sentences.length; i++) {
			if (out && (out + sentences[i]).length > 300) break;
			out += sentences[i];
			if (out.length >= 160) break;
		}
		out = out.trim();
		if (out.length > 340) out = out.slice(0, 320).replace(/\s+\S*$/, '') + '…';
		return out;
	}

	// true / false, or null when it can't tell (Petfinder unreachable, or more animals than one request returns)
	function isAdopted(petId) {
		return fetchPets().then(function (res) {
			var listed = res.pets.some(function (x) { return x.petId === petId; });
			return listed ? false : res.complete ? true : null;
		}, function () { return null; });
	}

	return { fetchPets: fetchPets, isAdopted: isAdopted };
})();
