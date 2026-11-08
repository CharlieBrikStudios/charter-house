(function(){
  var d=document, bar=d.querySelector('.prog'), now=d.querySelector('.bar .now'), rail=d.querySelector('.rail'), mbar=d.querySelector('.mbar');
  var secs=[].slice.call(d.querySelectorAll('section[data-title]'));
  var links=[].slice.call(d.querySelectorAll('.rail a'));
  var cover=d.getElementById('cover');
  var ticking=false;
  function onScroll(){
    if(ticking)return;ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      var h=d.documentElement.scrollHeight-innerHeight, y=scrollY;
      if(bar)bar.style.transform='scaleX('+(h>0?Math.min(1,y/h):0)+')';
      var past=cover?cover.getBoundingClientRect().bottom<80:true;
      if(mbar)mbar.classList.toggle('on',past);
      if(rail)rail.classList.toggle('on',past);
      var cur=null, line=innerHeight*0.32;
      for(var i=0;i<secs.length;i++){if(secs[i].getBoundingClientRect().top<line)cur=secs[i];}
      if(now){now.textContent=cur?cur.getAttribute('data-title'):'';now.classList.toggle('on',!!cur&&past);}
      links.forEach(function(a){a.classList.toggle('on',!!cur&&a.getAttribute('href')==='#'+cur.id);});
    });
  }
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();

  // contents sheet
  var sheet=d.getElementById('contents');
  d.querySelectorAll('[data-contents]').forEach(function(b){b.addEventListener('click',function(){if(sheet&&sheet.showModal)sheet.showModal();});});
  if(sheet){
    sheet.addEventListener('click',function(e){
      var a=e.target.closest('a[href^="#"]');
      if(a){e.preventDefault();var t=d.querySelector(a.getAttribute('href'));sheet.close();
        if(t)setTimeout(function(){t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});if(history.replaceState)history.replaceState(null,'',a.getAttribute('href'));},30);return;}
      if(e.target===sheet||e.target.closest('[data-close]'))sheet.close();});
  }

  // lightbox
  var lb=d.getElementById('lb');
  if(lb){
    var li=lb.querySelector('img'), lp=lb.querySelector('p');
    d.addEventListener('click',function(e){
      var im=e.target.closest('img.zoom');if(!im||!lb.showModal)return;
      li.src=im.getAttribute('data-full')||im.currentSrc||im.src;li.alt=im.alt;lp.textContent=im.alt;lb.showModal();
    });
    lb.addEventListener('click',function(){lb.close();});
  }
})();
