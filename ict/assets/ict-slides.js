/* ICT classroom slide deck – keyboard: ← → Space, F = full screen, N = notes */
(function(){
  'use strict';
  var deck=document.getElementById('deck'); if(!deck) return;
  var sel=document.getElementById('deckLecture'), area=document.getElementById('slideArea'), cnt=document.getElementById('deckCount'),
      bar=document.getElementById('deckBar'), notes=document.getElementById('deckNotes'), notesBody=document.getElementById('deckNotesBody'),
      DATA=null, L=0, i=0;
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function slideHTML(s,lec){
    return '<div class="slide'+(s.t==='title'?' title':'')+'"><div class="sk">'+esc(s.k)+'</div><h3>'+esc(s.h)+'</h3>'+
      (s.b&&s.b.length?'<ul>'+s.b.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'')+
      (s.v?'<div class="vis"><i class="fa-regular fa-image"></i> '+esc(s.v)+'</div>':'')+'</div>';
  }
  function show(){
    var lec=DATA[L], s=lec.slides[i];
    area.innerHTML=slideHTML(s,lec);
    cnt.textContent='Slide '+(i+1)+' / '+lec.slides.length;
    bar.style.width=((i+1)/lec.slides.length*100)+'%';
    notesBody.innerHTML='<p>'+esc(s.n).replace(/\n/g,'</p><p>')+'</p>';
    try{history.replaceState(null,'','#l'+lec.n+'-s'+(i+1))}catch(e){}
  }
  function go(d){var n=DATA[L].slides.length;i=Math.min(n-1,Math.max(0,i+d));show()}
  function load(){
    fetch('/ict/assets/slides.json').then(function(r){return r.json()}).then(function(d){
      DATA=d;
      sel.innerHTML=d.map(function(l,k){return '<option value="'+k+'">Lecture '+l.n+': '+esc(l.title)+' ('+l.slides.length+' slides)</option>'}).join('');
      var m=location.hash.match(/^#l(\d+)(?:-s(\d+))?/);
      if(m){L=Math.max(0,Math.min(d.length-1,parseInt(m[1],10)-1));i=m[2]?parseInt(m[2],10)-1:0}
      sel.value=L; if(i>=d[L].slides.length)i=0; show();
    }).catch(function(){area.innerHTML='<div class="slide"><h3>Slides could not load</h3><ul><li>Please check your internet connection and refresh.</li></ul></div>'});
  }
  sel.addEventListener('change',function(){L=parseInt(sel.value,10);i=0;show()});
  document.getElementById('deckPrev').addEventListener('click',function(){go(-1)});
  document.getElementById('deckNext').addEventListener('click',function(){go(1)});
  document.getElementById('deckFull').addEventListener('click',function(){
    if(document.fullscreenElement){document.exitFullscreen()}else if(deck.requestFullscreen){deck.requestFullscreen()}
  });
  document.getElementById('deckNotesBtn').addEventListener('click',function(){notes.hidden=!notes.hidden});
  document.getElementById('deckPrint').addEventListener('click',function(){
    var lec=DATA[L],pd=document.getElementById('printDeck');
    pd.innerHTML='<h2>Lecture '+lec.n+': '+esc(lec.title)+'</h2>'+lec.slides.map(function(s,k){return '<div class="pslide">'+slideHTML(s,lec)+'<div class="pnotes"><b>Slide '+(k+1)+' speaker notes:</b> '+esc(s.n)+'</div></div>'}).join('');
    document.body.classList.add('print-deck'); window.print();
  });
  area.addEventListener('click',function(e){var r=area.getBoundingClientRect();go(e.clientX-r.left<r.width/3?-1:1)});
  document.addEventListener('keydown',function(e){
    if(!DATA||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();go(1)}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(-1)}
    else if(e.key==='Home'){i=0;show()}else if(e.key==='End'){i=DATA[L].slides.length-1;show()}
    else if(e.key==='f'||e.key==='F'){document.getElementById('deckFull').click()}
    else if(e.key==='n'||e.key==='N'){notes.hidden=!notes.hidden}
  });
  window.addEventListener('hashchange',function(){if(!DATA)return;var m=location.hash.match(/^#l(\d+)(?:-s(\d+))?/);if(!m)return;var nl=Math.max(0,Math.min(DATA.length-1,parseInt(m[1],10)-1)),ni=m[2]?parseInt(m[2],10)-1:0;if(nl!==L||ni!==i){L=nl;i=Math.min(ni,DATA[L].slides.length-1);sel.value=L;show();deck.scrollIntoView({behavior:'smooth'})}});
  load();
})();
