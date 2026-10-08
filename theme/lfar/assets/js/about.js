(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(function(){setTimeout(go,150)});return true}return false}window.addEventListener("load",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

(function(){
  // mobile menu
  var burger=document.getElementById('burger'), menu=document.getElementById('menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});

  // newsletter (mockup: no data is sent)
  var nf=document.getElementById('nl-form'), ne=document.getElementById('nl-email'), nn=document.getElementById('nl-note');
  nf.addEventListener('submit',function(e){e.preventDefault();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne.value.trim())){nn.className='nl-note';nn.textContent='Enter an email address like name@example.com.';ne.focus();return;}
    nn.className='nl-note ok';nn.textContent='Thanks! You\'re signed up.';ne.value='';});

  // count-up stats (final values are already in the HTML)
  var nums=[].slice.call(document.querySelectorAll('.stat-num[data-count]'));
  if('IntersectionObserver' in window){
    var cio=new IntersectionObserver(function(es){es.forEach(function(en){
      if(!en.isIntersecting) return; var el=en.target; cio.unobserve(el);
      var end=+el.dataset.count, pre=el.dataset.prefix||'', suf=el.dataset.suffix||'', t0=null, dur=1600;
      function step(t){ if(!t0) t0=t; var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
        el.textContent=pre+Math.round(end*e)+(p===1?suf:''); if(p<1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });},{threshold:.4});
    nums.forEach(function(el){ if(el.getBoundingClientRect().top>window.innerHeight) cio.observe(el); });
  }

  // feed: "See more" reveals the next six posts (mockup; live site would load them from the feed)
  var more=document.getElementById('see-more');
  if(more){more.addEventListener('click',function(){
    var hidden=[].slice.call(document.querySelectorAll('.more-post[hidden]')).slice(0,6);
    hidden.forEach(function(c){c.hidden=false;c.classList.add('reveal');});
    if(hidden[0]){var l=hidden[0].querySelector('a');if(l)l.focus({preventScroll:true});}
    if(!document.querySelector('.more-post[hidden]')){more.hidden=true;more.setAttribute('aria-expanded','true');}
  });}

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
