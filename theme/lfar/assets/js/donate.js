(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".rc-hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(go);return true}return false}document.addEventListener("DOMContentLoaded",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,4000);})();

(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  function money(v){return '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}

  // mobile menu and sticky offsets
  var burger=$('#burger'), menu=$('#menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});
  var nav=$('#navbar'), root=document.documentElement;
  function sizes(){var n=nav.offsetHeight;root.style.setProperty('--navh',n+'px');root.style.scrollPaddingTop=(n+12)+'px';}
  sizes();window.addEventListener('resize',sizes);window.addEventListener('load',sizes);

  // ---------- story: each step adds a line to Pepper's receipt ----------
  var steps=$$('#steps .step'), rlines=$$('#r-lines .rline'), chips=$$('#r-chips .rchip'), stamp=$('#stamp'), totalEl=$('#r-total'), miniNum=$('#mini-num');
  var shown=0, cur=0, tween=null;
  function tweenTotal(to){
    var from=shown, t0=null; if(tween) cancelAnimationFrame(tween);
    function step(t){ if(!t0) t0=t; var k=Math.min(1,(t-t0)/600), e=1-Math.pow(1-k,3), v=Math.round(from+(to-from)*e);
      totalEl.textContent=money(v); miniNum.textContent=money(v); shown=v; if(k<1) tween=requestAnimationFrame(step); }
    tween=requestAnimationFrame(step);
  }
  function setStep(i){
    if(i===cur) return; var up=i>cur; cur=i; var sum=0;
    steps.forEach(function(s){s.classList.toggle('active',+s.dataset.i===i);});
    rlines.forEach(function(l){ var on=+l.dataset.i<=i; if(on&&!l.classList.contains('on')&&up){l.classList.add('fresh');setTimeout(function(){l.classList.remove('fresh')},1200);} l.classList.toggle('on',on); if(on) sum+=(+l.dataset.v||0); });
    chips.forEach(function(c){ var line=rlines.filter(function(l){return l.dataset.v===c.dataset.v})[0]; c.classList.toggle('on',!!line&&+line.dataset.i<=i); });
    stamp.classList.toggle('on',i>=6);
    tweenTotal(sum);
  }
  function pickStep(){
    var line=window.innerHeight*.72, idx=0;
    steps.forEach(function(st){ if(st.getBoundingClientRect().top<line) idx=+st.dataset.i; });
    setStep(idx);
  }
  var sticking=false; window.addEventListener('scroll',function(){ if(!sticking){ sticking=true; requestAnimationFrame(function(){ pickStep(); sticking=false; }); } },{passive:true});
  window.addEventListener('resize',pickStep); pickStep();

  // ---------- form + "next receipt" preview ----------
  var COST=[['Food and bedding',10],['Vaccines',25],['Exam and microchip',50],['Spay or neuter surgery',100],['Dewormer, flea care, follow-up',65]];
  var amts=$$('.amt'), other=$('#other-amount'), btn=$('#give-btn'), freq='once', val=25;
  var covLines=$('#cov-lines'), covSum=$('#cov-summary'), covTotal=$('#cov-total');
  covLines.innerHTML=COST.map(function(c,i){return '<li class="rline on" data-k="'+i+'"><div><div class="row"><span class="lbl">'+c[0]+'</span><span class="ramt">$'+c[1]+'.00</span><span class="bar"><i></i></span></div></div></li>';}).join('');
  var bars=$$('#cov-lines .bar i');
  function render(){
    var yearly=freq==='monthly'?val*12:val, whole=Math.floor(yearly/250), rest=yearly-whole*250, left=rest;
    btn.textContent=val?('Give $'+val+(freq==='monthly'?' a month':'')):'Give';
    covTotal.textContent=money(yearly)+(freq==='monthly'?'/yr':'');
    var covered=[];
    COST.forEach(function(c,i){ var f=whole?1:Math.max(0,Math.min(1,left/c[1])); if(!whole){ left-=Math.min(left,c[1]); } bars[i].style.width=(f*100)+'%'; if(f>=1) covered.push(c[0].toLowerCase()); });
    var msg;
    if(!val) msg='Pick an amount to see what it covers.';
    else if(whole>=1) msg=(freq==='monthly'?'$'+val+' a month':'$'+val)+' pays for '+(whole===1?'one whole rescue':whole+' whole rescues')+(freq==='monthly'?' a year':'')+(rest>=10?', plus part of the next.':'.');
    else if(covered.length) msg=(freq==='monthly'?'$'+val+' a month covers ':'Your $'+val+' covers ')+covered.join(', ').replace(/, ([^,]*)$/,' and $1')+(freq==='monthly'?' each year.':'.');
    else msg='Your $'+val+' goes toward '+COST[0][0].toLowerCase()+'.';
    covSum.textContent=msg;
  }
  function setAmount(v){ val=v; other.value=''; amts.forEach(function(x){x.setAttribute('aria-pressed',+x.dataset.v===v)}); if(!amts.some(function(x){return +x.dataset.v===v})) other.value=v; render(); }
  function setFreq(f){ freq=f; $$('.freq button').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.f===f)}); render(); }
  amts.forEach(function(b){b.addEventListener('click',function(){setAmount(+b.dataset.v);});});
  other.addEventListener('input',function(){var v=other.value.replace(/[^0-9.]/g,'');other.value=v;amts.forEach(function(x){x.setAttribute('aria-pressed','false')});val=Math.round(+v)||0;render();});
  $$('.freq button').forEach(function(b){b.addEventListener('click',function(){setFreq(b.dataset.f);});});
  $('#suggest').addEventListener('click',function(){setFreq('monthly');setAmount(21);});
  $('#trib').addEventListener('change',function(e){$('#trib-name').hidden=!e.target.checked;});
  $('#donate-form').addEventListener('submit',function(e){e.preventDefault();$('#give-note').textContent=val?'Thank you! On the live site, Donorbox takes it from here. (Mockup: nothing is charged.)':'Pick or enter an amount first.';});
  render();

  // "Pick your line" cards and anchors send their amount to the form
  var picks=$$('.pick');
  picks.forEach(function(p){p.addEventListener('click',function(){picks.forEach(function(x){x.setAttribute('aria-pressed',x===p)});setFreq('once');setAmount(+p.dataset.v);$('#give').scrollIntoView({behavior:'smooth'});});});
  $$('.anchor').forEach(function(a){a.addEventListener('click',function(){picks.forEach(function(x){x.setAttribute('aria-pressed','false')});setFreq(a.dataset.f);setAmount(+a.dataset.v);$('#give').scrollIntoView({behavior:'smooth'});});});

  // count-up
  if('IntersectionObserver' in window){
    var cio=new IntersectionObserver(function(es){es.forEach(function(en){
      if(!en.isIntersecting) return; var el=en.target; cio.unobserve(el);
      var end=+el.dataset.count, suf=el.dataset.suffix||'', t0=null;
      function step(t){ if(!t0) t0=t; var k=Math.min(1,(t-t0)/1600), e=1-Math.pow(1-k,3); el.textContent=Math.round(end*e)+(k===1?suf:''); if(k<1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });},{threshold:.4});
    $$('[data-count]').forEach(function(el){ if(el.getBoundingClientRect().top>window.innerHeight) cio.observe(el); });
  }

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
    entries.forEach(function(en){ if(en.isIntersecting){var el=en.target;el.classList.add('run',el.dataset.anim);io.unobserve(el);} });
  },{rootMargin:'0px 0px -8% 0px'});
  $$('[data-anim]').forEach(function(el){ if(el.getBoundingClientRect().top<window.innerHeight){ el.classList.add('run'); return; } io.observe(el); });
})();
