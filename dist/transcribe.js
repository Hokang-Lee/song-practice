'use strict';
(()=>{
const $=id=>document.getElementById(id), audio=$('track');
let state={name:'',text:'',rows:[],cursor:0,blob:null,filename:''},history=[],url='',db=null,ready=false,selectedRow=null,saveQueue=Promise.resolve(),cancelTranscription=false,fileTranscribing=false;
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
 [...$('rows').children].forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('selected',i===selectedRow||selectedRow===null&&i===state.cursor);el.querySelector('.row-pick').setAttribute('aria-current',String(i===active));});
 $('stamp').disabled=!ready||!Number.isFinite(audio.duration)||state.cursor>=state.rows.length;
 $('clear-lyrics').disabled=!ready||(!state.text&&!state.rows.length);
 $('update-selected').disabled=!ready||!Number.isFinite(audio.duration)||selectedRow===null;
 $('undo').disabled=!history.length;
 $('next').textContent=state.rows.length?(state.cursor<state.rows.length?`次は ${state.cursor+1}行目：${state.rows[state.cursor].text}`:'全行を記録しました。行を選ぶと修正できます。'):'歌詞を取り込んでください。';
}
function changeTime(i,value){if(!Number.isFinite(value)||value<0||(Number.isFinite(audio.duration)&&value>=audio.duration)){say('時刻は0秒以上、音源の長さ未満にしてください。');render();return;}snapshot();state.rows[i].time=Math.round(value*100)/100;say('時刻を変更しました。');render();save();}
function render(){
 $('rows').replaceChildren();
 state.rows.forEach((r,i)=>{
  const row=document.createElement('div');row.className='stamp-row';
  const pick=document.createElement('button');pick.className='row-pick';pick.textContent=`${i+1}. ${r.time===null?'未記録':'['+format(r.time)+']'} ${r.text}`;
  pick.onclick=()=>{selectedRow=i;if(r.time!==null&&Number.isFinite(audio.duration))audio.currentTime=Math.min(r.time,audio.duration);sync();save();};
  const bar=document.createElement('div');bar.className='row-tools';const input=document.createElement('input');input.type='number';input.min='0';input.step='0.1';input.value=r.time===null?'':r.time;input.placeholder='未記録';input.setAttribute('aria-label',`${i+1}行目の開始秒`);input.onchange=()=>{if(input.value===''){snapshot();r.time=null;render();save();}else changeTime(i,Number(input.value));};bar.append(input);
  for(const delta of [-1,-.1,.1,1]){const b=document.createElement('button');b.textContent=`${delta>0?'+':''}${delta}秒`;b.disabled=r.time===null;b.onclick=()=>changeTime(i,r.time+delta);bar.append(b);}
  row.append(pick,bar);$('rows').append(row);
 });sync();
}
function stamp(){if($('stamp').disabled)return;snapshot();state.rows[state.cursor].time=Math.round(audio.currentTime*100)/100;state.cursor++;say('記録しました。');render();save();}
function updateSelected(){
 if($('update-selected').disabled)return;
 const i=selectedRow,value=Math.round(audio.currentTime*100)/100;
 if(i>0&&state.rows[i-1].time!==null&&value<=state.rows[i-1].time||i<state.rows.length-1&&state.rows[i+1].time!==null&&value>=state.rows[i+1].time){say('前後の行との順番が逆にならない位置を選んでください。必要なら先に隣の行も調整してください。');return;}
 snapshot();state.rows[i].time=value;say(`${i+1}行目を ${format(value)} に修正しました。`);render();save();
}
function undo(){if(!history.length)return;const oldBlob=state.blob;state=history.pop();$('name').value=state.name;$('text').value=state.text;if(oldBlob!==state.blob)attach();render();save();say('直前の変更を戻しました。');}
function parse(text){return text.split(/\r?\n/).filter(s=>s.trim()).map(line=>{const m=line.match(/^\[(\d+):([0-5]\d(?:\.\d+)?)\]\s*(.*)$/);if(line.startsWith('[')&&!m)throw Error('時刻は [分:秒]歌詞 の形式にしてください。');return {text:m?m[3]:line,time:m?Number(m[1])*60+Number(m[2]):null};});}
 $('prepare').onclick=()=>{try{const rows=parse($('text').value);if(!rows.length)throw Error('歌詞を貼り付けてください。');snapshot();state.rows=rows;state.cursor=0;state.text=$('text').value;render();save();say('再生して歌いだしで記録してください。');}catch(e){say(e.message);}};
 $('name').oninput=()=>{state.name=$('name').value;save();};$('text').oninput=()=>{state.text=$('text').value;sync();save();};
 $('media').onchange=()=>{const file=$('media').files[0];if(!file)return;snapshot();state.blob=file;state.filename=file.name;$('transcribe').disabled=false;$('name').value=$('name').value||file.name.replace(/\.[^.]+$/,'');state.name=$('name').value;attach();save();say('音源を読み込みます。');};
let recognizerPromise=null;
async function getTranscriber(status){
 if(!recognizerPromise){
  recognizerPromise=import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2').then(async({pipeline,env})=>{
   env.allowLocalModels=false;
   const options={dtype:'q8',...(navigator.gpu?{device:'webgpu'}:{device:'wasm'})};
   try{return await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',options);}catch(error){
    if(!navigator.gpu)throw error;
    status.textContent='GPUで起動できないため、省メモリー方式で準備しています…';
    return pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{dtype:'q8',device:'wasm'});
   }
  }).catch(error=>{recognizerPromise=null;throw error;});
 }
 status.textContent='韓国語モデルを準備しています。初回はモデルの取得に時間がかかります…';
 return recognizerPromise;
}
function mono16k(audioBuffer){
 const source=audioBuffer.getChannelData(0),step=audioBuffer.sampleRate/16000,length=Math.ceil(source.length/step),out=new Float32Array(length);
 for(let i=0;i<length;i++){const at=i*step,left=Math.floor(at),right=Math.min(left+1,source.length-1),mix=at-left;out[i]=source[left]*(1-mix)+source[right]*mix;}
 return out;
}
function timeTag(seconds){const ticks=Math.max(0,Math.round(seconds*100));return `[${String(Math.floor(ticks/6000)).padStart(2,'0')}:${String(Math.floor(ticks/100)%60).padStart(2,'0')}.${String(ticks%100).padStart(2,'0')}]`;}
$('transcribe').onclick=async()=>{
 const button=$('transcribe');button.disabled=true;fileTranscribing=true;$('live-start').disabled=true;
 const cancel=$('cancel-transcribe'),status=$('asr-status');cancel.hidden=false;cancel.disabled=false;cancelTranscription=false;status.textContent='音源を読み込んでいます…';
 try{
  if(!state.blob?.size)throw Error('先に音源を選んでください。');
  const context=new AudioContext();let decoded;
  try{decoded=await context.decodeAudioData(await state.blob.arrayBuffer());}finally{await context.close();}
  const transcriber=await getTranscriber(status);
  const samples=mono16k(decoded),windowSize=16000*30,total=Math.ceil(samples.length/windowSize),drafts=[];
  for(let i=0;i<total;i++){
   if(cancelTranscription)throw Error('認識を中止しました。歌詞は変更していません。');
   const offset=i*30,end=Math.min(samples.length,(i+1)*windowSize);
   status.textContent=`韓国語音声を認識中… ${i+1}/${total}区間（音源 ${offset}秒から）`;
   const result=await transcriber(samples.slice(i*windowSize,end),{language:'ko',task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:true,no_repeat_ngram_size:3,repetition_penalty:1.15});
   const chunks=result.chunks||[];
   const segment=chunks.map(chunk=>({start:chunk.timestamp?.[0],text:chunk.text?.trim()})).filter(item=>Number.isFinite(item.start)&&item.text).map(item=>`${timeTag(offset+item.start)}${item.text}`);
   if(!segment.length&&result.text?.trim())segment.push(`${timeTag(offset)}${result.text.trim()}`);
   const segmentText=segment.map(line=>line.replace(/^\[[^\]]+\]/,'')).join('');
   const segmentLetters=(segmentText.match(/[\p{L}]/gu)||[]).length,segmentHangul=(segmentText.match(/[\uac00-\ud7af]/g)||[]).length;
   if(segmentLetters>=18&&segmentHangul/segmentLetters<0.45)throw Error('冒頭部分を韓国語として認識できませんでした。全曲の処理を中止し、歌詞は取り込んでいません。歌詞を貼り付けて時刻を手動記録してください。');
   drafts.push(...segment);
  }
  if(!drafts.length)throw Error('歌詞を聞き取れませんでした。音量や音源を確認してください。');
  const recognized=drafts.map(line=>line.replace(/^\[[^\]]+\]/,'')).join('');
  const hangul=(recognized.match(/[\uac00-\ud7af]/g)||[]).length;
  const letters=(recognized.match(/[\p{L}]/gu)||[]).length;
  const repeated=/((.{2,24}?)\2{3,})/u.test(recognized);
  const words=recognized.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);let looped=false;
  for(let size=3;size<=6&&!looped;size++){const counts=new Map();for(let i=0;i+size<=words.length;i++){const phrase=words.slice(i,i+size).join(' '),count=(counts.get(phrase)||0)+1;counts.set(phrase,count);if(count>=8&&count*size>=words.length*0.4){looped=true;break;}}}
  if(letters>0&&(hangul/letters<0.45||repeated||looped))throw Error('韓国語の歌詞として認識できませんでした。認識結果は取り込んでいません。音声を確認するか、歌詞を貼り付けてください。');
  snapshot();$('text').value=drafts.join('\n');state.text=$('text').value;
  try{const rows=parse(state.text);state.rows=rows;state.cursor=0;selectedRow=null;render();}catch{}
  save();status.textContent=`${drafts.length}行の歌詞候補を作りました。歌詞や時刻を確認し、必要な箇所を修正してください。`;
 }catch(error){
  status.textContent=error.message?.includes('fetch')?'モデルを取得できませんでした。通信を確認して、もう一度お試しください。':`認識できませんでした：${error.message||'音声形式や端末の空きメモリーを確認してください。'}`;
 }finally{button.disabled=false;fileTranscribing=false;if(!live.active&&live.jobs===0)$('live-start').disabled=false;cancel.hidden=true;cancel.disabled=false;}
};
 $('cancel-transcribe').onclick=()=>{cancelTranscription=true;$('cancel-transcribe').disabled=true;$('asr-status').textContent='停止しています。現在の30秒区間の処理後に中止します…';};
const live={active:false,stream:null,context:null,source:null,processor:null,mute:null,buffers:[],sampleCount:0,sampleRate:0,offset:0,jobs:0,queue:Promise.resolve()};
function resample16k(samples,sampleRate){
 const step=sampleRate/16000,length=Math.ceil(samples.length/step),out=new Float32Array(length);
 for(let i=0;i<length;i++){const at=i*step,left=Math.floor(at),right=Math.min(left+1,samples.length-1),mix=at-left;out[i]=samples[left]*(1-mix)+samples[right]*mix;}
 return out;
}
function enqueueLiveSamples(samples,offset,sampleRate){
 if(live.jobs>=2){$('live-status').textContent='端末の処理が追いつかず、この区間をスキップしました。認識中の区間が終わるまでお待ちください。';return;}
 live.jobs++;
 live.queue=live.queue.then(async()=>{
  const status=$('live-status');status.textContent=`マイク音声を認識中…（${Math.floor(offset)}秒地点）`;
  const transcriber=await getTranscriber(status),result=await transcriber(resample16k(samples,sampleRate),{language:'ko',task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:true,no_repeat_ngram_size:3,repetition_penalty:1.15});
  const parts=(result.chunks||[]).map(item=>({start:item.timestamp?.[0],text:item.text?.trim()})).filter(item=>Number.isFinite(item.start)&&item.text).map(item=>`[${format(offset+item.start)}]${item.text}`);
  if(!parts.length&&result.text?.trim())parts.push(`[${format(offset)}]${result.text.trim()}`);
  if(parts.length){
   snapshot();const current=$('text').value.trimEnd();$('text').value=[current,...parts].filter(Boolean).join('\n');state.text=$('text').value;
   try{state.rows=parse(state.text);state.cursor=state.rows.length;selectedRow=null;render();}catch{}
   save();status.textContent=`${parts.length}行を歌詞欄へ追記しました。認識位置：約${Math.floor(offset+samples.length/sampleRate)}秒`;
  }else status.textContent='この区間では歌詞を認識できませんでした。引き続きマイクを聞いています。';
 }).catch(error=>{$('live-status').textContent=`認識に失敗しました：${error.message||'音声または端末を確認してください。'}`;}).finally(()=>{
  live.jobs--;if(!live.active&&live.jobs===0){$('live-start').disabled=false;$('transcribe').disabled=!state.blob;$('live-status').textContent=$('live-status').textContent||'ライブ認識を停止しました。';}
 });
}
function collectLiveAudio(event){
 if(!live.active)return;
 const input=event.inputBuffer.getChannelData(0),copy=new Float32Array(input);live.buffers.push(copy);live.sampleCount+=copy.length;
 const windowSize=live.sampleRate*12;
 if(live.sampleCount>=windowSize){
  const combined=new Float32Array(live.sampleCount);let cursor=0;for(const part of live.buffers){combined.set(part,cursor);cursor+=part.length;}
  const segment=combined.slice(0,windowSize),remainder=combined.slice(windowSize);live.buffers=remainder.length?[remainder]:[];live.sampleCount=remainder.length;
  const offset=live.offset;live.offset+=12;enqueueLiveSamples(segment,offset,live.sampleRate);
 }
}
async function stopLiveRecognition(){
 live.active=false;
 if(live.processor){live.processor.onaudioprocess=null;try{live.processor.disconnect();}catch{}live.processor=null;}
 if(live.source){try{live.source.disconnect();}catch{}live.source=null;}
 if(live.mute){try{live.mute.disconnect();}catch{}live.mute=null;}
 if(live.stream){live.stream.getTracks().forEach(track=>track.stop());live.stream=null;}
 if(live.context){const context=live.context;live.context=null;try{await context.close();}catch{}}
 if(live.sampleCount>=live.sampleRate*2){const remaining=new Float32Array(live.sampleCount);let cursor=0;for(const part of live.buffers){remaining.set(part,cursor);cursor+=part.length;}enqueueLiveSamples(remaining,live.offset,live.sampleRate);}
 live.buffers=[];live.sampleCount=0;$('live-stop').hidden=true;$('live-start').disabled=live.jobs>0;$('transcribe').disabled=live.jobs>0||!state.blob;
 if(live.jobs>0)$('live-status').textContent='マイクを停止しました。残りの認識処理を終えています…';
 else $('live-status').textContent='ライブ認識を停止しました。';
}
async function startLiveRecognition(){
 const status=$('live-status');
 if(fileTranscribing){status.textContent='音源ファイルの認識が終わってからお使いください。';return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext){status.textContent='ライブ認識にはHTTPS接続とマイクに対応したブラウザが必要です。';return;}
 $('live-start').disabled=true;status.textContent='マイクの使用許可を確認しています…';
 try{
  live.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  live.context=new AudioContext();await live.context.resume();live.sampleRate=live.context.sampleRate;live.offset=0;live.buffers=[];live.sampleCount=0;live.jobs=0;live.queue=Promise.resolve();
  live.source=live.context.createMediaStreamSource(live.stream);live.processor=live.context.createScriptProcessor(4096,1,1);live.mute=live.context.createGain();live.mute.gain.value=0;
  live.processor.onaudioprocess=collectLiveAudio;live.source.connect(live.processor);live.processor.connect(live.mute);live.mute.connect(live.context.destination);live.active=true;
  $('live-stop').hidden=false;$('transcribe').disabled=true;status.textContent='マイクを聞いています。約12秒ごとに歌詞候補を追記します。';
 }catch(error){
  if(live.stream)live.stream.getTracks().forEach(track=>track.stop());if(live.context)try{await live.context.close();}catch{}live.stream=null;live.context=null;$('live-start').disabled=false;
  status.textContent=error.name==='NotAllowedError'?'マイクの使用が許可されませんでした。ブラウザのサイト設定でマイクを許可してください。':`マイクを開始できませんでした：${error.message||'端末の設定を確認してください。'}`;
 }
}
 $('live-start').onclick=startLiveRecognition;$('live-stop').onclick=stopLiveRecognition;
 $('rate').onchange=()=>audio.playbackRate=Number($('rate').value);
 $('clear-lyrics').onclick=()=>{if(!$('clear-lyrics').disabled){snapshot();state.text='';state.rows=[];state.cursor=0;selectedRow=null;$('text').value='';render();save();say('歌詞と時刻を消しました。音源と曲名は残しています。');}};
 $('stamp').onclick=stamp;$('update-selected').onclick=updateSelected;$('undo').onclick=undo;
 document.addEventListener('keydown',e=>{
  if(e.isComposing||e.repeat||e.target.closest('input,textarea,select,button,a,[contenteditable=true]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.code==='Space'||e.key==='Enter')){e.preventDefault();stamp();}
 });
 // Return focus to the page after pointer operations, so marking keys stay available.
 document.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&e.detail>0)button.blur();});
 audio.addEventListener('timeupdate',sync);audio.addEventListener('loadedmetadata',()=>{audio.playbackRate=Number($('rate').value);sync();});audio.addEventListener('error',()=>{say('この音源を再生できません。対応するMP3・WAV・MP4を選んでください。');sync();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});window.addEventListener('pagehide',()=>{audio.pause();if(live.active)void stopLiveRecognition();});
 function makeLrc(){
  if(!state.rows.length)throw Error('歌詞を取り込んでください。');
  const bad=state.rows.findIndex((r,i)=>r.time===null||!Number.isFinite(r.time)||r.time<0||(i>0&&r.time<=state.rows[i-1].time)||(Number.isFinite(audio.duration)&&r.time>=audio.duration));
  if(bad>=0)throw Error(`${bad+1}行目の時刻を確認してください。未記録・重複・逆順・音源の範囲外は出力できません。`);
  if(state.rows.some(r=>!r.text.trim()))throw Error('空の歌詞行を修正してください。');
  return state.rows.map(r=>`[${format(r.time)}]${r.text}`).join('\n')+'\n';
 }
 $('practice').onclick=async()=>{
  const button=$('practice');button.disabled=true;
  try{
   const lyrics=makeLrc();
   if(!state.blob?.size||audio.error||!Number.isFinite(audio.duration))throw Error('音源を選び、読み込みが終わってからお試しください。');
   const title=state.name.trim()||state.filename.replace(/\.[^.]+$/,'')||'耳コピした曲';
   const record={id:crypto.randomUUID(),title,lyrics,blob:state.blob,createdAt:Date.now()};
   say('音源と歌詞を保存しています…');audio.pause();
   await library.save(record);
   await saveQueue;
   location.href='./?saved='+encodeURIComponent(record.id);
  }catch(error){say(storageError(error));button.disabled=false;}
 };
 $('export').onclick=()=>{
  let lrc;try{lrc=makeLrc();}catch(error){say(error.message);return;}
  const link=document.createElement('a'),href=URL.createObjectURL(new Blob([lrc],{type:'text/plain;charset=utf-8'}));link.href=href;link.download=(state.name||'歌詞').replace(/[\\/:*?"<>|]/g,'_')+'.lrc';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);say('LRCを書き出しました。');
 };
 async function init(){
  for(const id of ['name','text','media','prepare','export','transcribe','clear-lyrics'])$(id).disabled=true;
  try{
   db=await new Promise((resolve,reject)=>{const req=indexedDB.open('song-practice-transcription',1);req.onupgradeneeded=()=>req.result.createObjectStore('draft');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   const saved=await new Promise((resolve,reject)=>{const req=db.transaction('draft').objectStore('draft').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   if(saved){state=saved;$('name').value=state.name;$('text').value=state.text;attach();}
   $('saved').textContent=saved?'保存した下書きを復元しました。':'変更はこの端末に自動保存します。';
  }catch{$('saved').textContent='自動保存が使えません。LRCをダウンロードして保管してください。';}
  ready=true;for(const id of ['name','text','media','prepare','export','practice'])$(id).disabled=false;$('transcribe').disabled=!state.blob;render();
 }
 void init();
})();
