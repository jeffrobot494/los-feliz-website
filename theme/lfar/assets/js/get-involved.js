(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(function(){setTimeout(go,150)});return true}return false}window.addEventListener("load",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

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

  // role checkboxes
  var boxes=$$('input[name="role"]');
  function box(v){return boxes.filter(function(b){return b.value===v})[0];}

  // conditional follow-ups
  function cond(key,on){var c=$('.cond[data-for="'+key+'"]');if(c)c.classList.toggle('open',on);}
  boxes.forEach(function(b){b.addEventListener('change',function(){cond('vet',box('vet').checked);setErr('err-role','');});});
  $('#v-foster').addEventListener('change',function(){cond('foster',this.checked);});

  // sign-up form (mockup: nothing is sent)
  var form=$('#vol-form'), body=$('#form-body'), thanks=$('#thanks');
  function setErr(id,msg){var e=$('#'+id);e.textContent=msg;e.hidden=!msg;}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var first=$('#v-first').value.trim(), email=$('#v-email').value.trim(), picked=boxes.some(function(b){return b.checked}), bad=null;
    if(!first){setErr('err-first','Add your first name so we know who to ask for.');bad=bad||'#v-first';} else setErr('err-first','');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){setErr('err-email','Enter an email address like name@example.com so we can reach you.');bad=bad||'#v-email';} else setErr('err-email','');
    if(!picked){setErr('err-role','Pick at least one, or choose "Not sure yet".');bad=bad||'#role-opts input';} else setErr('err-role','');
    if(bad){$(bad).focus();return;}
    if($('#v-website').value)return;
    $('#thanks-text').textContent='Thanks, '+first+'. A confirmation is on its way to '+email+', and a volunteer coordinator will reach out within a week.';
    body.hidden=true;thanks.hidden=false;
    form.scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('#again').addEventListener('click',function(){thanks.hidden=true;body.hidden=false;$('#v-first').focus();});

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
