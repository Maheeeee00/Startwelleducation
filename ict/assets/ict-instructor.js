/* ICT Instructor Dashboard – FRONT-END DEMO.
   All data lives in this browser's localStorage under 'ict-instructor-v1'.
   Nothing is sent to a server; clearing browser data or using another device starts fresh. */
(function(){
  'use strict';
  var app=document.getElementById('instructorApp'); if(!app) return;
  var KEY='ict-instructor-v1', CFG=JSON.parse(document.getElementById('ictCfg').textContent);
  var COMP=CFG.components; // [{k,label,max,clos}]
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function seed(){
    var names=['Ali Raza','Sana Bibi','Hamza Iqbal','Ayesha Noor','Usman Khalid','Hira Shafiq','Bilal Ahmed','Maryam Javed','Zain Abbas','Fatima Zahra'];
    var st=names.map(function(n,i){var r=function(a,b,o){return Math.round(a+((i*37+o*13)%100)/100*(b-a))};
      return {id:'BS-'+(101+i),name:n,lab:r(10,20,1),quiz:r(4,10,2),mid:r(8,20,3),project:r(9,20,4),final:r(12,30,5),att:r(70,100,6)}});
    return {students:st,
      lectures:CFG.lectures.map(function(l){return {n:l.n,title:l.title,taught:l.n<=4,plan:l.n<=6,lab:l.n<=4}}),
      assignments:CFG.assignments.map(function(a,i){return {title:a,due:'',status:i<3?'Graded':'Open'}}),
      quizzes:CFG.lectures.map(function(l){return {n:l.n,released:l.n<=4,avg:l.n<=4?60+l.n*5:null}}),
      announcements:[{d:new Date().toISOString().slice(0,10),t:'Welcome to Applications of ICT. Create your ICT-Labs cloud folder before Lab 01.'}]};
  }
  var S; try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){S=null}
  var persistent=true; try{localStorage.setItem('__t','1');localStorage.removeItem('__t')}catch(e){persistent=false}
  if(!S||!S.students) S=seed();
  function save(){if(!persistent)return;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
  document.getElementById('storeState').textContent=persistent?'Saved in this browser only (localStorage). Not shared with students or other devices.':'Browser storage is blocked here, so changes will be lost when you close this page.';
  function total(s){return COMP.reduce(function(a,c){return a+(+s[c.k]||0)},0)}
  function grade(t){return t>=85?'A':t>=80?'A-':t>=75?'B+':t>=71?'B':t>=68?'B-':t>=64?'C+':t>=61?'C':t>=58?'C-':t>=54?'D+':t>=50?'D':'F'}
  function cloScore(s,clo){var got=0,max=0;COMP.forEach(function(c){if(c.clos.indexOf(clo)>=0){got+=+s[c.k]||0;max+=c.max}});return max?got/max*100:0}

  /* Tabs */
  var tabs=app.querySelectorAll('.ic-tabs button');
  tabs.forEach(function(b){b.addEventListener('click',function(){tabs.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});app.querySelectorAll('.ic-panel').forEach(function(p){p.hidden=p.id!==b.getAttribute('data-tab')});})});

  function renderOverview(){
    var n=S.students.length,avg=S.students.reduce(function(a,s){return a+total(s)},0)/n,pass=S.students.filter(function(s){return total(s)>=50}).length;
    var taught=S.lectures.filter(function(l){return l.taught}).length,labs=S.lectures.filter(function(l){return l.lab}).length;
    document.getElementById('ovStats').innerHTML=[['Students',n],['Class average',avg.toFixed(1)+'%'],['Passing (≥50)',pass+' / '+n],['Lectures taught',taught+' / 12'],['Labs conducted',labs+' / 12'],['Announcements',S.announcements.length]].map(function(x){return '<div class="ic-card ic-stat"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>'}).join('');
  }
  function renderStudents(){
    var h='<table><thead><tr><th>Roll No</th><th>Name</th>'+COMP.map(function(c){return '<th>'+esc(c.label)+' /'+c.max+'</th>'}).join('')+'<th>Attendance %</th><th>Total /100</th><th>Grade</th></tr></thead><tbody>';
    S.students.forEach(function(s,i){var t=total(s);h+='<tr><td>'+esc(s.id)+'</td><td>'+esc(s.name)+'</td>'+COMP.map(function(c){return '<td><input type="number" min="0" max="'+c.max+'" step="0.5" data-s="'+i+'" data-k="'+c.k+'" value="'+(s[c.k]==null?'':s[c.k])+'" aria-label="'+esc(c.label)+' for '+esc(s.name)+'"></td>'}).join('')+'<td><input type="number" min="0" max="100" data-s="'+i+'" data-k="att" value="'+s.att+'" aria-label="Attendance for '+esc(s.name)+'"></td><td><b>'+t.toFixed(1)+'</b></td><td>'+grade(t)+'</td></tr>'});
    document.getElementById('stuTable').innerHTML=h+'</tbody></table>';
  }
  function renderCLO(){
    var clos=['CLO 1','CLO 2','CLO 3','CLO 4'];
    var h='<table><thead><tr><th>Student</th>'+clos.map(function(c){return '<th>'+c+' %</th>'}).join('')+'</tr></thead><tbody>';
    S.students.forEach(function(s){h+='<tr><td>'+esc(s.name)+'</td>'+clos.map(function(c){var v=cloScore(s,c);return '<td style="color:'+(v>=50?'var(--ic-ok)':'var(--ic-bad)')+'">'+v.toFixed(0)+'</td>'}).join('')+'</tr>'});
    h+='<tr><th>Students achieving ≥ 50%</th>'+clos.map(function(c){var a=S.students.filter(function(s){return cloScore(s,c)>=50}).length;return '<th>'+a+' / '+S.students.length+' ('+Math.round(a/S.students.length*100)+'%)</th>'}).join('')+'</tr>';
    document.getElementById('cloTable').innerHTML=h+'</tbody></table>';
    document.getElementById('cloBars').innerHTML=clos.map(function(c){var a=S.students.filter(function(s){return cloScore(s,c)>=50}).length/S.students.length*100;return '<div style="margin:8px 0"><b>'+c+'</b> — '+Math.round(a)+'% of students achieved<div class="ic-prog"><i style="width:'+a+'%"></i></div></div>'}).join('');
  }
  function renderCourse(){
    var h='<table><thead><tr><th>#</th><th>Lecture</th><th>Teaching plan reviewed</th><th>Lecture taught</th><th>Lab conducted</th><th>Quiz released</th><th>Quiz average %</th></tr></thead><tbody>';
    S.lectures.forEach(function(l,i){var q=S.quizzes[i];h+='<tr><td>'+l.n+'</td><td><a href="'+CFG.lectures[i].url+'">'+esc(l.title)+'</a></td>'+
      ['plan','taught','lab'].map(function(k){return '<td><input type="checkbox" data-l="'+i+'" data-k="'+k+'"'+(l[k]?' checked':'')+' aria-label="'+k+' lecture '+l.n+'"></td>'}).join('')+
      '<td><input type="checkbox" data-q="'+i+'" data-k="released"'+(q.released?' checked':'')+' aria-label="quiz released '+l.n+'"></td><td><input type="number" min="0" max="100" data-q="'+i+'" data-k="avg" value="'+(q.avg==null?'':q.avg)+'" aria-label="quiz average '+l.n+'"></td></tr>'});
    document.getElementById('courseTable').innerHTML=h+'</tbody></table>';
    var a='<table><thead><tr><th>Assignment / project</th><th>Due date</th><th>Status</th></tr></thead><tbody>';
    S.assignments.forEach(function(x,i){a+='<tr><td>'+esc(x.title)+'</td><td><input type="date" data-a="'+i+'" data-k="due" value="'+esc(x.due)+'" aria-label="due date"></td><td><select data-a="'+i+'" data-k="status" aria-label="status">'+['Not released','Open','Submitted','Graded'].map(function(o){return '<option'+(o===x.status?' selected':'')+'>'+o+'</option>'}).join('')+'</select></td></tr>'});
    document.getElementById('asgTable').innerHTML=a+'</tbody></table>';
  }
  function renderAnn(){
    document.getElementById('annList').innerHTML=S.announcements.length?S.announcements.map(function(a,i){return '<div class="ic-box"><small class="mut">'+esc(a.d)+'</small><p style="margin:4px 0 8px">'+esc(a.t)+'</p><button class="ict-btn" data-del="'+i+'"><i class="fa-solid fa-trash"></i> Delete</button></div>'}).join(''):'<p class="mut">No announcements yet.</p>';
  }
  function all(){renderOverview();renderStudents();renderCLO();renderCourse();renderAnn()}
  app.addEventListener('change',function(e){
    var el=e.target,k=el.getAttribute('data-k');if(!k)return;
    if(el.hasAttribute('data-s')){var c=COMP.filter(function(x){return x.k===k})[0],max=c?c.max:100,v=el.value===''?null:Math.max(0,Math.min(max,parseFloat(el.value)));S.students[+el.getAttribute('data-s')][k]=v;}
    else if(el.hasAttribute('data-l')){S.lectures[+el.getAttribute('data-l')][k]=el.checked}
    else if(el.hasAttribute('data-q')){S.quizzes[+el.getAttribute('data-q')][k]=k==='released'?el.checked:(el.value===''?null:+el.value)}
    else if(el.hasAttribute('data-a')){S.assignments[+el.getAttribute('data-a')][k]=el.value}
    save();setTimeout(all,0);
  });
  app.addEventListener('click',function(e){var b=e.target.closest('[data-del]');if(b){S.announcements.splice(+b.getAttribute('data-del'),1);save();renderAnn();renderOverview()}});
  document.getElementById('annForm').addEventListener('submit',function(e){e.preventDefault();var t=document.getElementById('annText');if(!t.value.trim())return;S.announcements.unshift({d:new Date().toISOString().slice(0,10),t:t.value.trim()});t.value='';save();renderAnn();renderOverview()});
  document.getElementById('addStudent').addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('newName'),r=document.getElementById('newRoll');if(!n.value.trim())return;S.students.push({id:r.value.trim()||('BS-'+(100+S.students.length+1)),name:n.value.trim(),lab:null,quiz:null,mid:null,project:null,final:null,att:100});n.value='';r.value='';save();all()});
  function csv(rows){return rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\n')}
  function download(name,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
  document.getElementById('expMarks').addEventListener('click',function(){var rows=[['Roll No','Name'].concat(COMP.map(function(c){return c.label+' /'+c.max}),['Attendance %','Total','Grade'])];S.students.forEach(function(s){var t=total(s);rows.push([s.id,s.name].concat(COMP.map(function(c){return s[c.k]}),[s.att,t.toFixed(1),grade(t)]))});download('ict-assessment-records.csv',csv(rows))});
  document.getElementById('expCLO').addEventListener('click',function(){var clos=['CLO 1','CLO 2','CLO 3','CLO 4'],rows=[['Roll No','Name'].concat(clos)];S.students.forEach(function(s){rows.push([s.id,s.name].concat(clos.map(function(c){return cloScore(s,c).toFixed(0)})))});rows.push(['','Achieved ≥50%'].concat(clos.map(function(c){return S.students.filter(function(s){return cloScore(s,c)>=50}).length+'/'+S.students.length})));download('ict-clo-report.csv',csv(rows))});
  document.getElementById('expCourse').addEventListener('click',function(){var rows=[['Lecture','Title','Plan reviewed','Taught','Lab conducted','Quiz released','Quiz average']];S.lectures.forEach(function(l,i){var q=S.quizzes[i];rows.push([l.n,l.title,l.plan?'Yes':'No',l.taught?'Yes':'No',l.lab?'Yes':'No',q.released?'Yes':'No',q.avg==null?'':q.avg])});download('ict-course-progress.csv',csv(rows))});
  document.getElementById('resetDemo').addEventListener('click',function(){S=seed();save();all()});
  all();
})();
