/* Decides, before first paint, whether the short logo reveal plays (once per visit, never with reduced motion). */
(function(){try{
  var p=location.pathname;
  var home=(p==="/"||p==="/index.html");
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(home&&!reduce&&!location.hash&&!sessionStorage.getItem("lxIntroSeen")){
    document.documentElement.classList.add("lx-intro-on");
  }
}catch(e){}})();
