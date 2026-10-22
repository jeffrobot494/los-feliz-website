(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){[].forEach.call(document.querySelectorAll('[class*="lfar-anim-"]'),function(el){var m=el.className.match(/\blfar-anim-([\w-]+)/);if(m&&!el.dataset.anim)el.dataset.anim=m[1];});})();
(function () {
  document.documentElement.classList.add('js');
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var img = hero.querySelector('.hero-bg img');
  hero.classList.add('image-pending');

  function reveal() {
    function showPanel() {
      hero.classList.remove('image-pending');
      hero.classList.add('go');
    }
    // Start the banner only when its image is ready, independently of page load.
    requestAnimationFrame(function () {
      if (!img || !img.naturalWidth) {
        showPanel();
        return;
      }
      hero.classList.add('image-ready');
      // CSS gives the banner a short head start, then overlaps the panel entrance.
      // Reduced motion disables both animations and their delay.
      showPanel();
    });
  }

  function ready() {
    img.removeEventListener('load', ready);
    img.removeEventListener('error', ready);
    // A failed image must not hide the page's message.
    if (img.naturalWidth && typeof img.decode === 'function') {
      img.decode().then(reveal, reveal);
    } else {
      reveal();
    }
  }

  if (!img) {
    reveal();
  } else if (img.complete) {
    ready();
  } else {
    img.addEventListener('load', ready);
    img.addEventListener('error', ready);
  }
})();

(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

  // mobile menu and sticky offsets
  var burger=$('#burger'), menu=$('#menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});
  var nav=$('#navbar'), root=document.documentElement, jb=$('.jumpbar');
  function sizes(){var n=nav.offsetHeight;root.style.setProperty('--navh',n+'px');root.style.scrollPaddingTop=(n+(jb?jb.offsetHeight:0)+12)+'px';}
  sizes();window.addEventListener('resize',sizes);window.addEventListener('load',sizes);

  // jump bar: highlight the section in view
  var links=$$('.jumpbar a'), secs=links.map(function(a){return $(a.getAttribute('href'))});
  function spy(){
    var y=nav.offsetHeight+jb.offsetHeight+40, cur=-1;
    secs.forEach(function(s,i){if(s&&s.getBoundingClientRect().top<=y)cur=i;});
    links.forEach(function(a,i){a.classList.toggle('on',i===cur);});
    if(cur>=0){var a=links[cur],ul=a.parentNode.parentNode;if(a.offsetLeft<ul.scrollLeft||a.offsetLeft+a.offsetWidth>ul.scrollLeft+ul.clientWidth)ul.scrollTo({left:a.offsetLeft-20,behavior:'smooth'});}
  }
  window.addEventListener('scroll',spy,{passive:true});spy();

  // feed: see more
  var sm=$('#see-more');
  sm.addEventListener('click',function(){var open=sm.getAttribute('aria-expanded')!=='true';
    $$('.more-post').forEach(function(p){p.hidden=!open;if(open)p.classList.add('run','fade-up');});
    sm.setAttribute('aria-expanded',open);sm.textContent=open?'Show fewer':'See more';});

  // back to top
  var toTop=$('#toTop');
  function onScroll(){toTop.classList.toggle('show',window.scrollY>500);}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  toTop.addEventListener('click',function(e){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});

  // scroll-in animations (content stays visible if this never runs)
  if(!('IntersectionObserver' in window)) return;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){var el=en.target; el.classList.add('run',el.dataset.anim); io.unobserve(el);} });
  },{rootMargin:'0px 0px -10% 0px'});
  $$('[data-anim]').forEach(function(el){ if(el.getBoundingClientRect().top<window.innerHeight) return; io.observe(el); });
})();
