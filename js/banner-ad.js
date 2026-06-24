// ─── Banner Ad Config ─────────────────────────────────────────────────────────
// Each slide has three image variants:
//   h = horizontal banner  (homeBannerAd, gameBottomAd)
//   v = vertical banner    (gameSideAd)
//   s = square tile        (in-grid ad tiles)
window.BANNER_SLIDES = [
	{
		h:    '/assets/my_nordh.png',
		v:    '/assets/my_nordv.png',
		s:    '/assets/my_nords.png',
		href: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=148634',
		duration: 7500,
	},
	{
		h:    '/assets/my_linkh.png',
		v:    '/assets/my_linkv.png',
		s:    '/assets/my_links.png',
		href: 'https://links.catclass.space',
		duration: 7500,
	},
	{
		h:    '/assets/my_discordh.png',
		v:    '/assets/my_discordv.png',
		s:    '/assets/my_discords.png',
		href: 'https://discord.catclass.org',
		duration: 5000,
	}
];

// Which image variant each container uses
const BANNER_VARIANT = {
	homeBannerAd: 'h',
	gameBottomAd: 'h',
	gameSideAd:   'v',
};

// IDs to watch for and auto-init
const BANNER_TARGET_IDS = ['homeBannerAd', 'gameBottomAd', 'gameSideAd'];

// ─── Token URL helper ─────────────────────────────────────────────────────────
// Appends ?token= to classroom15x.net URLs so the cross-domain handoff works.
// Other domains are left untouched (no token leakage).
function _stampToken(url) {
	const token = window.CATCLASS_TOKEN || localStorage.getItem('api_token') || '';
	if (!token) return url;
	try {
		const u = new URL(url);
		if (u.hostname.endsWith('classroom15x.net')) {
			u.searchParams.set('token', token);
			return u.toString();
		}
	} catch (_) {}
	return url;
}

// ─── Shared rotation engine ───────────────────────────────────────────────────

function _startRotation(img, anchor, slides, variant) {
	let current = 0;
	let timer = null;

	function showSlide(i) {
		const slide = slides[i % slides.length];
		img.style.opacity = '0';
		setTimeout(() => {
			img.src = slide[variant] || slide.h;
			anchor.href = _stampToken(slide.href);
			img.style.opacity = '1';
			clearTimeout(timer);
			timer = setTimeout(() => showSlide(++current), slide.duration ?? 5000);
		}, 400);
	}

	showSlide(0);
	return function stop() { clearTimeout(timer); };
}

// ─── Banner containers (home / game side & bottom) ────────────────────────────

function initBannerAd(container, slides) {
	if (window.__ADS_ENABLED__ === false) return;
	if (!container || container.dataset.bannerInit) return;
	if (!slides || !slides.length) return;
	container.dataset.bannerInit = '1';

	const isAdaptive = container.id === 'gameSideAd';

	container.innerHTML = '';

	const a = document.createElement('a');
	a.target = '_blank';
	a.rel = 'noopener noreferrer';
	a.style.cssText = 'display:block;width:100%;height:100%;';

	const img = document.createElement('img');
	img.alt = 'Advertisement';
	img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;transition:opacity 0.45s ease;';

	a.appendChild(img);
	container.appendChild(a);

	function getVariant() {
		if (!isAdaptive) return BANNER_VARIANT[container.id] || 'h';
		return container.offsetWidth > container.offsetHeight ? 'h' : 'v';
	}

	let stopFn = _startRotation(img, a, slides, getVariant());

	if (isAdaptive && typeof ResizeObserver !== 'undefined') {
		let lastVariant = getVariant();
		new ResizeObserver(() => {
			const v = getVariant();
			if (v !== lastVariant) {
				lastVariant = v;
				stopFn();
				stopFn = _startRotation(img, a, slides, v);
			}
		}).observe(container);
	}
}

// ─── Grid ad tiles (injected into the games list on /g) ──────────────────────

window.createAdTile = function () {
	if (window.__ADS_ENABLED__ === false) return null;
	const slides = window.BANNER_SLIDES || [];
	if (!slides.length) return null;

	const a = document.createElement('a');
	a.className = 'gameAnchor';
	a.target = '_blank';
	a.rel = 'noopener noreferrer';
	if (Math.random() < 0.3) a.dataset.big = '1';

	const img = document.createElement('img');
	img.alt = 'Ad';
	img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;transition:opacity 0.45s ease;';

	const badge = document.createElement('span');
	badge.className = 'gameTitle';
	badge.textContent = 'Ad';
	badge.style.cssText = 'font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.5;padding-bottom:6px;';

	a.appendChild(img);
	a.appendChild(badge);

	_startRotation(img, a, slides, 's'); // always square variant in the grid

	return a;
};

// ─── Auto-init banner containers ─────────────────────────────────────────────

function tryInit(id) {
	const el = document.getElementById(id);
	if (el && !el.dataset.bannerInit) initBannerAd(el, window.BANNER_SLIDES);
}

function startWatcher() {
	BANNER_TARGET_IDS.forEach(tryInit);
	const observer = new MutationObserver(() => BANNER_TARGET_IDS.forEach(tryInit));
	observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Premium / ad-free check ──────────────────────────────────────────────────
// Reads the api_token from localStorage (same key used by the settings page),
// asks core.catclass.org whether the user has ad-free active, then either
// starts the ad system or leaves __ADS_ENABLED__ = false so every ad
// entry-point silently bails out.
//
// __ADS_ENABLED__ tri-state:
//   undefined → check still in-flight (createAdTile / initBannerAd default to showing)
//   true      → confirmed not ad-free → show ads
//   false     → confirmed ad-free    → suppress all ads

(function initAds() {
	const token = window.CATCLASS_TOKEN || localStorage.getItem('api_token') || '';

	// Exposed so json-loader.js can await it before rendering ad tiles into the grid.
	// Resolves to true (ads on) or false (ad-free).
	window.__ADS_READY__ = new Promise(resolve => {
		function afterCheck(adFree) {
			window.__ADS_ENABLED__ = !adFree;
			if (!adFree) {
				if (document.readyState === 'loading') {
					document.addEventListener('DOMContentLoaded', startWatcher);
				} else {
					startWatcher();
				}
			}
			resolve(!adFree);
		}

		if (!token) { afterCheck(false); return; }

		fetch('https://core.catclass.org/check-premium.php?token=' + encodeURIComponent(token))
			.then(r => r.ok ? r.json() : null)
			.then(data => afterCheck(!!(data && data.adfree_active)))
			.catch(() => afterCheck(false)); // network error → show ads as fallback
	});
}());
