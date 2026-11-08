/* V2 skin: italic emphasis on headlines, like the BRIK shareholder report.
   "A minute from the Underbanks, ten from the station." -> italic after the comma;
   otherwise the last word goes italic. Runs after every render. */
(function(){
  function emph(h){
    if(!h||h.dataset.emph||h.querySelector("em,i,span,br"))return;
    var t=h.textContent.trim();if(!t||t.length<6)return;
    h.dataset.emph="1";
    var c=t.lastIndexOf(", ");
    var head,tail;
    if(c>4&&c<t.length-4){head=t.slice(0,c+2);tail=t.slice(c+2);}
    else{var s=t.lastIndexOf(" ");if(s<1)return;head=t.slice(0,s+1);tail=t.slice(s+1);}
    h.textContent="";h.appendChild(document.createTextNode(head));var em=document.createElement("em");em.textContent=tail;h.appendChild(em);
  }
  function run(){document.querySelectorAll(".chh h2,.big-h,.sh,.changes .serif,.ctaline .serif").forEach(emph);}
  window.__v2skin=run;
  if(document.readyState!=="loading")run();else document.addEventListener("DOMContentLoaded",run);
  new MutationObserver(function(){clearTimeout(run.t);run.t=setTimeout(run,30);}).observe(document.body,{childList:true,subtree:true});
})();
