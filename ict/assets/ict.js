/* ICT Course Portal – shared scripts (Startwell Education)
   Progress and preferences are kept in this browser only (localStorage). */
(function(){
  'use strict';
  var KEY='ict-progress-v1', THEME='ict-theme';
  function store(k,v){try{if(v===undefined){return JSON.parse(localStorage.getItem(k)||'null')}localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
  function prog(){var p=store(KEY);if(!p||typeof p!=='object')p={lecture:{},lab:{}};p.lecture=p.lecture||{};p.lab=p.lab||{};return p}
  var TOTAL=12;
  window.ICT={store:store,prog:prog};

  /* Theme */
  var root=document.documentElement;
  var t=store(THEME); if(t==='dark') root.setAttribute('data-ict-theme','dark');
  document.querySelectorAll('[data-theme-toggle]').forEach(function(b){
    function label(){var d=root.getAttribute('data-ict-theme')==='dark';b.innerHTML=d?'<i class="fa-solid fa-sun"></i> Light mode':'<i class="fa-solid fa-moon"></i> Dark mode';b.setAttribute('aria-pressed',d)}
    label();
    b.addEventListener('click',function(){var d=root.getAttribute('data-ict-theme')==='dark';if(d){root.removeAttribute('data-ict-theme');store(THEME,'light')}else{root.setAttribute('data-ict-theme','dark');store(THEME,'dark')}label()});
  });

  /* Print */
  document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print()})});
  var opened=[];
  window.addEventListener('beforeprint',function(){document.querySelectorAll('details:not([open])').forEach(function(d){d.open=true;opened.push(d)})});
  window.addEventListener('afterprint',function(){opened.forEach(function(d){d.open=false});opened=[];document.body.classList.remove('print-deck')});

  /* Progress */
  function render(){
    var p=prog();
    ['lecture','lab'].forEach(function(kind){
      var n=0;for(var i=1;i<=TOTAL;i++){if(p[kind][i])n++}
      document.querySelectorAll('[data-count="'+kind+'"]').forEach(function(el){el.textContent=n+' / '+TOTAL});
      document.querySelectorAll('[data-bar="'+kind+'"]').forEach(function(el){el.style.width=(n/TOTAL*100)+'%'});
    });
    var all=0;for(var j=1;j<=TOTAL;j++){if(p.lecture[j])all++;if(p.lab[j])all++}
    document.querySelectorAll('[data-count="all"]').forEach(function(el){el.textContent=Math.round(all/(TOTAL*2)*100)+'%'});
    document.querySelectorAll('[data-bar="all"]').forEach(function(el){el.style.width=(all/(TOTAL*2)*100)+'%'});
    document.querySelectorAll('[data-item]').forEach(function(el){
      var a=el.getAttribute('data-item').split('-'),done=!!p[a[0]][a[1]];
      el.classList.toggle('is-done',done);
      var st=el.querySelector('.st');if(st)st.textContent=done?'✓ Completed':(a[0]==='lab'?'Not done':'Not started');
    });
    document.querySelectorAll('[data-complete]').forEach(function(b){
      var a=b.getAttribute('data-complete').split('-'),done=!!p[a[0]][a[1]];
      b.classList.toggle('done',done);
      b.innerHTML=done?'<i class="fa-solid fa-circle-check"></i> Completed (click to undo)':'<i class="fa-regular fa-circle"></i> Mark '+(a[0]==='lab'?'lab':'lecture')+' as complete';
    });
  }
  document.querySelectorAll('[data-complete]').forEach(function(b){
    b.addEventListener('click',function(){var a=b.getAttribute('data-complete').split('-'),p=prog();if(p[a[0]][a[1]])delete p[a[0]][a[1]];else p[a[0]][a[1]]=Date.now();store(KEY,p);render()});
  });
  document.querySelectorAll('[data-reset-progress]').forEach(function(b){b.addEventListener('click',function(){store(KEY,{lecture:{},lab:{}});render()})});
  render();

  /* Quizzes: .iq[data-ans] with buttons */
  document.addEventListener('click',function(e){
    var b=e.target.closest('.iq button[data-i]');if(!b)return;
    var box=b.closest('.iq'),ans=box.getAttribute('data-ans'),ok=b.getAttribute('data-i')===ans;
    box.querySelectorAll('button[data-i]').forEach(function(x){x.classList.remove('ok','no')});
    b.classList.add(ok?'ok':'no');
    if(!ok&&box.hasAttribute('data-reveal'))box.querySelector('button[data-i="'+ans+'"]').classList.add('ok');
    var fb=box.querySelector('.fb'),why=box.getAttribute('data-why')||'';
    if(fb)fb.textContent=ok?'Correct! Sahi jawab. '+why:'Not quite — dobara koshish karein.'+(box.hasAttribute('data-reveal')?' '+why:'');
    box.setAttribute('data-picked',ok?'1':'0');
    var set=box.closest('[data-quizset]');
    if(set){var out=set.querySelector('.qs-score');if(out){var qs=set.querySelectorAll('.iq'),done=0,right=0;qs.forEach(function(q){if(q.hasAttribute('data-picked')){done++;if(q.getAttribute('data-picked')==='1')right++}});out.textContent='Score: '+right+' / '+qs.length+(done<qs.length?' (answered '+done+')':'')}}
  });
  document.querySelectorAll('[data-quiz-reset]').forEach(function(b){b.addEventListener('click',function(){var set=b.closest('[data-quizset]');set.querySelectorAll('.iq').forEach(function(q){q.removeAttribute('data-picked');q.querySelectorAll('button').forEach(function(x){x.classList.remove('ok','no')});var fb=q.querySelector('.fb');if(fb)fb.textContent=''});var o=set.querySelector('.qs-score');if(o)o.textContent=''})});

  /* Filter chips */
  document.querySelectorAll('[data-filter-group]').forEach(function(g){
    var target=document.querySelector(g.getAttribute('data-filter-group'));
    g.addEventListener('click',function(e){var b=e.target.closest('button[data-f]');if(!b)return;
      g.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});
      var f=b.getAttribute('data-f');
      target.querySelectorAll('[data-unit]').forEach(function(el){el.hidden=!(f==='all'||el.getAttribute('data-unit')===f)});
    });
  });

  /* Search */
  var si=document.getElementById('ictSearch');
  if(si){
    var res=document.getElementById('ictResults'),idx=null;
    function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function run(){
      var q=si.value.trim().toLowerCase();
      if(q.length<2){res.innerHTML='';return}
      if(!idx){res.innerHTML='<p class="mut">Loading…</p>';fetch('/ict/assets/search-index.json').then(function(r){return r.json()}).then(function(d){idx=d;run()}).catch(function(){res.innerHTML='<p class="mut">Search could not load. Please check your connection.</p>'});return}
      var words=q.split(/\s+/),hits=[];
      idx.forEach(function(it){var hay=(it.t+' '+it.x).toLowerCase(),score=0;
        for(var i=0;i<words.length;i++){if(hay.indexOf(words[i])<0)return;score+=(it.t.toLowerCase().indexOf(words[i])>=0?5:1)}
        hits.push([score,it])});
      hits.sort(function(a,b){return b[0]-a[0]});
      if(!hits.length){res.innerHTML='<p class="mut">No results for “'+esc(q)+'”. Try another word.</p>';return}
      var re=new RegExp('('+words.map(function(w){return w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}).join('|')+')','gi');
      res.innerHTML='<p class="mut">'+hits.length+' result'+(hits.length>1?'s':'')+'</p>'+hits.slice(0,20).map(function(h){var it=h[1],x=it.x,p=x.toLowerCase().indexOf(words[0]),snip=x.substr(Math.max(0,p-60),170);
        return '<a href="'+it.u+'"><b>'+esc(it.t).replace(re,'<mark>$1</mark>')+'</b><small>'+esc(it.c)+' · …'+esc(snip).replace(re,'<mark>$1</mark>')+'…</small></a>'}).join('');
    }
    var tm;si.addEventListener('input',function(){clearTimeout(tm);tm=setTimeout(run,180)});
    var form=si.closest('form');if(form)form.addEventListener('submit',function(e){e.preventDefault();run()});
    var qp=new URLSearchParams(location.search).get('q');if(qp){si.value=qp;run()}
  }

  /* Teaching plan timing editor */
  document.querySelectorAll('[data-timing]').forEach(function(tb){
    function sum(){var s=0;tb.querySelectorAll('input').forEach(function(i){s+=Math.max(0,parseInt(i.value,10)||0)});tb.querySelector('.tt-total').textContent=s+' minutes'}
    tb.addEventListener('input',sum);sum();
  });
})();
