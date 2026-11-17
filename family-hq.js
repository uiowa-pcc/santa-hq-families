/* Santa HQ family-facing list administration. Publishes ONLY explicitly chosen names/recipients. */
(function(){
'use strict';
if(typeof render!=='function'||!window.SantaFamilies)return;
const esc=v=>escapeHTML(String(v??''));
const current={ideas:[],bag:[],shareId:'',claims:[],loaded:false,loading:false,dirty:false,error:''};
if(!navItems.some(x=>x[0]==='family'))navItems.splice(navItems.length-1,0,['family','gift','Family list']);
function giftButton(g,type){
  const selected=current[type].includes(g.id);
  return `<label class="mf-item"><input type="checkbox" data-mf-type="${type}" data-mf-id="${esc(g.id)}" ${selected?'checked':''}>
    <span><strong>${esc(g.name)}</strong><small>${esc(kidName(g.kid))}</small></span></label>`;
}
function sharingPage(){
  const gifts=appState.gifts;
  const maybes=gifts.filter(g=>g.status==='Idea'||g.status==='To buy');
  const bought=gifts.filter(g=>['Bought','Ordered','Arrived','Wrapped'].includes(g.status));
  const link=current.shareId?`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`:'';
  return `<div class="mf-wrap">${heading('INVITE YOUR PEOPLE','Family gift list','Only the gifts you select here become visible to relatives.',false)}
    <div class="mf-warning">Your private Santa HQ never exposes budgets, shopping totals, hiding places, Santa mail, or notes. The public list displays only the selected gift names and recipients.</div>
    ${current.error?`<div class="mf-warning">${esc(current.error)}</div>`:''}
    <div class="mf-columns"><section class="settings-card"><h3>Ideas relatives could choose</h3><p>Relatives can claim an idea so others know it's covered.</p><div class="mf-items">${maybes.length?maybes.map(g=>giftButton(g,'ideas')).join(''):'No unsold ideas yet.'}</div></section>
    <section class="settings-card"><h3>Already in Santa's bag</h3><p>Show only the finished gifts you want them to know about.</p><div class="mf-items">${bought.length?bought.map(g=>giftButton(g,'bag')).join(''):'Nothing has been marked bought yet.'}</div></section></div>
    <div class="mf-actions"><button type="button" class="primary" data-mf="publish">Publish selected gifts</button>${link?`<button type="button" class="secondary" data-mf="copy">Copy family list link</button><a href="${esc(link)}" class="secondary" target="_blank" rel="noopener">View public list ↗</a>`:''}</div>
    <p class="helper">${current.dirty?'Unpublished changes: tap Publish.':'Your selection is saved when you publish.'}</p>
    ${current.claims.length?`<section class="settings-card mf-claims"><h3>Claimed by relatives</h3>${current.claims.map(c=>`<div class="mf-claim"><span>${esc(gifts.find(g=>g.id===c.gift_id)?.name||'Gift idea')} — ${esc(c.name)}</span><button class="secondary" data-mf="release" data-id="${esc(c.gift_id)}">Release</button></div>`).join('')}</section>`:''}
  </div>`;
}
async function load(){if(current.loading||!window.SantaFamilies.isConnected())return;current.loading=true;
  try{
    const r=await window.SantaFamilies.api('/api/family/list');
    current.shareId=r.shareId||'';current.claims=r.claims||[];current.ideas=(r.list?.ideas||[]).map(x=>x.id);current.bag=(r.list?.bag||[]).map(x=>x.id);
    current.loaded=true;current.error='';current.dirty=false;
    if(appState.page==='family')render();
  }catch(err){current.error=err.message;current.loaded=true;if(appState.page==='family')render()}
  finally{current.loading=false}
}
window.addEventListener('santa-family-changed',()=>{current.ideas=[];current.bag=[];current.shareId='';current.claims=[];current.loaded=false;current.loading=false;current.dirty=false;current.error=''});
const base=render;
render=function(){
  if(appState.page!=='family')return base();
  renderNav();document.getElementById('content').innerHTML=sharingPage();document.title='Santa HQ • Family list';
  if(!current.loaded&&!current.loading)setTimeout(load,0);
};
const css=document.createElement('style');css.textContent=`
.mf-wrap{max-width:1070px}.mf-warning{border:1px solid #e6e2f4;background:#f5f1ff;border-radius:14px;padding:13px 17px;margin:10px 0 20px;color:#545183;font-size:13px}.mf-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.mf-items{display:grid;gap:9px;max-height:440px;overflow:auto}.mf-item{display:flex;align-items:center;gap:11px;background:#fafaff;border:1px solid #ededfa;border-radius:12px;padding:10px;cursor:pointer}.mf-item input{width:18px;height:18px;accent-color:#6256cb}.mf-item span{display:grid;gap:2px;min-width:0}.mf-item strong{font-size:12px;overflow-wrap:anywhere}.mf-item small{font-size:11px;color:#83849c}.mf-actions{display:flex;gap:9px;flex-wrap:wrap;margin:17px 0}.mf-claims{margin-top:21px}.mf-claim{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #efedf6}.mf-claim .secondary{padding:8px 12px}@media(max-width:730px){.mf-columns{grid-template-columns:1fr}}
`;document.head.append(css);
document.addEventListener('change',e=>{
  const box=e.target.closest('[data-mf-type]');if(!box)return;
  const type=box.dataset.mfType,id=box.dataset.mfId;
  if(!['ideas','bag'].includes(type))return;
  current[type]=box.checked?[...new Set([...current[type],id])]:current[type].filter(x=>x!==id);
  current.dirty=true;
});
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-mf]');if(!btn)return;const act=btn.dataset.mf;
  if(act==='copy'){
    const link=`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`;
    try{await navigator.clipboard.writeText(link);showToast('Family list link copied.')}catch{prompt('Copy your family list link:',link)}
  }
  if(act==='publish'){
    btn.disabled=true;
    try{const r=await window.SantaFamilies.api('/api/family/publish',{ideas:current.ideas,bag:current.bag});current.shareId=r.shareId;current.dirty=false;showToast('Your chosen gifts are now on your family list.');render()}
    catch(err){showToast(err.message)}finally{btn.disabled=false}
  }
  if(act==='release'){
    try{await window.SantaFamilies.api('/api/family/release',{giftId:btn.dataset.id});await load();showToast('Gift claim released.')}
    catch(err){showToast(err.message)}
  }
});
})();
