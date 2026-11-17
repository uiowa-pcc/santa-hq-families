/* Santa HQ family accounts: cookie sessions, private households, offline queue. No Worker URL or admin token for guests. */
(function(){
'use strict';
const E=v=>escapeHTML(String(v??''));
const ui={user:null,family:null,queue:{},busy:false,reading:false,timer:null,connected:false,lastError:'',signature:'',applying:false,invite:new URL(location.href).searchParams.get('invite')||'',started:false};
const G=document.getElementById('familyGate');
const LOCAL_PREFIX='santa_hq_multi_queue_';
const profileFields=['familyName','child1','child2','budget1','budget2','grownupPin','traditions'];
function qKey(){return LOCAL_PREFIX+(ui.family?.id||'guest')}
function saveQueue(){if(ui.family)localStorage.setItem(qKey(),JSON.stringify(ui.queue))}
function countQueue(){return Object.keys(ui.queue).length}
function feedback(message){const n=document.getElementById('familyError');if(n){n.textContent=message||'';n.hidden=!message}}
async function api(route,data){
  const response=await fetch(route,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  let result;try{result=await response.json()}catch{result={}};
  if(!response.ok)throw Error(result.error||`Request failed (${response.status}).`);
  return result;
}
const escapeInput=v=>E(v).replace(/`/g,'');
function gate(){
  G.hidden=false;
  const signing=G.dataset.mode==='signin',invite=!!ui.invite;
  G.innerHTML=`<div class="fa-shell"><div class="fa-art"><img src="./art/santa-peek.svg" alt="" onerror="this.style.display='none'"><span class="fa-wordmark">santa hq<span>.</span></span></div>
    <span class="fa-kicker">YOUR FAMILY'S LITTLE NORTH POLE</span><h1>${signing?'Welcome back!':'Make Christmas magic.'}</h1>
    <p class="fa-lede">${invite?'You have been invited to plan Christmas together. Sign in or create your account to join this family.':'One beautiful planner for gifts, stockings, traditions and all the little moments.'}</p>
    <form id="familyAuthForm" class="fa-form">
      ${!signing&&!invite?`<label>Family name<input name="familyName" required maxlength="70" placeholder="e.g. The Smiths' North Pole"></label><div class="fa-half"><label>Child 1 name<input name="child1" required maxlength="50" placeholder="First child"></label><label>Child 2 name<input name="child2" required maxlength="50" placeholder="Second child"></label></div><div class="fa-half"><label>First gift budget ($)<input name="budget1" type="number" min="0" step="0.01" value="250"></label><label>Second gift budget ($)<input name="budget2" type="number" min="0" step="0.01" value="250"></label></div>`:''}
      <label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
      <label>Password<input name="password" type="password" autocomplete="${signing?'current-password':'new-password'}" required minlength="${signing?1:12}" placeholder="${signing?'Your password':'At least 12 characters'}"></label>
      ${!signing?'<p class="fa-help">Use a unique password. Email verification and password resets are not yet available in this version.</p>':''}
      <p id="familyError" class="fa-error" role="alert" hidden></p>
      <button class="primary fa-submit" type="submit">${signing?'Sign in':'Create my family HQ'}</button>
    </form>
    <div class="fa-bottom">${signing?'New to Santa HQ?':'Already have an account?'} <button type="button" data-fa="toggle">${signing?'Create an account':'Sign in'}</button></div>
    <div class="fa-private">🔒 Gift lists are private to your family. Relatives only see what you choose to share.</div>
  </div>`;
}
function updateStatus(){
  const online=ui.connected&&countQueue()===0&&!ui.lastError;
  const dot=document.getElementById('topSyncDot');if(dot){dot.classList.toggle('online',online);dot.title=online?'Family gifts synced':countQueue()?`${countQueue()} offline edits waiting`:'Waiting for connection';}
  const side=document.querySelector('#sideSync span');if(side)side.textContent=online?'Family HQ synced':countQueue()?`${countQueue()} edits waiting to sync`:'Sync needs attention';
}
function enqueue(kind,key,data,deleted=false){
  if(!ui.connected||ui.applying||!ui.family)return;
  const k=kind+':'+key;
  ui.queue[k]={kind,id:key,data:deleted?null:data,deleted,nonce:crypto.randomUUID()};
  saveQueue();updateStatus();schedule();
}
async function flush(){
  if(!ui.connected||ui.busy||!ui.family)return;
  ui.busy=true;
  try{
    for(const [k,op] of Object.entries(ui.queue)){
      await api('/api/private/write',{kind:op.kind,id:op.id,data:op.data,deleted:op.deleted});
      if(ui.queue[k]?.nonce===op.nonce)delete ui.queue[k];
      saveQueue();
    }
    ui.lastError='';
  }catch(err){ui.lastError=err.message;console.warn('Santa HQ sync:',err);}
  finally{ui.busy=false;updateStatus();}
}
function schedule(){clearTimeout(ui.timer);ui.timer=setTimeout(flush,250)}
function overlayPending(collection,kind){
  const result=[...collection];
  for(const item of Object.values(ui.queue).filter(x=>x.kind===kind)){
    const n=result.findIndex(x=>x.id===item.id);if(n>=0)result.splice(n,1);
    if(!item.deleted)result.push(item.data);
  }
  return result;
}
async function applyRemote(rows){
  const gifts=overlayPending(rows.filter(r=>r.kind==='gift'&&!r.deleted).map(r=>r.data),'gift');
  const mail=overlayPending(rows.filter(r=>r.kind==='mail'&&!r.deleted).map(r=>r.data),'mail');
  const p=ui.queue['profile:main']?.data||rows.find(r=>r.kind==='profile'&&r.id==='main'&&!r.deleted)?.data||{};
  const signature=JSON.stringify({gifts,mail,p});if(signature===ui.signature)return;
  ui.applying=true;
  try{
    await rawReplaceGifts(gifts);await rawReplaceMail(mail);
    appState.gifts=gifts;appState.messages=mail;
    settings={...DEFAULT,...Object.fromEntries(profileFields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))};
    rawSaveSettings();ui.signature=signature;
    const active=document.activeElement;
    const typing=active&&active.matches('input,select,textarea,[contenteditable]')&&active.closest('#content,#overlay,#kidPortal');
    if(!typing&&ui.started&&!appState.kidActive)render();
  }finally{ui.applying=false;updateStatus()}
}
async function refresh(){
  if(!ui.connected||ui.reading||document.hidden)return;
  ui.reading=true;
  try{
    await flush();if(countQueue())return;
    const r=await api('/api/private/state');await applyRemote(r.records);
    ui.lastError='';
  }catch(err){ui.lastError=err.message;console.warn('Santa HQ refresh:',err)}
  finally{ui.reading=false;updateStatus()}
}
const rawPutGift=putGift,rawRemoveGift=removeGift,rawReplaceGifts=replaceGifts,rawReplaceMail=replaceMail,rawPutMail=putMail,rawSaveSettings=saveSettingsLocal;
putGift=async g=>{const result=await rawPutGift(g);enqueue('gift',g.id,g);return result};
removeGift=async id=>{const result=await rawRemoveGift(id);enqueue('gift',id,null,true);return result};
putMail=async m=>{await rawPutMail(m);enqueue('mail',m.id,m)};
saveSettingsLocal=function(){rawSaveSettings();enqueue('profile','main',Object.fromEntries(profileFields.map(k=>[k,settings[k]])))};
function adapter(){return {
  putGift:async g=>{enqueue('gift',g.id,g);return true},deleteGift:async id=>{enqueue('gift',id,null,true);return true},
  putMail:async m=>{enqueue('mail',m.id,m);return true},
  putProfile:async p=>{enqueue('profile','main',{...Object.fromEntries(profileFields.map(k=>[k,settings[k]])),...p});return true},
  getAllGiftIds:async()=>{const r=await api('/api/private/state');return r.records.filter(x=>x.kind==='gift'&&!x.deleted).map(x=>x.id)}
}}
async function activate(data){
  // This part is intentionally family-scoped: a second family using the same browser cannot read the first family's IndexedDB.
  if(db)db.close();
  ui.user=data.user;ui.family=data.family;ui.connected=false;ui.signature='';window.SANTA_FAMILY_ID=data.family.id;
  try{ui.queue=JSON.parse(localStorage.getItem(qKey())||'{}')}catch{ui.queue={}}
  db=await initDB();settings={...DEFAULT};appState.gifts=[];appState.messages=[];appState.kidActive=false;
  document.body.classList.remove('kid-open');document.getElementById('kidPortal').hidden=true;
  appState.page='dashboard';
  ui.connected=true;appState.cloud=adapter();appState.online=true;
  const r=await api('/api/private/state');await applyRemote(r.records);
  ui.started=true;window.dispatchEvent(new CustomEvent('santa-family-changed',{detail:{familyId:data.family.id}}));document.body.classList.add('family-authenticated');G.hidden=true;render();updateStatus();
  if(countQueue())schedule();
  if(ui.invite){
    // An existing signed-in account can use a friend's invitation to join their house.
    if(confirm('Join the family that invited you? Your current household data will stay separate.')){
      try{const joined=await api('/api/auth/accept',{invite:ui.invite});ui.invite='';history.replaceState({},'',location.pathname);await activate(joined);return}catch(e){showToast(e.message)}
    }
  }
  ui.invite='';history.replaceState({},'',location.pathname+location.hash);
}
async function check(){
  G.innerHTML='<div class="fa-shell fa-loading">Opening your Christmas planner…</div>';G.hidden=false;
  try{const r=await api('/api/auth/me');if(r.authenticated){await activate(r);return}}
  catch(e){console.warn('Unable to check session:',e)}
  G.dataset.mode='register';gate();
}
function accountHTML(){return `<section class="settings-card full fa-account"><h3>Your private family account</h3>
  <p>Signed in as <strong>${E(ui.user?.email)}</strong> · ${E(ui.family?.name)}. Caregivers can share this family's gifts and traditions, while other households remain separate.</p>
  <div class="actions-inline"><button class="secondary" type="button" data-fa="invite">Invite another caregiver</button><button class="secondary" type="button" data-fa="legacy">Restore original Santa HQ backup</button><button class="secondary" type="button" data-fa="signout">Sign out</button></div>
  <p class="helper" style="margin-top:12px">For a backup from a different phone, choose Import backup below. Changes sync between signed-in devices; never share your password.</p>
  ${ui.lastError?`<p class="fa-error">Sync problem: ${E(ui.lastError)}</p>`:''}</section>`}
// The old Firebase controls are hidden; this account panel lives in existing Settings.
const oldRender=render;
render=function(){oldRender();if(appState.page==='settings')document.getElementById('content')?.querySelector('.settings-grid')?.insertAdjacentHTML('afterbegin',accountHTML());updateStatus()};
function legacyDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('santa_hq_data',2);request.onupgradeneeded=()=>{const d=request.result;for(const kind of ['gifts','mail'])if(!d.objectStoreNames.contains(kind))d.createObjectStore(kind,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function readLegacy(){const old=await legacyDB();try{return await new Promise((resolve,reject)=>{const t=old.transaction(['gifts','mail'],'readonly');const g=t.objectStore('gifts').getAll(),m=t.objectStore('mail').getAll();t.oncomplete=()=>resolve({gifts:g.result||[],messages:m.result||[]});t.onerror=()=>reject(t.error)})}finally{old.close()}}
async function importLegacy(){
  try{
    const old=await readLegacy();
    if(!old.gifts.length&&!old.messages.length){showToast('No original gifts found on this device. Import a backup in Settings instead.');return}
    if(!confirm(`Copy ${old.gifts.length} gifts and ${old.messages.length} Santa letters from the original Santa HQ on this device into ${ui.family.name}? Your old records will remain untouched. Download a backup first.`))return;
    const targetGifts=new Map(appState.gifts.map(g=>[g.id,g]));
    for(const g of old.gifts)if(g?.id&&g.name&&!targetGifts.has(g.id)){targetGifts.set(g.id,g);await putGift(g)}
    for(const m of old.messages)if(m?.id&&!appState.messages.some(x=>x.id===m.id))await putMail(m);
    const oldSettings=JSON.parse(localStorage.getItem('santa_hq_settings')||'{}');
    for(const k of profileFields)if(oldSettings[k]!==undefined)settings[k]=oldSettings[k];
    saveSettingsLocal();await flush();await refresh();render();
    showToast(countQueue()?'Copied locally; sync when connected.':'Original Santa HQ records copied into your family.');
  }catch(err){console.error(err);showToast('Could not import original records. You can still use a downloaded backup.')}
}
async function signout(){
  await flush();
  if(countQueue()){showToast('Some changes have not synced. Please reconnect and retry before signing out.');return}
  if(!confirm('Sign out of this family on this device? Synced gifts will remain safe in your family account.'))return;
  try{await api('/api/auth/logout',{});}catch(err){showToast('Unable to sign out: '+err.message);return}
  ui.connected=false;appState.online=false;appState.cloud=null;ui.started=false;
  const oldId=ui.family?.id;
  if(db)db.close();db=null;window.SANTA_FAMILY_ID='';
  document.body.classList.remove('family-authenticated','kid-open');
  document.getElementById('kidPortal').hidden=true;
  appState.gifts=[];appState.messages=[];ui.user=null;ui.family=null;
  ui.queue={};window.dispatchEvent(new CustomEvent('santa-family-changed',{detail:{familyId:null}}));
  // Clear local cached family records on sign-out; private server records remain intact.
  if(oldId){localStorage.removeItem(LOCAL_PREFIX+oldId);localStorage.removeItem('santa_hq_settings_'+oldId);indexedDB.deleteDatabase('santa_hq_family_'+oldId)}
  G.dataset.mode='signin';gate();
}
G.addEventListener('submit',async e=>{
  if(e.target.id!=='familyAuthForm')return;e.preventDefault();feedback('');
  const form=e.target,fields=Object.fromEntries(new FormData(form));
  const signing=G.dataset.mode==='signin';const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
    const payload={...fields,...(ui.invite?{invite:ui.invite}:{})};
    const data=await api(signing?'/api/auth/login':'/api/auth/register',payload);
    if(!signing&&ui.invite)ui.invite=''; // New invite-based registration already joined the family.
    await activate(data);
  }catch(err){feedback(err.message)}finally{button.disabled=false}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-fa]');if(!b)return;
  const act=b.dataset.fa;
  if(act==='toggle'){G.dataset.mode=G.dataset.mode==='signin'?'register':'signin';gate()}
  if(act==='legacy')document.getElementById('importFile')?.click();
  if(act==='signout')await signout();
  if(act==='invite'){
    try{const r=await api('/api/auth/invite',{});if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(r.inviteUrl);showToast('Private caregiver invitation copied. Expires in seven days.')}else prompt('Copy this private family invitation:',r.inviteUrl)}
    catch(err){showToast(err.message)}
  }
});
window.addEventListener('online',()=>{if(ui.connected)refresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ui.connected)refresh()});
setInterval(()=>{if(ui.connected)refresh()},15000);
window.SantaFamilies={api,isConnected:()=>ui.connected,family:()=>ui.family,refresh,queueCount:countQueue};
window.SantaCloudSync={isConnected:()=>ui.connected,refresh};
(async()=>{for(let i=0;i<80;i++){if(db&&document.querySelector('#desktopNav .nav-btn'))break;await new Promise(r=>setTimeout(r,80))}await check()})();
})();
