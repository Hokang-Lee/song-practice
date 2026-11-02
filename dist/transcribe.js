'use strict';
(()=>{
const $=id=>document.getElementById(id), audio=$('track');
let state={name:'',text:'',rows:[],cursor:0,blob:null,filename:''},history=[],url='',db=null,ready=false,saveQueue=Promise.resolve();
const say=text=>$('message').textContent=text;
const format=t=>{const ticks=Math.round(t*100);return `${String(Math.floor(ticks/6000)).padStart(2,'0')}:${String(Math.floor(ticks/100)%60).padStart(2,'0')}.${String(ticks%100).padStart(2,'0')}`;};
function snapshot(){history.push({...state,rows:state.rows.map(r=>({...r}))});if(history.length>100)history.shift();}
function save(){
 if(!ready)return;
 const copy={...state,rows:state.rows.map(r=>({...r}))};
 $('saved').textContent='保存中…';
 saveQueue=saveQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
  if(!db){reject(Error('保存機能が利用できません'));return;}
  const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(copy,'current');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })).then(()=>$('saved').textContent='この端末に自動保存しました。').catch(()=>$('saved').textContent='保存できません。容量やブラウザの設定を確認し、LRCをダウンロードしてください。');
}
function attach(){audio.pause();if(url)URL.revokeObjectURL(url);url='';audio.removeAttribute('src');if(state.blob){url=URL.createObjectURL(state.blob);audio.src=url;}audio.load();$('filename').textContent=state.filename||'音源を選んでください。';}
function sync(){
 let active=-1;state.rows.forEach((r,i)=>{if(r.time!==null&&r.time<=audio.currentTime)active=i;});
 [...$('rows').children].forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('selected',i===state.cursor);el.querySelector('.row-pick').setAttribute('aria-current',String(i===active));});
 $('stamp').disabled=!ready||!Number.isFinite(audio.duration)||state.cursor>=state.rows.length;
 $('undo').disabled=!history.length;
 $('next').textContent=state.rows.length?(state.cursor<state.rows.length?`次は ${state.cursor+1}行目：${state.rows[state.cursor].text}`:'全行を記録しました。行を選ぶと修正できます。'):'歌詞を取り込んでください。';
}
function changeTime(i,value){if(!Number.isFinite(value)||value<0||(Number.isFinite(audio.duration)&&value>=audio.duration)){say('時刻は0秒以上、音源の長さ未満にしてください。');render();return;}snapshot();state.rows[i].time=Math.round(value*100)/100;say('時刻を変更しました。');render();save();}
function render(){
 $('rows').replaceChildren();
 state.rows.forEach((r,i)=>{
  const row=document.createElement('div');row.className='stamp-row';
  const pick=document.createElement('button');pick.className='row-pick';pick.textContent=`${i+1}. ${r.time===null?'未記録':'['+format(r.time)+']'} ${r.text}`;
  pick.onclick=()=>{state.cursor=i;if(r.time!==null&&Number.isFinite(audio.duration))audio.currentTime=Math.min(r.time,audio.duration);sync();save();};
  const bar=document.createElement('div');bar.className='row-tools';const input=document.createElement('input');input.type='number';input.min='0';input.step='0.1';input.value=r.time===null?'':r.time;input.placeholder='未記録';input.setAttribute('aria-label',`${i+1}行目の開始秒`);input.onchange=()=>{if(input.value===''){snapshot();r.time=null;render();save();}else changeTime(i,Number(input.value));};bar.append(input);
  for(const delta of [-1,-.1,.1,1]){const b=document.createElement('button');b.textContent=`${delta>0?'+':''}${delta}秒`;b.disabled=r.time===null;b.onclick=()=>changeTime(i,r.time+delta);bar.append(b);}
  row.append(pick,bar);$('rows').append(row);
 });sync();
}
function stamp(){if($('stamp').disabled)return;snapshot();state.rows[state.cursor].time=Math.round(audio.currentTime*100)/100;state.cursor++;say('記録しました。');render();save();}
function undo(){if(!history.length)return;const oldBlob=state.blob;state=history.pop();$('name').value=state.name;$('text').value=state.text;if(oldBlob!==state.blob)attach();render();save();say('直前の変更を戻しました。');}
function parse(text){return text.split(/\r?\n/).filter(s=>s.trim()).map(line=>{const m=line.match(/^\[(\d+):([0-5]\d(?:\.\d+)?)\]\s*(.*)$/);if(line.startsWith('[')&&!m)throw Error('時刻は [分:秒]歌詞 の形式にしてください。');return {text:m?m[3]:line,time:m?Number(m[1])*60+Number(m[2]):null};});}
 $('prepare').onclick=()=>{try{const rows=parse($('text').value);if(!rows.length)throw Error('歌詞を貼り付けてください。');snapshot();state.rows=rows;state.cursor=0;state.text=$('text').value;render();save();say('再生して歌いだしで記録してください。');}catch(e){say(e.message);}};
 $('name').oninput=()=>{state.name=$('name').value;save();};$('text').oninput=()=>{state.text=$('text').value;save();};
 $('media').onchange=()=>{const file=$('media').files[0];if(!file)return;snapshot();state.blob=file;state.filename=file.name;attach();save();say('音源を読み込みます。');};
 $('rate').onchange=()=>audio.playbackRate=Number($('rate').value);
 $('stamp').onclick=stamp;$('undo').onclick=undo;
 document.addEventListener('keydown',e=>{
  if(e.isComposing||e.repeat||e.target.closest('input,textarea,select,button,a,[contenteditable=true]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.code==='Space'||e.key==='Enter')){e.preventDefault();stamp();}
 });
 // Return focus to the page after pointer operations, so marking keys stay available.
 document.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&e.detail>0)button.blur();});
 audio.addEventListener('timeupdate',sync);audio.addEventListener('loadedmetadata',()=>{audio.playbackRate=Number($('rate').value);sync();});audio.addEventListener('error',()=>{say('この音源を再生できません。対応するMP3・WAV・MP4を選んでください。');sync();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});window.addEventListener('pagehide',()=>audio.pause());
 $('export').onclick=()=>{
  if(!state.rows.length){say('歌詞を取り込んでください。');return;}
  const bad=state.rows.findIndex((r,i)=>r.time===null||!Number.isFinite(r.time)||r.time<0||(i>0&&r.time<=state.rows[i-1].time)||(Number.isFinite(audio.duration)&&r.time>=audio.duration));
  if(bad>=0){say(`${bad+1}行目の時刻を確認してください。未記録・重複・逆順・音源の範囲外は出力できません。`);return;}
  const lrc=state.rows.map(r=>`[${format(r.time)}]${r.text}`).join('\n')+'\n';
  const link=document.createElement('a'),href=URL.createObjectURL(new Blob([lrc],{type:'text/plain;charset=utf-8'}));link.href=href;link.download=(state.name||'歌詞').replace(/[\\/:*?"<>|]/g,'_')+'.lrc';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);say('LRCを書き出しました。');
 };
 async function init(){
  for(const id of ['name','text','media','prepare','export'])$(id).disabled=true;
  try{
   db=await new Promise((resolve,reject)=>{const req=indexedDB.open('song-practice-transcription',1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   const saved=await new Promise((resolve,reject)=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   if(saved){state=saved;$('name').value=state.name;$('text').value=state.text;attach();}
   $('saved').textContent=saved?'保存した下書きを復元しました。':'変更はこの端末に自動保存します。';
  }catch{$('saved').textContent='自動保存が使えません。LRCをダウンロードして保管してください。';}
  ready=true;for(const id of ['name','text','media','prepare','export'])$(id).disabled=false;render();
 }
 void init();
})();
