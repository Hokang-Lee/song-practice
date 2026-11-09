'use strict';
const $=id=>document.getElementById(id),audio=$('audio');
let lines=[{start:0,text:'声を合わせて'},{start:4,text:'ゆっくり歌おう'},{start:8,text:'ひと息ついて'},{start:12,text:'もう一度歌おう'}], selected=0,repeat=false,url='',ready=false;
const time=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
let pendingSeek = null;
function finishPendingSeek(){
  if(!ready||pendingSeek===null)return;
  try {audio.currentTime=pendingSeek;pendingSeek=null;$('status').textContent='選んだ位置に移動しました。「再生する」で聴けます。';}
  catch {$('status').textContent='選んだ位置の音声を読み込み中です…';}
}
function seekTo(position){
  pendingSeek=position;
  $('status').textContent=`${time(position)}を選びました。音声を読み込み中です…`;
  finishPendingSeek();
  // Some mobile browsers defer loading until a direct user gesture.
  if(!ready&&(audio.networkState===0||audio.networkState===1))audio.load();
  update();
}
function end(){return lines[selected+1]?.start??audio.duration;}
function render(){ $('lyrics').replaceChildren(...lines.map((line,i)=>{const b=document.createElement('button');b.className='line';const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span');text.textContent=line.text;b.append(n,text);b.onclick=()=>{selected=i;seekTo(line.start);};return b;}));update();}
function update(){const t=audio.currentTime||0;const active=lines.findIndex((l,i)=>t>=l.start&&t<(lines[i+1]?.start??Infinity));Array.from($('lyrics').children).forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('selected',i===selected);el.setAttribute('aria-current',i===active?'true':'false');});$('seek').value=t;$('time').textContent=`${time(t)} / ${time(audio.duration)}`;$('selection').textContent=`選んだ行：${selected+1}行目`;$('loop').textContent=repeat?'繰り返し：選んだ行':'繰り返し：なし';$('loop').setAttribute('aria-pressed',String(repeat));$('play').textContent=audio.paused?'▶ 再生する':'Ⅱ 一時停止';}
let away = false, playbackGeneration = 0;
function pauseWhenAway(){
  away = true;
  playbackGeneration++;
  audio.pause();
  $('status').textContent='画面を離れたため一時停止しました。「再生する」で続けられます。';
  update();
}
function returnToPage(){if(!document.hidden)away=false;}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseWhenAway();else returnToPage();});
window.addEventListener('pagehide',pauseWhenAway);
// Focus changes do not mean the page is hidden (notably on mobile browsers).
// Only visibilitychange/pagehide should interrupt listening.
window.addEventListener('pageshow',returnToPage);
async function play(){if(!ready||away||document.hidden)return;const generation=playbackGeneration;try{if(repeat&&(audio.currentTime<lines[selected].start||audio.currentTime>=end()))audio.currentTime=lines[selected].start;await audio.play();if(generation!==playbackGeneration||away||document.hidden){audio.pause();return;}$('status').textContent=repeat?'選んだ行を繰り返しています。':'再生しています。';}catch{if(generation===playbackGeneration&&!away&&!document.hidden)$('status').textContent='再生できませんでした。音声ファイルを確認してください。';}update();}
$('play').onclick=()=>{if(audio.paused)void play();else{audio.pause();$('status').textContent='一時停止しました。';}};
$('restart').onclick=()=>{repeat=false;selected=0;seekTo(0);};
$('loop').onclick=()=>{repeat=!repeat;if(repeat)seekTo(lines[selected].start);update();};
$('speed').onchange=()=>audio.playbackRate=Number($('speed').value);
const fontPreferenceKey='song-practice-font-size';
try {
  const savedFont=window.localStorage.getItem(fontPreferenceKey);
  if(['32','40','48'].includes(savedFont))$('font').value=savedFont;
} catch {}
function applyFontSize(){document.documentElement.style.setProperty('--lyric-size',$('font').value+'px');}
applyFontSize();
$('font').onchange=()=>{applyFontSize();try{window.localStorage.setItem(fontPreferenceKey,$('font').value);}catch{}};
$('seek').oninput=()=>{repeat=false;seekTo(Number($('seek').value));};
function tick(){if(ready&&repeat&&!audio.paused&&audio.currentTime>=end())audio.currentTime=lines[selected].start;update();}
audio.addEventListener('timeupdate',tick);setInterval(()=>{if(!audio.paused)tick();},40);
audio.addEventListener('ended',()=>{if(away||document.hidden)return;if(repeat){audio.currentTime=lines[selected].start;void play();}else{$('status').textContent='最後まで再生しました。もう一度練習できます。';update();}});
audio.addEventListener('pause',update);audio.addEventListener('play',update);
audio.addEventListener('loadedmetadata',()=>{ready=Number.isFinite(audio.duration)&&audio.duration>0;$('play').disabled=!ready;$('seek').max=audio.duration;audio.playbackRate=Number($('speed').value);if(lines.some(l=>l.start>=audio.duration)){$('status').textContent='歌詞の開始時刻が音声の長さを超えています。歌詞を修正してください。';ready=false;pendingSeek=null;$('play').disabled=true;}else if(ready){if(pendingSeek!==null)finishPendingSeek();else $('status').textContent='準備ができました。歌詞を選ぶか「再生する」を押してください。';}update();});
audio.addEventListener('canplay',()=>{finishPendingSeek();update();});
audio.addEventListener('error',()=>{ready=false;$('play').disabled=true;$('status').textContent='音声を読み込めません。MP4は音声入りで、このブラウザに対応した形式が必要です。再生できない場合はMP3またはWAVを選んでください。';});
function load(blob){audio.pause();pendingSeek=null;ready=false;repeat=false;$('play').disabled=true;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);audio.src=url;audio.preload='auto';audio.load();}
$('file').onchange=()=>{const file=$('file').files[0];if(!file)return;load(file);$('source').textContent=`お手本音声：${file.name}`;$('status').textContent='音声を読み込み中です。歌詞の開始時刻も合わせてください。';};
function parseLyrics(text,duration=audio.duration){const parsed=text.trim().split(/\r?\n/).filter(l=>l.trim()).map(l=>{const m=l.match(/^\[(\d+):([0-5]\d(?:\.\d+)?)\]\s*(.+)$/);if(!m)throw Error('各行を「[00:00]歌詞」の形式で入力してください。');return {start:Number(m[1])*60+Number(m[2]),text:m[3]};});if(!parsed.length||parsed.some((l,i)=>i>0&&l.start<=parsed[i-1].start))throw Error('開始時刻は小さい順で、重複しないようにしてください。');if(Number.isFinite(duration)&&parsed.some(l=>l.start>=duration))throw Error('開始時刻は音声の長さより短くしてください。');return parsed;}
$('apply').onclick=()=>{try{const parsed=parseLyrics($('editor').value);audio.pause();lines=parsed;selected=0;repeat=false;$('title').textContent=$('song-name').value.trim()||'歌の練習';ready=Number.isFinite(audio.duration)&&audio.duration>0;$('play').disabled=!ready;audio.currentTime=0;render();$('editor-status').textContent='反映しました。歌詞を押して練習できます。';}catch(e){$('editor-status').textContent=e.message;}};
// Self-generated demonstration tones; no external recording or hymn lyrics.
function demo(){const rate=16000,seconds=16,buffer=new ArrayBuffer(44+rate*seconds*2),view=new DataView(buffer);const str=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');view.setUint32(4,36+rate*seconds*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,rate*seconds*2,true);const notes=[261.63,293.66,329.63,261.63,329.63,349.23,392,329.63,392,349.23,329.63,293.66,329.63,293.66,261.63,261.63];for(let i=0;i<rate*seconds;i++){const t=i/rate,phase=t%1,envelope=Math.min(phase/.03,1)*Math.max(0,1-phase/.9);view.setInt16(44+i*2,Math.sin(2*Math.PI*notes[Math.floor(t)]*t)*envelope*5000,true);}return new Blob([buffer],{type:'audio/wav'});}
function selectSong(song) {
  playbackGeneration++;
  audio.pause();
  ready = false;
  pendingSeek = null;
  repeat = false;
  selected = 0;
  if(url){URL.revokeObjectURL(url);url='';}
  lines = parseLyrics(song.lyrics,Infinity);
  $('title').textContent = song.title;
  $('song-name').value = song.title;
  $('editor').value = song.lyrics;
  $('source').textContent = '歌詞を見ながら、一節ずつ練習しましょう。';
  $('file').value = '';
  $('editor-status').textContent = '';
  $('status').textContent = '音声を読み込み中です。先に歌詞を選んでおけます。';
  $('play').disabled = true;
  audio.src = song.audioBlob ? (url=URL.createObjectURL(song.audioBlob)) : song.audio;
  audio.preload = 'auto';
  audio.load();
  render();
}
const songs = window.practiceSongs || (window.practiceSong ? [window.practiceSong] : []);
if (songs.length) {
  $('song-select').replaceChildren(...songs.map((song,index)=>{
    const option=document.createElement('option');
    option.value=String(index);option.textContent=song.title;return option;
  }));
  let initialSong=0;
  try {
    const savedTitle=window.localStorage.getItem('song-practice-selected-title');
    const found=songs.findIndex(song=>song.title===savedTitle);
    if(found>=0)initialSong=found;
  } catch { /* Storage restrictions must not prevent practice. */ }
  $('song-select').value=String(initialSong);
  $('song-select').onchange=()=>{
    const song=songs[Number($('song-select').value)];
    if(song){
      selectSong(song);
      try {window.localStorage.setItem('song-practice-selected-title',song.title);}catch{}
    }
  };
  selectSong(songs[initialSong]);
} else { render();load(demo()); }
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'get_practice_state',description:'Read the current song practice playback state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({title:$('title').textContent,paused:audio.paused,time:audio.currentTime,selectedLine:selected+1,repeat})})).catch(()=>{});}catch{}}
