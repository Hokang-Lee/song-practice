'use strict';
(()=>{
  const audio=document.getElementById('audio'),toggle=document.getElementById('follow-lyrics');
  let lastLine=null,holdUntil=0;
  try{toggle.checked=localStorage.getItem('follow-lyrics')!=='off';}catch{}
  function follow(){
    if(!toggle.checked||audio.paused||document.hidden||Date.now()<holdUntil)return;
    const line=document.querySelector('#lyrics .line.active');
    if(!line){lastLine=null;return;}
    if(line===lastLine)return;
    lastLine=line;
    line.scrollIntoView({block:'center',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function reset(){lastLine=null;follow();}
  // Do not fight manual scrolling. Resume following after five seconds.
  function manual(){holdUntil=Date.now()+5000;lastLine=null;}
  window.addEventListener('wheel',manual,{passive:true});
  window.addEventListener('touchstart',manual,{passive:true});
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))manual();});
  toggle.addEventListener('change',()=>{try{localStorage.setItem('follow-lyrics',toggle.checked?'on':'off');}catch{}holdUntil=0;reset();});
  audio.addEventListener('play',()=>{holdUntil=0;reset();});
  audio.addEventListener('pause',()=>{lastLine=null;});
  audio.addEventListener('timeupdate',follow);
  audio.addEventListener('seeked',reset);
  document.getElementById('font').addEventListener('change',reset);
  window.addEventListener('resize',reset);
  setInterval(follow,250);
})();
