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

  /* 02 living gold borders on a few key elements */
  try{
    if(!reduce){
      ["#lxViewer",".contract-card",".market-main-panel",".hero-actions .btn-gold"].forEach(function(sel){
        var el=document.querySelector(sel);if(!el||el.querySelector(":scope>.lx-edge"))return;
        el.classList.add("lx-has-edge");
        var s=document.createElement("span");s.className="lx-edge";s.setAttribute("aria-hidden","true");el.appendChild(s);
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

/* asset-pack effects: light sweep (A), sparkles (C), bracket frames */
(function(){
  "use strict";
  try{
    var hero=document.querySelector(".hero");
    var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    ["#market .market-main-panel",".buy-card"].forEach(function(s){[].forEach.call(document.querySelectorAll(s),function(e){e.classList.add("fx-bracket")})});
    if(!hero)return;
    var sw=document.createElement("div");sw.className="fx-sweep";sw.setAttribute("aria-hidden","true");hero.insertBefore(sw,hero.firstChild);
    if(reduce)return;
    var cv=document.createElement("canvas");cv.className="fx-sparks";cv.setAttribute("aria-hidden","true");hero.insertBefore(cv,hero.firstChild.nextSibling);
    var cx=cv.getContext("2d"),W=0,H=0,P=[],on=true,dpr=Math.min(window.devicePixelRatio||1,2);
    function size(){W=hero.clientWidth;H=hero.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0)}
    function mk(init){return{x:Math.random()*W,y:init?Math.random()*H:H+8,r:Math.random()*1.9+.5,v:Math.random()*.35+.12,s:Math.random()*Math.PI*2,a:Math.random()*.6+.3}}
    size();var n=W<700?26:60;for(var i=0;i<n;i++)P.push(mk(true));
    window.addEventListener("resize",size);
    if("IntersectionObserver" in window)new IntersectionObserver(function(es){on=es[0].isIntersecting;if(on)requestAnimationFrame(tick)}).observe(hero);
    function tick(t){
      if(!on)return;cx.clearRect(0,0,W,H);
      for(var i=0;i<P.length;i++){var p=P[i];p.y-=p.v;p.x+=Math.sin(t/1800+p.s)*.25;if(p.y<-8){P[i]=mk(false);continue}
        var tw=.55+.45*Math.sin(t/420+p.s),g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);
        g.addColorStop(0,"rgba(255,238,180,"+(p.a*tw)+")");g.addColorStop(1,"rgba(255,185,56,0)");cx.fillStyle=g;cx.beginPath();cx.arc(p.x,p.y,p.r*4,0,6.283);cx.fill()}
      requestAnimationFrame(tick)}
    requestAnimationFrame(tick);
  }catch(e){}
})();
