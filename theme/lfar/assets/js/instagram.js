/* LFAR Instagram feed: front-end bits that the page scripts don't cover. Loaded only once live posts are shown. */
(function(){
  'use strict';

  // About: "See more" reveals the next six posts (as in the mockup); the button goes once none are left.
  // (get-involved.js already wires its own button, so this only runs on About.)
  var more=document.getElementById('see-more');
  if(more && document.querySelector('#feed .more-post')){
    more.addEventListener('click',function(){
      var next=[].slice.call(document.querySelectorAll('#feed .more-post[hidden]')).slice(0,6);
      next.forEach(function(p){p.hidden=false;p.classList.add('reveal');});
      if(!document.querySelector('#feed .more-post[hidden]')){more.hidden=true;more.setAttribute('aria-expanded','true');}
    });
  }

  // Adopt: when the last Happy Tales are shown, adopt.js swaps the button for a link; point it at LFAR's Instagram.
  var stories=document.querySelector('#stories ul.stories[data-ig]');
  var tales=document.getElementById('tales-btn');
  if(stories && tales){
    tales.addEventListener('click',function(){
      setTimeout(function(){
        var a=document.querySelector('#stories .stories-close a.btn-ghost[href="#"]');
        if(a){a.href=stories.getAttribute('data-ig');a.target='_blank';a.rel='noopener';a.textContent='See more on Instagram';}
      },0);
    });
  }
})();
