(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){[].forEach.call(document.querySelectorAll('[class*="lfar-anim-"]'),function(el){var m=el.className.match(/\blfar-anim-([\w-]+)/);if(m&&!el.dataset.anim)el.dataset.anim=m[1];});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(function(){setTimeout(go,150)});return true}return false}window.addEventListener("load",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

(function(){
  // mobile menu
  var burger=document.getElementById('burger'), menu=document.getElementById('menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});

  // back to top
  var toTop=document.getElementById('toTop');
  function onScroll(){toTop.classList.toggle('show',window.scrollY>500);}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  toTop.addEventListener('click',function(e){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});

  // scroll-in animations (content stays visible if this never runs)
  if(!('IntersectionObserver' in window)) return;
  var els=[].slice.call(document.querySelectorAll('[data-anim]'));
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){var el=en.target;el.classList.add('run',el.dataset.anim);io.unobserve(el);}
    });
  },{rootMargin:'0px 0px 8% 0px'});
  els.forEach(function(el){
    var r=el.getBoundingClientRect();
    if(r.top<window.innerHeight) return; // already on screen at load: leave at rest
    io.observe(el);
  });
})();

// About map hero: rotate the neighborhood labels (see about.css). Los Feliz (.anchor) stays.
(function(){
  var hero=document.querySelector('.about-map-hero'); if(!hero) return;
  var chips=[].slice.call(hero.querySelectorAll('.places li:not(.anchor)'));
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){
    [0,1,4].forEach(function(i){if(chips[i])chips[i].classList.add('on');}); return;
  }
  var STEP=2000, SHOW=6000, LOOP=chips.length*STEP;
  function start(){
    chips.forEach(function(c,i){
      function cycle(){c.classList.add('on');setTimeout(function(){c.classList.remove('on');},SHOW);}
      setTimeout(function(){cycle();setInterval(cycle,LOOP);},1800+i*STEP);
    });
  }
  (function wait(){if(hero.classList.contains('go'))start();else setTimeout(wait,100);})();
})();
