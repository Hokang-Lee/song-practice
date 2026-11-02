'use strict';
let openedSavedId=null,openedSavedSource=null;
async function refreshLibrary(selectedId) {
  const rows=await library.list();
  $('saved-select').replaceChildren(...rows.map(row=>{
    const option=document.createElement('option');option.value=row.id;
    option.textContent=`${row.title}（${new Date(row.createdAt).toLocaleString('ja-JP')}）`;return option;
  }));
  if(selectedId)$('saved-select').value=selectedId;
  $('open-saved').disabled=!rows.length;
  $('delete-saved').disabled=!rows.length;
  $('saved-select').disabled=!rows.length;
  $('library-status').textContent=rows.length?`${rows.length}曲がこの端末に保存されています。`:'まだ保存した曲はありません。下の「曲を準備する方へ」から保存できます。';
}
$('save-local').onclick=async()=>{
  const button=$('save-local');button.disabled=true;
  $('save-status').textContent='音源と歌詞を保存しています…';
  try {
    const title=$('song-name').value.trim();
    if(!title)throw new Error('曲名を入力してください。');
    const lyrics=$('editor').value.trim();
    parseLyrics(lyrics);
    if(!audio.src||audio.error||!Number.isFinite(audio.duration)||audio.duration<=0)throw new Error('音源を選び、読み込みが終わってから保存してください。');
    const response=await fetch(audio.src);
    if(!response.ok)throw new Error('音源を読み込めませんでした。ファイルを選び直してお試しください。');
    const blob=await response.blob();
    if(!blob.size)throw new Error('音源ファイルが空です。別の音源を選んでください。');
    const record={id:crypto.randomUUID(),title,lyrics,blob,createdAt:Date.now()};
    await library.save(record);
    $('save-status').textContent=`「${title}」をこの端末に保存しました。上の「保存した曲を開く」から使えます。`;
    try {await refreshLibrary(record.id);}catch{$('library-status').textContent='保存は完了しました。一覧を更新するにはページを開き直してください。';}
  }catch(error){$('save-status').textContent=storageError(error);}
  finally{button.disabled=false;}
};
async function openSavedSong(id){
  if(!id)return;
  $('open-saved').disabled=true;
  try{
    const song=await library.read(id);
    if(!song||!(song.blob instanceof Blob)||!song.blob.size)throw new Error('保存した音源が見つかりません。元の音源を選んで保存し直してください。');
    parseLyrics(song.lyrics,Infinity);
    selectSong({...song,audioBlob:song.blob});
    openedSavedId=id;openedSavedSource=audio.src;
    $('song-select').value='';
    $('source').textContent='この端末に保存した曲です。';
    $('library-status').textContent=`「${song.title}」を開きました。「再生する」で練習できます。`;
    $('play').focus();
  }catch(error){$('library-status').textContent=storageError(error);}
  finally{$('open-saved').disabled=false;}
}
$('open-saved').onclick=()=>openSavedSong($('saved-select').value);
$('delete-saved').onclick=async()=>{
  const id=$('saved-select').value;if(!id)return;
  const label=$('saved-select').selectedOptions[0].textContent;
  if(!confirm(`「${label}」をこの端末から削除しますか？\n保存した音源と歌詞を削除します。この操作は元に戻せません。\n公開の収録曲や耳コピの下書きは削除しません。`))return;
  $('delete-saved').disabled=true;$('open-saved').disabled=true;$('saved-select').disabled=true;
  try{
    await library.remove(id);
    if(openedSavedId===id&&openedSavedSource===audio.src){
      selectSong(window.practiceSongs[0]);$('song-select').value='0';
      openedSavedId=null;openedSavedSource=null;
    }
    const address=new URL(location.href);
    if(address.searchParams.get('saved')===id){address.searchParams.delete('saved');history.replaceState(null,'',address);}
    await refreshLibrary();
    $('library-status').textContent=`「${label}」をこの端末から削除しました。`;
  }catch(error){
    $('library-status').textContent=storageError(error);
  }finally{
    const empty=!$('saved-select').options.length;
    $('delete-saved').disabled=empty;$('open-saved').disabled=empty;$('saved-select').disabled=empty;
  }
};
(async()=>{
  const id=new URLSearchParams(location.search).get('saved');
  await refreshLibrary(id);
  if(id){$('local-library').open=true;await openSavedSong(id);}
})().catch(error=>{$('library-status').textContent=storageError(error);});
