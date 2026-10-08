(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(function(){setTimeout(go,150)});return true}return false}window.addEventListener("load",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

(function(){
  // mobile menu
  var burger=document.getElementById('burger'), menu=document.getElementById('menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});

  // donate widget
  var amts=[].slice.call(document.querySelectorAll('.amt')), give=document.getElementById('give'), other=document.getElementById('other-amount');
  function setLabel(v){give.textContent=v?('Donate $'+v):'Donate';}
  amts.forEach(function(b){b.addEventListener('click',function(){amts.forEach(function(x){x.setAttribute('aria-pressed',x===b)});other.value='';setLabel(b.dataset.v);});});
  other.addEventListener('input',function(){var v=other.value.replace(/[^0-9.]/g,'');other.value=v;amts.forEach(function(x){x.setAttribute('aria-pressed','false')});setLabel(v);});

  // newsletter (mockup: no data is sent)
  var nf=document.getElementById('nl-form'), ne=document.getElementById('nl-email'), nn=document.getElementById('nl-note');
  nf.addEventListener('submit',function(e){e.preventDefault();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne.value.trim())){nn.className='nl-note';nn.textContent='Enter an email address like name@example.com.';ne.focus();return;}
    nn.className='nl-note ok';nn.textContent='Thanks! You\'re signed up.';ne.value='';});

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
