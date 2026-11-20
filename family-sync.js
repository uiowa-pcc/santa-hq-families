/* Santa HQ family accounts: cookie sessions, private households, offline queue. No Worker URL or admin token for guests. */
(function(){
'use strict';
const E=v=>escapeHTML(String(v??''));
const ui={user:null,family:null,queue:{},busy:false,reading:false,timer:null,connected:false,lastError:'',signature:'',applying:false,invite:new URL(location.href).searchParams.get('invite')||'',verify:new URL(location.href).searchParams.get('verify')||'',reset:new URL(location.href).searchParams.get('reset')||'',emailEnabled:false,pendingEmail:'',started:false};
const G=document.getElementById('familyGate');
const LOCAL_PREFIX='santa_hq_multi_queue_';
const profileFields=['familyName','child1','child2','budget1','budget2','children','grownupPin','traditions','holidayPlans'];
const FAMILY_ICONS={star:'★',heart:'♥',flower:'✿',moon:'☾',sparkle:'✦',snow:'❄'};
const FAMILY_COLORS={star:'#7657c5',heart:'#c44f86',flower:'#bb759c',moon:'#586ab2',sparkle:'#ad823a',snow:'#487baf'};
const FAMILY_ELVES={'elf-purple-girl':'Purple girl elf','elf-pink-girl':'Pink girl elf','elf-red-girl':'Red girl elf','elf-lilac-girl':'Lilac girl elf','elf-green-boy':'Green boy elf','elf-blue-boy':'Blue boy elf','elf-teal-boy':'Teal boy elf','elf-navy-boy':'Navy boy elf','elf-gold':'Golden elf','elf-mint':'Mint elf','elf-coral':'Coral elf','elf-classic':'Classic elf'};

let childDraft=[{id:'1',name:'',budget:250,icon:'elf-purple-girl'},{id:'2',name:'',budget:250,icon:'elf-pink-girl'}];
function childCountButtons(){return `<fieldset class="fa-count"><legend>How many children?</legend><div class="fa-count-buttons">${[1,2,3,4,5,6].map(n=>`<button type="button" data-child-count="${n}" class="${childDraft.length===n?'active':''}" aria-pressed="${childDraft.length===n}">${n}</button>`).join('')}</div></fieldset>`}
function childDraftHTML(){return `<div class="fa-signup-children">${childDraft.map((kid,i)=>`<fieldset class="fa-signup-child"><legend>Child ${i+1}</legend><div class="fa-half"><label>Name<input name="newChildName${kid.id}" required maxlength="50" value="${E(kid.name)}" placeholder="Child’s name"></label><label>Gift budget ($)<input name="newChildBudget${kid.id}" type="number" min="0" step=".01" value="${Number(kid.budget)||0}"></label></div><div class="fa-signup-icons" role="radiogroup" aria-label="Choose an elf for child ${i+1}">${Object.entries(FAMILY_ELVES).map(([id,label])=>`<label title="${label}"><input type="radio" name="newChildIcon${kid.id}" aria-label="${label}" value="${id}" ${kid.icon===id?'checked':''}><span class="elf-avatar" data-elf="${id}" aria-hidden="true"></span></label>`).join('')}</div></fieldset>`).join('')}</div>`}
function captureDraft(){const parent=G.querySelector('#familyChildrenNew');if(!parent)return;for(const kid of childDraft){kid.name=parent.querySelector(`[name="newChildName${kid.id}"]`)?.value||kid.name;kid.budget=parent.querySelector(`[name="newChildBudget${kid.id}"]`)?.value||0;kid.icon=parent.querySelector(`[name="newChildIcon${kid.id}"]:checked`)?.value||kid.icon;}}

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
  const mode=G.dataset.mode||'register',invite=!!ui.invite;
  const signing=mode==='signin';
  const emailNote=ui.emailEnabled?'Email verification and password reset links are available.':'Email delivery is not configured yet. You can still create an account and use a one-time recovery code from Settings.';
  let fields='',title='',lede='',footer='';
  if(mode==='register'||mode==='signin'){
    title=signing?'Welcome back!':'Make Christmas magic.';
    lede=invite?'You have been invited to plan Christmas together. Sign in or create your account to join this family.':'One beautiful planner for gifts, stockings, traditions and all the little moments.';
    fields=`<form id="familyAuthForm" class="fa-form">
      ${!signing&&!invite?`<label>Family name<input name="familyName" required maxlength="70" placeholder="e.g. The Smiths’ North Pole"></label><div id="familyChildrenNew">${childCountButtons()}${childDraftHTML()}</div>`:''}
      <label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" value="${E(ui.pendingEmail)}"></label>
      <label>Password<input name="password" type="password" autocomplete="${signing?'current-password':'new-password'}" required minlength="${signing?1:12}" placeholder="${signing?'Your password':'At least 12 characters'}"></label>
      ${!signing?`<p class="fa-help">Use a unique password of at least 12 characters. ${E(emailNote)}</p>`:''}
      <p id="familyError" class="fa-error" role="alert" hidden></p><button class="primary fa-submit" type="submit">${signing?'Sign in':'Create my family HQ'}</button></form>`;
    footer=`<div class="fa-bottom">${signing?'New to Santa HQ?':'Already have an account?'} <button type="button" data-fa="toggle">${signing?'Create an account':'Sign in'}</button></div>${signing?'<div class="fa-bottom"><button data-fa="forgot" type="button">Forgot password?</button> · <button data-fa="recover" type="button">Use recovery code</button></div>':''}`;
  }else if(mode==='forgot'){
    title='Reset your password';lede=ui.emailEnabled?'Enter your email to receive a secure reset link.':'Email resets are not yet enabled by the site owner. If you saved a recovery code, use that instead.';
    fields=`<form id="familyForgotForm" class="fa-form"><label>Email address<input name="email" type="email" autocomplete="email" required value="${E(ui.pendingEmail)}"></label><p id="familyError" class="fa-error" role="alert" hidden></p><button class="primary fa-submit" type="submit" ${ui.emailEnabled?'':'disabled'}>Send reset link</button></form>`;
    footer='<div class="fa-bottom"><button type="button" data-fa="recover">Use recovery code</button> · <button type="button" data-fa="signin">Back to sign in</button></div>';
  }else if(mode==='reset'||mode==='recover'){
    const withCode=mode==='recover';title=withCode?'Use your recovery code':'Choose a new password';lede=withCode?'Enter the recovery code you saved in Settings. It can only be used once.':'This link can be used once and expires 45 minutes after it was requested.';
    fields=`<form id="${withCode?'familyRecoveryForm':'familyResetForm'}" class="fa-form">${withCode?`<label>Account email<input type="email" name="email" required value="${E(ui.pendingEmail)}"></label><label>Your one-time recovery code<input name="code" required autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></label>`:''}
      <label>New password<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="At least 12 characters"></label><label>Confirm password<input type="password" name="confirmPassword" required minlength="12" maxlength="128" autocomplete="new-password"></label>
      <p id="familyError" class="fa-error" role="alert" hidden></p><button class="primary fa-submit" type="submit">Change password</button></form>`;
    footer='<div class="fa-bottom"><button type="button" data-fa="signin">Back to sign in</button></div>';
  }else if(mode==='pending'){
    title='Check your inbox';lede=ui.emailEnabled?`We sent a verification link to ${E(ui.pendingEmail||'your email address')}. Open it to activate your account.`:`Your account needs email verification, but sending is currently unavailable. Ask the site owner to enable email delivery.`;
    fields=`<form id="familyResendForm" class="fa-form"><label>Email address<input name="email" type="email" required value="${E(ui.pendingEmail)}"></label><p id="familyError" class="fa-error" role="alert" hidden></p><button class="primary fa-submit" type="submit" ${ui.emailEnabled?'':'disabled'}>Resend verification email</button></form>`;
    footer='<div class="fa-bottom"><button type="button" data-fa="signin">Back to sign in</button></div>';
  }else if(mode==='sent'||mode==='verified'){
    title=mode==='verified'?'Email confirmed!':'Check your email';lede=mode==='verified'?'Your email address is verified. Sign in to your family’s planner.':'If the account exists, a link is on its way. Check your inbox and spam folder.';
    footer='<div class="fa-bottom"><button type="button" data-fa="signin">Back to sign in</button></div>';
  }
  G.innerHTML=`<div class="fa-shell"><div class="fa-art"><img src="./icon-192.png" alt="" onerror="this.style.display='none'"><span class="fa-wordmark">santa hq<span>.</span></span></div>
    <span class="fa-kicker">YOUR FAMILY'S LITTLE NORTH POLE</span><h1>${title}</h1><p class="fa-lede">${lede}</p>${fields}${footer}<div class="fa-private">🔒 Gift lists are private to your family. Relatives only see what you choose to share.</div></div>`;
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
  openPendingSharedGift();
}
async function check(){
  G.innerHTML='<div class="fa-shell fa-loading">Opening your Christmas planner…</div>';G.hidden=false;
  try{const caps=await api('/api/auth/capabilities');ui.emailEnabled=!!caps.emailEnabled}catch(err){console.warn('Account email capabilities:',err)}
  if(ui.verify){
    try{await api('/api/auth/verify',{token:ui.verify});G.dataset.mode='verified'}
    catch(err){G.dataset.mode='pending';ui.pendingEmail='';}
    ui.verify='';history.replaceState({},'',location.pathname);gate();return;
  }
  if(ui.reset){G.dataset.mode='reset';gate();return;}
  try{const r=await api('/api/auth/me');if(r.authenticated){await activate(r);return}}
  catch(e){console.warn('Unable to check session:',e)}
  G.dataset.mode='register';gate();
}
function accountHTML(){
  const verified=!!ui.user?.emailVerified;
  return `<section class="settings-card full fa-account"><h3>Your private family account</h3>
  <p>Signed in as <strong>${E(ui.user?.email)}</strong> · ${E(ui.family?.name)}. Other households cannot see your gifts or traditions.</p>
  <p style="margin-bottom:10px"><strong>Email:</strong> ${verified?'✓ Verified':ui.emailEnabled?'Not verified yet':'Email verification not configured by the site owner'}</p>
  <div class="actions-inline"><button class="secondary" type="button" data-fa="invite">Invite another caregiver</button>
  ${ui.emailEnabled&&!verified?'<button class="secondary" type="button" data-fa="send-verification">Verify my email</button>':''}
  <button class="secondary" type="button" data-fa="new-recovery">Create recovery code</button>
  <button class="secondary" type="button" data-fa="legacy">Restore original Santa HQ backup</button><button class="secondary" type="button" data-fa="signout">Sign out</button></div>
  <p class="helper" style="margin-top:12px">Save a recovery code somewhere secure so you can reset your password even without email access. Creating a new code invalidates the old one. Your private changes sync across signed-in devices.</p>
  ${ui.lastError?`<p class="fa-error">Sync problem: ${E(ui.lastError)}</p>`:''}</section>`;
}
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
G.addEventListener('click',e=>{const btn=e.target.closest('[data-child-count]');if(!btn)return;captureDraft();const count=Number(btn.dataset.childCount);if(!Number.isInteger(count)||count<1||count>6)return;let source=childDraft.slice(0,count);while(source.length<count){const id=String(source.length+1);const icons=Object.keys(FAMILY_ELVES);source.push({id,name:'',budget:250,icon:icons[source.length%icons.length]});}childDraft=source;const block=G.querySelector('#familyChildrenNew');if(block){block.innerHTML=childCountButtons()+childDraftHTML();}});
G.addEventListener('submit',async e=>{
  const form=e.target,id=form.id;
  if(!['familyAuthForm','familyForgotForm','familyResetForm','familyRecoveryForm','familyResendForm'].includes(id))return;
  e.preventDefault();feedback('');const values=Object.fromEntries(new FormData(form));
  const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
  try{
    if(id==='familyAuthForm'){
      const signing=G.dataset.mode==='signin';ui.pendingEmail=String(values.email||'');
      const payload={...values,...(ui.invite?{invite:ui.invite}:{})};
      if(!signing&&!ui.invite){captureDraft();payload.children=childDraft.map(c=>({id:String(c.id),name:String(c.name||'').trim(),icon:c.icon,budget:Number(c.budget)||0}));
       if(payload.children.some(c=>!c.name)){feedback('Enter a name for each child.');return;}}

      const result=await api(signing?'/api/auth/login':'/api/auth/register',payload);
      if(result.verificationPending){ui.invite='';ui.pendingEmail=result.email;G.dataset.mode='pending';gate();return;}
      if(!signing&&ui.invite)ui.invite='';
      await activate(result);return;
    }
    if(id==='familyForgotForm'){ui.pendingEmail=values.email;await api('/api/auth/forgot',{email:values.email});G.dataset.mode='sent';gate();return;}
    if(id==='familyResendForm'){ui.pendingEmail=values.email;await api('/api/auth/verify-request',{email:values.email});showToast('If the account exists, a verification link will be sent.');return;}
    if(id==='familyResetForm'||id==='familyRecoveryForm'){
      if(values.password!==values.confirmPassword){feedback('The passwords do not match.');return;}
      const route=id==='familyResetForm'?'/api/auth/reset':'/api/auth/recovery/reset';
      await api(route,id==='familyResetForm'?{token:ui.reset,password:values.password}:{email:values.email,code:values.code,password:values.password});
      ui.reset='';history.replaceState({},'',location.pathname);G.dataset.mode='signin';gate();showToast('Password changed. Sign in with the new password.');return;
    }
  }catch(err){
    if(/Verify your email/i.test(err.message)){G.dataset.mode='pending';gate();return;}
    feedback(err.message);
  }finally{if(button?.isConnected)button.disabled=false;}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-fa]');if(!b)return;
  const act=b.dataset.fa;
  if(act==='toggle'){G.dataset.mode=G.dataset.mode==='signin'?'register':'signin';gate();return;}
  if(['signin','forgot','recover'].includes(act)){G.dataset.mode=act==='recover'?'recover':act;gate();return;}
  if(act==='legacy'){document.getElementById('importFile')?.click();return;}
  if(act==='signout'){await signout();return;}
  if(act==='send-verification'){
    try{await api('/api/auth/verify-request',{email:ui.user.email});showToast('Check your email for a verification link.')}catch(err){showToast(err.message)}
    return;
  }
  if(act==='new-recovery'){
    const password=prompt('Enter your current password to create a one-time account recovery code:');if(!password)return;
    try{
      const result=await api('/api/auth/recovery/new',{password});
      modalOpen('Save your recovery code',`<p class="helper">Copy this code to a private, safe place. It is shown only now, works once, and replaces your previous recovery code.</p><div class="field"><label>Recovery code</label><input id="familyRecoveryCode" aria-label="Recovery code" readonly value="${E(result.code)}" style="font-family:monospace;font-size:14px" onclick="this.select()"></div>`,`<button class="secondary" type="button" data-fa="copy-recovery">Copy code</button><button class="primary" type="button" data-action="close">I've saved it</button>`);
    }catch(err){showToast(err.message)}return;
  }
  if(act==='copy-recovery'){
    const value=document.getElementById('familyRecoveryCode')?.value;
    if(!value)return;
    try{await navigator.clipboard.writeText(value);showToast('Recovery code copied. Save it somewhere private.')}catch{prompt('Copy your recovery code:',value)}
    return;
  }
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
