'use strict';
// Audio blobs and lyrics stay in this browser's IndexedDB; no upload endpoint.
const library = {
  async database() {
    if (!window.indexedDB) throw new Error('このブラウザでは端末保存を利用できません。通常モードのSafariやChromeでお試しください。');
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('song-practice-local',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('songs',{keyPath:'id'});
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('ほかの練習ページを閉じてから、もう一度お試しください。'));
      request.onsuccess=()=>resolve(request.result);
    });
  },
  async run(mode, action) {
    const db=await this.database();
    return new Promise((resolve,reject)=>{
      let result;
      const tx=db.transaction('songs',mode);
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onabort=()=>{db.close();reject(tx.error || new Error('保存処理が中断されました。'));};
      tx.onerror=()=>{};
      try { action(tx.objectStore('songs'), value=>{result=value;}); }
      catch(error){db.close();reject(error);}
    });
  },
  save(record) {return this.run('readwrite',(store)=>store.add(record));},
  remove(id) {return this.run('readwrite',store=>store.delete(id));},
  read(id) {return this.run('readonly',(store,done)=>{const r=store.get(id);r.onsuccess=()=>done(r.result);});},
  list() {return this.run('readonly',(store,done)=>{
    const rows=[];const r=store.openCursor();
    r.onsuccess=()=>{const cursor=r.result;if(!cursor){done(rows.sort((a,b)=>b.createdAt-a.createdAt));return;}
      const {id,title,createdAt}=cursor.value;rows.push({id,title,createdAt});cursor.continue();};
  });}
};
function storageError(error) {
  if(error?.name==='QuotaExceededError')return '端末の保存容量が不足しています。空き容量を増やすか、小さい音源でお試しください。入力内容はそのまま残っています。';
  if(error?.name==='SecurityError'||error?.name==='InvalidStateError')return '端末保存が制限されています。通常モードのSafariやChromeでお試しください。';
  return error?.message || '保存した曲を利用できませんでした。もう一度お試しください。';
}
