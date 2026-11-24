/* GOLDITY motion layer. No libraries. Each part is independent and fails quietly. */
(function(){
  "use strict";
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small=window.matchMedia&&matchMedia("(max-width:640px)").matches;

  /* 01 logo reveal */
  try{
    var root=document.documentElement,intro=document.getElementById("lxIntro");
    if(intro&&root.classList.contains("lx-intro-on")){
      var closed=false;
      var close=function(){
        if(closed)return;closed=true;
        try{sessionStorage.setItem("lxIntroSeen","1")}catch(e){}
        intro.classList.add("done");
        setTimeout(function(){root.classList.remove("lx-intro-on")},750);
      };
      requestAnimationFrame(function(){intro.classList.add("play")});
      setTimeout(close,2500);
      setTimeout(close,4000);
      var sk=document.getElementById("lxSkip");if(sk)sk.addEventListener("click",close);
      intro.addEventListener("click",close);
      document.addEventListener("keydown",function(e){if(e.key==="Escape"||e.key==="Enter"||e.key===" ")close()},{once:false});
    }
  }catch(e){}

  /* 02 GoldTraceBorder: any element with [data-gold-trace] gets a travelling-light border layer */
  try{
    if(!reduce){
      [].slice.call(document.querySelectorAll("[data-gold-trace]")).forEach(function(el){
        if(el.querySelector(":scope>.gold-trace"))return;
        el.classList.add("has-gold-trace");
        var s=document.createElement("span");s.className="gold-trace";s.setAttribute("aria-hidden","true");el.appendChild(s);
      });
    }
  }catch(e){}

  /* 03 editorial scroll */
  try{
    var lines=[].slice.call(document.querySelectorAll(".lx-line"));
    if(lines.length){
      if(reduce||!("IntersectionObserver" in window)){lines.forEach(function(l){l.classList.add("lit")})}
      else{
        var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle("lit",e.isIntersecting)})},{rootMargin:"-30% 0px -30% 0px",threshold:0});
        lines.forEach(function(l){io.observe(l)});
      }
    }
  }catch(e){}

  /* 04 vault viewer: tabs + gentle tilt */
  try{
    var card=document.getElementById("lxViewer");
    if(card){
      var tabs=[].slice.call(card.querySelectorAll(".lx-tab")),panes=[].slice.call(card.querySelectorAll(".lx-pane"));
      var pick=function(i,focus){
        tabs.forEach(function(t,k){t.setAttribute("aria-selected",k===i?"true":"false");t.tabIndex=k===i?0:-1});
        panes.forEach(function(p,k){p.classList.toggle("on",k===i)});
        if(focus)tabs[i].focus();
      };
      tabs.forEach(function(t,i){
        t.addEventListener("click",function(){pick(i)});
        t.addEventListener("keydown",function(e){
          if(e.key==="ArrowRight"){e.preventDefault();pick((i+1)%tabs.length,true)}
          if(e.key==="ArrowLeft"){e.preventDefault();pick((i+tabs.length-1)%tabs.length,true)}
        });
      });
      if(!reduce&&!small&&window.matchMedia("(hover:hover)").matches){
        card.addEventListener("pointermove",function(e){
          var r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
          card.style.setProperty("--ry",(x*9).toFixed(2)+"deg");card.style.setProperty("--rx",(-y*9).toFixed(2)+"deg");
        });
        card.addEventListener("pointerleave",function(){card.style.setProperty("--rx","0deg");card.style.setProperty("--ry","0deg")});
      }
    }
  }catch(e){}
})();

/* header turns to glass after scrolling */
(function(){try{var hd=document.querySelector(".site-header");if(!hd)return;var f=function(){hd.classList.toggle("is-scrolled",window.scrollY>40)};f();window.addEventListener("scroll",f,{passive:true})}catch(e){}})();
