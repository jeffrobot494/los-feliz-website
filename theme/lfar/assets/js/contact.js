(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(function(){setTimeout(go,150)});return true}return false}window.addEventListener("load",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

  // mobile menu and sticky offsets
  var burger=$('#burger'), menu=$('#menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});
  var nav=$('#navbar'), root=document.documentElement;
  function sizes(){var n=nav.offsetHeight;root.style.setProperty('--navh',n+'px');root.style.scrollPaddingTop=(n+12)+'px';}
  sizes();window.addEventListener('resize',sizes);window.addEventListener('load',sizes);

  // copy email
  var cb=$('#copy-email'), et=$('#email-text');
  cb.addEventListener('click',function(){
    function done(){cb.textContent='Copied';setTimeout(function(){cb.textContent='Copy'},1800);}
    function fallback(){var r=document.createRange();r.selectNodeContents(et);var s=window.getSelection();s.removeAllRanges();s.addRange(r);cb.textContent='Selected';setTimeout(function(){cb.textContent='Copy'},1800);}
    try{navigator.clipboard.writeText(et.textContent.trim()).then(done,fallback);}catch(e){fallback();}
  });

  // topic -> conditional follow-up
  var conds=$$('.cond');
  function showTopic(v){conds.forEach(function(c){c.classList.toggle('open',c.dataset.for===v)});}
  $$('input[name="topic"]').forEach(function(r){r.addEventListener('change',function(){showTopic(r.value)});});

  // contact form (mockup: nothing is sent)
  var form=$('#contact-form'), body=$('#form-body'), thanks=$('#thanks');
  function setErr(id,msg){var e=$('#'+id);e.textContent=msg;e.hidden=!msg;}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var email=$('#c-email').value.trim(), msg=$('#c-msg').value.trim(), ok=true;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){setErr('err-email','Enter an email address like name@example.com so we can reply.');ok=false;} else setErr('err-email','');
    if(msg.length<5){setErr('err-msg','Add a few words so we know how to help.');ok=false;} else setErr('err-msg','');
    if(!ok){(email&&ok)||$(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)?'#c-email':'#c-msg').focus();return;}
    if($('#c-website').value){return;}
    var name=$('#c-first').value.trim();
    $('#thanks-text').textContent=(name?'Thanks, '+name+'. ':'Thanks! ')+'A copy is on its way to '+email+', and a volunteer will reply within 2–3 days.';
    body.hidden=true;thanks.hidden=false;
    form.scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('#again').addEventListener('click',function(){thanks.hidden=true;body.hidden=false;$('#c-msg').value='';$('#c-msg').focus();});

  // newsletter (mockup: no data is sent)
  var nf=$('#nl-form'), ne=$('#nl-email'), nn=$('#nl-note');
  nf.addEventListener('submit',function(e){e.preventDefault();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne.value.trim())){nn.className='nl-note';nn.textContent='Enter an email address like name@example.com.';ne.focus();return;}
    nn.className='nl-note ok';nn.textContent='Thanks! You\'re signed up.';ne.value='';});

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
