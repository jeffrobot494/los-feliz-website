(function(){var p=location.pathname.replace(/\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),function(a){var h;try{h=new URL(a.href).pathname.replace(/\/?$/,'/')}catch(e){return}if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();
(function(){var d=document.documentElement;d.classList.add("js");function go(){var h=document.querySelector(".hero");if(h)h.classList.add("go");}function tryGo(){if(document.visibilityState==="visible"){requestAnimationFrame(go);return true}return false}document.addEventListener("DOMContentLoaded",function(){if(!tryGo())document.addEventListener("visibilitychange",function v(){if(tryGo())document.removeEventListener("visibilitychange",v)})});setTimeout(go,6000);})();

(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

  // mobile menu
  var burger=$('#burger'), menu=$('#menu');
  burger.addEventListener('click',function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Close menu':'Open menu');});
  menu.addEventListener('click',function(e){if(e.target.tagName==='A'){menu.classList.remove('open');burger.setAttribute('aria-expanded','false');}});
  var nav=$('#navbar'), root=document.documentElement;
  function sizes(){var n=nav.offsetHeight;root.style.setProperty('--navh',n+'px');root.style.scrollPaddingTop=(n+12)+'px';}
  sizes();window.addEventListener('resize',sizes);window.addEventListener('load',sizes);

  // hero: a busy woman racing past the baker, her kid and her boss
  (function(){
    var cv=$('#city'), ctx=cv.getContext('2d'), card=$('.night-card');
    var W,H,dpr,s,ox,oy,running=true,prev=0,T=0;
    var SKIN={her:'#E8B48F',baker:'#A8703F',kid:'#E8B48F',boss:'#F0CDB0'};
    var GROUND=490, WALK=532, SPEED=175;
    var st, clouds=[{x:.1,y:.12,r:1},{x:.45,y:.07,r:.8},{x:.8,y:.16,r:1.2}];
    var SW=1232, HOME=1058, mobile=false, vw=SW, cam=0;
    function reset(){ st={x:-90,bread:false,kid:false,papers:false,spin:-9,flying:[],puffs:[],done:0,lastPuff:0,t:{},ph:0,v:SPEED,arrived:0,hearts:[]}; }
    function start(){ reset();
      st.x=70; }
    start(); // first frame already shows her on her way

    function size(){
      dpr=Math.min(window.devicePixelRatio||1,2); W=cv.clientWidth; H=cv.clientHeight;
      cv.width=W*dpr; cv.height=H*dpr;
      var x0=0;
      if(W>=992){ var ct=card.parentElement, cs=getComputedStyle(ct); x0=ct.getBoundingClientRect().left-cv.getBoundingClientRect().left+parseFloat(cs.paddingLeft)+card.offsetWidth+30; }
      var m=(W-x0-10)/SW<.55;
      if(m){ s=H/560; vw=W/s; oy=0; } else { s=Math.min((W-x0-10)/SW,(H-20)/560); ox=x0+((W-x0)-SW*s)/2; oy=H-560*s; }
      if(m!==mobile){ mobile=m; start(); }
    }
    function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);ctx.fillStyle=fill;ctx.fill();}
    function circ(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
    function limb(x1,y1,x2,y2,w,col){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=w;ctx.lineCap='round';ctx.strokeStyle=col;ctx.stroke();}
    function leg(hx,hy,a,len,w,col,shoe){ // two-segment running leg
      var kx=hx+Math.sin(a)*len*.55, ky=hy+Math.cos(a)*len*.55;
      var fx=kx+Math.sin(a-Math.abs(a)*.9-.25)*len*.5, fy=ky+Math.cos(a-Math.abs(a)*.9-.25)*len*.5;
      limb(hx,hy,kx,ky,w,col); limb(kx,ky,fx,fy,w*.9,col); limb(fx,fy,fx+6,fy,w*.9,shoe);
    }
    function text(t,x,y,size,col,align){ctx.font='700 '+size+'px Quicksand, "Varela Round", system-ui, sans-serif';ctx.fillStyle=col;ctx.textAlign=align||'center';ctx.textBaseline='middle';ctx.fillText(t,x,y);}
    function bubble(t,x,y,a){
      if(a<=0) return; ctx.save(); ctx.globalAlpha=Math.min(1,a); var k=.6+.4*Math.min(1,a);
      ctx.translate(x,y); ctx.scale(k,k);
      ctx.font='700 17px Quicksand, system-ui, sans-serif'; var w=ctx.measureText(t).width+28;
      ctx.shadowColor='rgba(60,0,80,.18)'; ctx.shadowBlur=10; rr(-w/2,-40,w,34,17,'#fff'); ctx.shadowBlur=0;
      ctx.beginPath(); ctx.moveTo(-6,-7); ctx.lineTo(4,-7); ctx.lineTo(-4,4); ctx.fill();
      text(t,0,-23,17,'#675444'); ctx.restore();
    }

    // ---------- scenery ----------
    function sky(){
      var g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#EBD3F5'); g.addColorStop(1,'#FFE7D6');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      circ(W*.9,H*.2,Math.min(70,H*.1),'rgba(255,214,120,.55)');
      clouds.forEach(function(c){ var x=((c.x+T*.006*c.r)%1.2-.1)*W, y=c.y*H, r=26*c.r;
        ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.arc(x+r,y-r*.5,r*1.1,0,7); ctx.arc(x+r*2,y,r*.9,0,7); ctx.fill(); });
      ctx.fillStyle='#E4D6EA'; ctx.fillRect(0,oy+GROUND*s,W,H); // sidewalk
      ctx.fillStyle='#CFBFD8'; ctx.fillRect(0,oy+GROUND*s,W,3*s);
      ctx.strokeStyle='rgba(160,130,175,.35)'; ctx.lineWidth=1.5;
      for(var x=(ox%(70*s));x<W;x+=70*s){ctx.beginPath();ctx.moveTo(x,oy+(GROUND+8)*s);ctx.lineTo(x-14*s,H);ctx.stroke();}
    }
    function tree(x){ rr(x-5,GROUND-60,10,60,3,'#8A5A3C'); circ(x,GROUND-78,30,'#7FC08A'); circ(x-18,GROUND-62,20,'#6FB27B'); circ(x+18,GROUND-64,22,'#8CCB95'); }
    function bakery(){
      rr(70,300,220,190,6,'#FCE3D3');
      rr(96,266,168,34,8,'#7A3E2A'); text('BAKERY',180,284,20,'#FFF');
      for(var i=0;i<8;i++){ ctx.fillStyle=i%2?'#FFFFFF':'#E0609A'; ctx.beginPath(); ctx.moveTo(70+i*27.5,318); ctx.lineTo(97.5+i*27.5,318); ctx.lineTo(97.5+i*27.5,344); ctx.arc(83.75+i*27.5,344,13.75,0,Math.PI); ctx.fill(); }
      rr(88,370,120,74,6,'#FFF4E3'); rr(88,416,120,5,2,'#C9A27E');
      [[112,408],[146,406],[180,409]].forEach(function(p){ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-.15);ctx.beginPath();ctx.ellipse(0,0,15,7,0,0,7);ctx.fillStyle='#D8964F';ctx.fill();ctx.restore();});
      circ(126,393,9,'#E6A95E'); circ(168,392,10,'#C98443');
      rr(224,380,46,110,5,'#B85C7A'); circ(262,436,3,'#FCE3D3');
    }
    function school(){
      rr(370,280,240,210,6,'#E48A6C');
      ctx.fillStyle='#C9634A'; ctx.beginPath(); ctx.moveTo(430,282); ctx.lineTo(490,226); ctx.lineTo(550,282); ctx.fill();
      circ(490,258,19,'#FFF'); circ(490,258,19,'rgba(0,0,0,0)');
      ctx.lineWidth=2; ctx.strokeStyle='#675444'; ctx.beginPath(); ctx.arc(490,258,19,0,7); ctx.stroke();
      var a1=T*6, a2=T*.8; limb(490,258,490+Math.sin(a1)*14,258-Math.cos(a1)*14,2.5,'#B209D7'); limb(490,258,490+Math.sin(a2)*9,258-Math.cos(a2)*9,3.5,'#675444');
      rr(420,292,140,26,6,'#FFF'); text('SCHOOL',490,305,18,'#C9634A');
      [[388,334],[436,334],[514,334],[562,334],[388,392],[562,392]].forEach(function(p){rr(p[0],p[1],34,38,4,'#FFF1C9');limb(p[0]+17,p[1],p[0]+17,p[1]+38,2,'#E48A6C');});
      rr(462,408,56,82,6,'#8B3A26'); rr(454,484,72,8,2,'#C9634A');
      limb(600,280,600,236,3,'#8A5A3C'); ctx.fillStyle='#B209D7'; ctx.beginPath(); ctx.moveTo(600,236); ctx.lineTo(600+22+Math.sin(T*6)*4,244); ctx.lineTo(600,252); ctx.fill();
    }
    function office(){
      rr(700,170,210,320,6,'#8E9CC7');
      rr(730,184,150,28,6,'#5B6A9A'); text('OFFICE',805,198,18,'#FFF');
      for(var r=0;r<5;r++)for(var c=0;c<4;c++) rr(722+c*46,226+r*38,32,24,3,(r*4+c)%5===2?'#FFE08A':'#DDE6FF');
      rr(778,420,54,70,5,'#4B5680'); limb(805,420,805,490,2,'#8E9CC7');
    }

    function home(){
      rr(1004,470,196,20,3,'#C9A27E'); rr(1004,466,196,6,2,'#B0885F'); // porch
      rr(1016,340,172,130,6,'#F6E6FB');
      ctx.fillStyle='#71018A'; ctx.beginPath(); ctx.moveTo(996,346); ctx.lineTo(1102,262); ctx.lineTo(1208,346); ctx.closePath(); ctx.fill();
      rr(1150,272,20,40,3,'#5A0070');
      rr(1032,370,54,44,5,'#FFD27A'); limb(1059,370,1059,414,3,'#F6E6FB'); limb(1032,392,1086,392,3,'#F6E6FB');
      rr(1136,392,40,78,6,'#B209D7'); circ(1168,432,3,'#F6E6FB');
      ctx.fillStyle='#71018A'; ctx.beginPath(); ctx.moveTo(1156,376); ctx.bezierCurveTo(1150,368,1140,376,1156,386); ctx.bezierCurveTo(1172,376,1162,368,1156,376); ctx.fill(); // heart over the door
      rr(1040,448,34,18,4,'#C9634A'); circ(1048,444,7,'#E0609A'); circ(1060,441,8,'#F2BE22'); circ(1070,445,6,'#E0609A'); // flowers
    }
    function dog(x,y){ // sits on the porch, facing the street
      var near=st.x>820, home=st.arrived>0;
      var b=home?Math.abs(Math.sin((T-st.arrived)*9))*10:0, wag=Math.sin(T*(near?26:9))*(near?9:5);
      ctx.save(); ctx.translate(x,y-b);
      limb(14,-10,28,-22+wag,5,'#C07F3E');                       // tail
      ctx.beginPath(); ctx.ellipse(4,-15,14,15,0,0,7); ctx.fillStyle='#D8964F'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(-3,-13,7,10,0,0,7); ctx.fillStyle='#F2D2A6'; ctx.fill();
      limb(-5,-6,-5,0,5,'#D8964F'); limb(3,-6,3,0,5,'#D8964F');
      circ(-4,-36,11,'#D8964F');
      ctx.beginPath(); ctx.ellipse(-14,-32,7,5,0,0,7); ctx.fillStyle='#F2D2A6'; ctx.fill();
      circ(-20,-34,2.6,'#3B2340');
      ctx.beginPath(); ctx.ellipse(3,-35,4.5,9,.35+(near?Math.sin(T*12)*.2:0),0,7); ctx.fillStyle='#B0733A'; ctx.fill(); // ear
      circ(-8,-39,1.8,'#3B2340');
      if(near){ ctx.beginPath(); ctx.ellipse(-15,-27,2.6,4,0,0,7); ctx.fillStyle='#E0609A'; ctx.fill(); } // happy tongue
      ctx.restore();
    }
    function street(){
      var cols=['#F3D9C8','#CFD6EE','#E9C9DD','#D8ECD9'];
      for(var i=0;i<7;i++){ var bx=300+i*104, bh=120+((i*53)%70);
        rr(bx,GROUND-bh,92,bh,6,cols[i%4]);
        for(var r=0;r<Math.floor((bh-30)/38);r++){ rr(bx+14,GROUND-bh+16+r*38,24,22,3,'#FFF6E0'); rr(bx+54,GROUND-bh+16+r*38,24,22,3,'#FFF6E0'); } }
      for(var t=330;t<990;t+=150) tree(t);
    }
    function heart(x,y,k,a){ ctx.save(); ctx.globalAlpha=Math.max(0,a); ctx.translate(x,y); ctx.scale(k,k); ctx.fillStyle='#E0609A';
      ctx.beginPath(); ctx.moveTo(0,4); ctx.bezierCurveTo(-12,-6,-6,-16,0,-8); ctx.bezierCurveTo(6,-16,12,-6,0,4); ctx.fill(); ctx.restore(); }

    // ---------- people ----------
    function baker(x,handing){
      leg(x-6,440,0,52,9,'#3B3B5C','#3B3B5C'); leg(x+6,440,0,52,9,'#3B3B5C','#3B3B5C');
      rr(x-18,378,36,66,12,'#4F7CC9'); rr(x-13,390,26,52,6,'#FFFFFF');
      circ(x,360,15,SKIN.baker);
      rr(x-12,332,24,18,4,'#FFF'); circ(x-9,332,9,'#FFF'); circ(x,327,10,'#FFF'); circ(x+9,332,9,'#FFF');
      circ(x+5,358,1.6,'#3B2340'); ctx.beginPath(); ctx.arc(x+2,364,4,.2,Math.PI-.2); ctx.strokeStyle='#3B2340'; ctx.lineWidth=1.6; ctx.stroke();
      limb(x+14,388,x+18,428,8,SKIN.baker);
      if(handing){ limb(x-14,388,x-46,398,8,SKIN.baker); ctx.save(); ctx.translate(x-52,393); ctx.rotate(-.5); ctx.beginPath(); ctx.ellipse(0,0,24,6.5,0,0,7); ctx.fillStyle='#D8964F'; ctx.fill(); ctx.restore(); }
      else { limb(x-14,388,x-30,370+Math.sin(T*10)*6,8,SKIN.baker); }
    }
    function kidFigure(x,g,run,armTo){
      var ph=st.ph*1.4, amp=Math.min(1,st.v/SPEED*1.3);
      if(run){ leg(x-3,g-38,Math.sin(ph)*.9*amp,40,7,'#4F7CC9','#E0609A'); leg(x+3,g-38,-Math.sin(ph)*.9*amp,40,7,'#4F7CC9','#E0609A'); }
      else { leg(x-4,g-38,0,40,7,'#4F7CC9','#E0609A'); leg(x+4,g-38,0,40,7,'#4F7CC9','#E0609A'); }
      rr(x-19,g-72,15,28,5,'#F2BE22'); // backpack
      rr(x-11,g-74,22,38,8,'#7FC08A');
      circ(x,g-86,11,SKIN.kid); ctx.beginPath(); ctx.arc(x,g-88,11,Math.PI,0); ctx.fillStyle='#6B3B22'; ctx.fill();
      circ(x+4,g-86,1.4,'#3B2340');
      if(armTo) limb(x+8,g-66,armTo[0],armTo[1],6,SKIN.kid);
      else limb(x+8,g-66,x+14,g-92-Math.abs(Math.sin(T*8))*6,6,SKIN.kid); // waving
    }
    function boss(x,handing){
      leg(x-7,428,0,62,10,'#3F4660','#222'); leg(x+7,428,0,62,10,'#3F4660','#222');
      rr(x-20,360,40,74,10,'#3F4660'); ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.moveTo(x-7,362); ctx.lineTo(x+7,362); ctx.lineTo(x,380); ctx.fill();
      ctx.fillStyle='#D64545'; ctx.beginPath(); ctx.moveTo(x-3,366); ctx.lineTo(x+3,366); ctx.lineTo(x+4,396); ctx.lineTo(x,402); ctx.lineTo(x-4,396); ctx.fill();
      circ(x,342,15,SKIN.boss); ctx.beginPath(); ctx.arc(x,338,15,Math.PI*1.05,Math.PI*1.95); ctx.lineWidth=5; ctx.strokeStyle='#9A9AA8'; ctx.stroke();
      ctx.lineWidth=1.6; ctx.strokeStyle='#3B2340'; ctx.strokeRect(x-11,338,8,6); ctx.strokeRect(x-1,338,8,6);
      limb(x-8,352,x-2,351,2,'#3B2340');
      limb(x+16,372,x+20,420,9,'#3F4660');
      if(handing){ limb(x-16,372,x-48,384,9,'#3F4660'); circ(x-50,384,5,SKIN.boss);
        for(var i=0;i<4;i++) rr(x-74+i*1.5,372-i*4,34,24,2,i%2?'#F4F4F4':'#FFFFFF'); limb(x-70,366,x-44,366,1,'#C9C9D6'); }
      else limb(x-16,372,x-26,352,9,'#3F4660');
    }
    function woman(x,g,t){
      var ph=st.ph, amp=Math.min(1,st.v/SPEED*1.3), spin=T-st.spin, sx=1;
      if(spin<.5) sx=Math.cos(spin/.5*Math.PI*2);
      ctx.save(); ctx.translate(x,g); ctx.scale(sx||.02,1);
      // speed lines and hair ribbon
      ctx.strokeStyle='rgba(178,9,215,'+(.35*amp)+')'; ctx.lineWidth=3; ctx.lineCap='round';
      [[-40,-120,-90],[-48,-95,-110],[-38,-70,-84]].forEach(function(l){ctx.beginPath();ctx.moveTo(l[0],l[1]);ctx.lineTo(l[2]-Math.sin(ph+l[1])*6,l[1]);ctx.stroke();});
      var bob=Math.abs(Math.sin(ph))*4*amp;
      ctx.translate(0,-bob);
      leg(-2,-66,-Math.sin(ph)*1.0*amp,70,9,'#3B2340','#B209D7');
      // back arm (holds the kid's hand)
      var ba=st.kid?.6:Math.sin(ph)*.9*amp;
      limb(-6,-120,-6-Math.sin(ba)*34,-120+Math.cos(ba)*34,8,SKIN.her);
      ctx.save(); ctx.rotate(.2*amp+.02);
      // coat
      ctx.fillStyle='#B209D7'; ctx.beginPath(); ctx.moveTo(-14,-130); ctx.lineTo(14,-130); ctx.lineTo(22,-62); ctx.lineTo(-24,-60); ctx.closePath(); ctx.fill();
      limb(-2,-128,-2,-66,2,'#8A07A8');
      if(st.bread){ ctx.save(); ctx.translate(-8,-112); ctx.rotate(-.35); ctx.beginPath(); ctx.ellipse(0,0,30,7,0,0,7); ctx.fillStyle='#D8964F'; ctx.fill();
        for(var i=-2;i<=2;i++) limb(i*10-2,-3,i*10+3,3,1.6,'#B0733A'); ctx.restore(); }
      // head and flying ponytail
      circ(4,-146,14,SKIN.her);
      ctx.fillStyle='#4A2A20'; ctx.beginPath(); ctx.arc(4,-150,14,Math.PI*.9,Math.PI*2.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8,-152); ctx.quadraticCurveTo(-30+14*(1-amp),-162+Math.sin(ph)*5+10*(1-amp),-44+26*(1-amp),-146+Math.sin(ph*1.3)*6+26*(1-amp)); ctx.quadraticCurveTo(-28+14*(1-amp),-148+8*(1-amp),-9,-144); ctx.fill();
      circ(11,-146,1.7,'#3B2340'); ctx.beginPath(); ctx.arc(9,-139,3.5,0,Math.PI); ctx.strokeStyle='#3B2340'; ctx.lineWidth=1.6; ctx.stroke();
      ctx.restore();
      leg(4,-66,Math.sin(ph)*1.0*amp,70,9,'#3B2340','#B209D7');
      // front arm with coffee (and the boss's papers)
      var fa=st.arrived?2.3+Math.sin(T*8)*.25:-Math.sin(ph)*.7*amp+.9; // waves hello at home
      var hx=10+Math.sin(fa)*34, hy=-118+Math.cos(fa)*14-10;
      limb(10,-120,hx,hy,8,SKIN.her);
      rr(hx-2,hy-22,13,20,3,'#FFFFFF'); rr(hx-3,hy-25,15,5,2,'#675444');
      if(st.papers){ ctx.save(); ctx.translate(hx+8,hy-8); ctx.rotate(-.25); for(var j=0;j<3;j++) rr(j*1.5,-j*3,30,22,2,j%2?'#F4F4F4':'#FFF'); ctx.restore(); }
      ctx.restore();
      return {bx:x-(6+Math.sin(ba)*34)*sx, by:g-bob-120+Math.cos(ba)*34};
    }

    // ---------- story ----------
    var STATIONS=[{x:250,key:'bread',say:'Your bread!'},{x:505,key:'kid',say:'Mom!'},{x:830,key:'papers',say:'By 5pm!'}];
    function frame(dt){
      T+=dt;
      if(!st.arrived){ var v=SPEED*Math.max(.12,Math.min(1,(HOME-st.x)/150)); st.x+=v*dt; st.v=v; st.ph+=dt*16*(v/SPEED);
        if(st.x>=HOME-1){ st.x=HOME; st.v=0; st.arrived=T; } }
      else { st.v=0; var since=T-st.arrived;
        if(since<2.4 && Math.random()<dt*7) st.hearts.push({x:1080+Math.random()*50,y:425,a:1,k:.7+Math.random()*.6,d:Math.random()*6});
        if(since>3.8) start(); }
      st.hearts.forEach(function(h){h.y-=dt*42; h.x+=Math.sin(T*3+h.d)*.4; h.a-=dt*.55;}); st.hearts=st.hearts.filter(function(h){return h.a>0});
      STATIONS.forEach(function(sn){ if(!st[sn.key] && st.x>=sn.x-(sn.key==='kid'?30:70)){ st[sn.key]=true; st.spin=T; st.t[sn.key]=T;
        if(sn.key==='papers') for(var i=0;i<3;i++) st.flying.push({x:st.x+20,y:WALK-150,vx:-40-i*35,vy:-120-i*30,r:0,vr:(i-1)*3}); } });
      if(T-st.lastPuff>.12 && st.x>-40 && st.v>SPEED*.5){ st.lastPuff=T; st.puffs.push({x:st.x-14,y:WALK-4,a:1,r:5}); }
      st.puffs.forEach(function(p){p.a-=dt*2.2;p.r+=dt*22;p.x-=dt*30;}); st.puffs=st.puffs.filter(function(p){return p.a>0});
      st.flying.forEach(function(f){f.vy+=260*dt; f.vy=Math.min(f.vy,70); f.x+=f.vx*dt+Math.sin(T*5+f.vr)*.8; f.y+=f.vy*dt; f.r+=f.vr*dt;});
      st.flying=st.flying.filter(function(f){return f.y<GROUND+40});

      if(mobile){ cam=Math.max(0,Math.min(st.x-.34*vw,1224-vw)); ox=-cam*s; } // camera follows her, then stops so the house slides in
      ctx.setTransform(dpr,0,0,dpr,0,0); sky();
      ctx.save(); ctx.translate(ox,oy); ctx.scale(s,s);
      tree(340); tree(655); tree(955);
      bakery(); school(); office(); home(); dog(1112,466);
      baker(250,!st.bread);
      if(!st.kid) kidFigure(505,GROUND,false,null);
      boss(850,!st.papers);
      STATIONS.forEach(function(sn){ var a=st[sn.key]?1-(T-st.t[sn.key])/1.1:(st.x-(sn.x-190))/60;
        var px=sn.key==='papers'?sn.x+20:sn.x, py=sn.key==='kid'?GROUND-100:sn.key==='papers'?322:318;
        bubble(sn.say,px,py,a); });
      st.puffs.forEach(function(p){ctx.globalAlpha=Math.max(0,p.a)*.5; circ(p.x,p.y,p.r,'#CFBFD8'); ctx.globalAlpha=1;});
      var hand=woman(st.x,WALK,T);
      st.hearts.forEach(function(h){heart(h.x,h.y,h.k,h.a);});
      if(st.kid) kidFigure(st.x-56,WALK+4,true,[hand.bx,hand.by]);
      st.flying.forEach(function(f){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.r);rr(-13,-9,26,18,2,'#FFF');limb(-8,-3,8,-3,1,'#C9C9D6');limb(-8,2,5,2,1,'#C9C9D6');ctx.restore();});
      ctx.restore();
    }
    function loop(t){ if(!running) return; var dt=prev?Math.min(.05,(t-prev)/1000):0; prev=t; frame(dt); requestAnimationFrame(loop); }
    size(); frame(0);
    window.addEventListener('resize',function(){size();frame(0);});
    window.addEventListener('load',function(){size();frame(0);});
    if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ var was=running; running=es[0].isIntersecting; if(running&&!was){prev=0;requestAnimationFrame(loop);} }).observe(cv); }
    requestAnimationFrame(loop);
  })();

  // count-up numbers (final values are already in the HTML)
  if('IntersectionObserver' in window){
    var cio=new IntersectionObserver(function(es){es.forEach(function(en){
      if(!en.isIntersecting) return; var el=en.target; cio.unobserve(el);
      var end=+el.dataset.count, suf=el.dataset.suffix||'', t0=null, dur=1600;
      function step(t){ if(!t0) t0=t; var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
        el.textContent=Math.round(end*e)+(p===1?suf:''); if(p<1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });},{threshold:.4});
    $$('[data-count]').forEach(function(el){ if(el.getBoundingClientRect().top>window.innerHeight) cio.observe(el); });
  }

  // Petfinder panel
  var pfBtn=$('#pf-btn'), pfPanel=$('#pf-panel');
  pfBtn.addEventListener('click',function(){var o=pfPanel.classList.toggle('open');pfBtn.setAttribute('aria-expanded',o);pfBtn.firstChild.nodeValue=o?'Hide the full list ':'See all adoptable animals ';});

  // pet filter
  var pets=$$('#pets .pet'), chips=$$('.chip');
  chips.forEach(function(c){var f=c.dataset.f;c.querySelector('.n').textContent=pets.filter(function(p){return f==='all'||p.dataset.kind===f||(f==='dog'&&p.dataset.kind==='puppy')}).length;});
  chips.forEach(function(c){c.addEventListener('click',function(){
    var f=c.dataset.f; chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});
    pets.forEach(function(p){
      var show=f==='all'||p.dataset.kind===f||(f==='dog'&&p.dataset.kind==='puppy');
      p.classList.remove('run');p.style.animation='none';
      if(show){ if(p.hidden){p.classList.add('out');p.hidden=false;void p.offsetWidth;} setTimeout(function(){p.classList.remove('out')},20); }
      else if(!p.hidden){ p.classList.add('out'); setTimeout(function(){ if(p.classList.contains('out')) p.hidden=true; },280); }
    });
  });});

  // sign-up form: Adopt / Foster checkboxes and conditional questions
  var iAdopt=$('#i-adopt'), iFoster=$('#i-foster'), submitBtn=$('#submit-btn');
  function syncForm(){
    function open(key,on){var c=$('.cond[data-for="'+key+'"]'); if(c) c.classList.toggle('open',!!on);}
    open('adopt',iAdopt.checked); open('foster',iFoster.checked); open('fee',iAdopt.checked);
    var kind=($('input[name="kind"]:checked')||{}).value;
    ['dog','cat','other'].forEach(function(k){open(k,k===kind)});
    open('rent',($('input[name="home"]:checked')||{}).value==='rent');
    // questions inside a closed group are skipped
    $$('#app-form .cond input,#app-form .cond select,#app-form .cond textarea').forEach(function(el){el.disabled=!!el.closest('.cond:not(.open)');});
    submitBtn.textContent=iFoster.checked?'Sign up to foster':'Send adoption application';
  }
  [iAdopt,iFoster].concat($$('input[name="kind"],input[name="home"]')).forEach(function(el){el.addEventListener('change',syncForm)});
  syncForm();

  var form=$('#app-form'), err=$('#app-error'), thanks=$('#thanks');
  function showForm(){thanks.hidden=true;form.hidden=false;}
  function flash(id){var f=$(id);if(!f)return;f.classList.remove('flash');setTimeout(function(){f.classList.add('flash')},700);}
  function goTo(intent,pet,type){
    showForm();
    if(intent==='adopt'){iAdopt.checked=true;}
    if(intent==='foster'){iFoster.checked=true;}
    if(pet){$('#f-pet').value=pet;}
    if(type){var k=$('#k-'+type);if(k)k.checked=true;}
    syncForm();
    $('#signup').scrollIntoView({behavior:'smooth'});
    var card=(intent==='foster'?iFoster:iAdopt).nextElementSibling;
    card.classList.remove('pulse');setTimeout(function(){card.classList.add('pulse')},700);
    if(pet) flash('#pet-field');
  }
  // "Apply for ___" checks Adopt, fills in the animal and scrolls to the form
  $$('.apply-for').forEach(function(b){b.addEventListener('click',function(){goTo('adopt',b.dataset.pet,b.dataset.type||'dog');});});
  $$('.go-adopt').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();goTo('adopt');});});
  $$('.go-foster').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();goTo('foster');});});
  // links from other pages: #apply-foster opens the form with Foster selected
  if(location.hash==='#apply-foster'){setTimeout(function(){goTo('foster');},300);}

  // submit (mockup: nothing is sent)
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var first=$('#f-first').value.trim(), email=$('#f-email').value.trim(), msg='';
    if(!first) msg='Add your first name so we know who to contact.';
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) msg='Enter an email address like name@example.com.';
    else if(iAdopt.checked&&!$('#f-agree').checked) msg='Check the box to confirm you understand how the adoption trial works.';
    else if(iFoster.checked&&!$$('#fo-dogs,#fo-cats,#fo-babies,#fo-other').some(function(c){return c.checked})) msg='Pick at least one kind of animal you could foster.';
    if(msg){err.textContent=msg;err.hidden=false;return;}
    err.hidden=true;
    var pet=$('#f-pet').value.trim(), a=iAdopt.checked, f=iFoster.checked;
    var adoptTxt=pet?('your application to adopt '+pet):'your adoption application';
    $('#thanks-title').textContent='Thank you, '+first+'!';
    $('#thanks-text').textContent='We got '+(a?adoptTxt+'.':'your sign-up to foster.');
    form.hidden=true;thanks.hidden=false;
    $('#app').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#again').addEventListener('click',showForm);

  // Happy Tales: each click reveals the next three #happytales posts
  var talesBtn=$('#tales-btn');
  if(talesBtn) talesBtn.addEventListener('click',function(){
    var next=$$('#stories .story[hidden]');
    next.slice(0,3).forEach(function(li,i){li.hidden=false;li.style.animationDelay=(i*.15)+'s';li.classList.remove('run','fade-up');void li.offsetWidth;li.classList.add('run','fade-up');});
    if(next.length<=3){
      var a=document.createElement('a');a.className='btn btn-ghost';a.href='#';a.textContent='See all #happytales on Instagram';
      talesBtn.replaceWith(a);
    }
  });


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
  },{rootMargin:'0px 0px 8% 0px'});
  $$('[data-anim]').forEach(function(el){
    if(el.getBoundingClientRect().top<window.innerHeight){ if(el.dataset.anim==='pl') el.classList.add('run'); return; }
    io.observe(el);
  });
})();
