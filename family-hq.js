/* Santa HQ sharing: publish ONLY explicitly selected gift names and recipients. */
(function(){
'use strict';
if(typeof render!=='function'||!window.SantaFamilies)return;
const E=v=>escapeHTML(String(v??''));
const current={ideas:[],bag:[],shareId:'',claims:[],loaded:false,loading:false,dirty:false,error:''};
if(!navItems.some(x=>x[0]==='family'))navItems.splice(navItems.length-1,0,['family','users','Family List']);
function eligible(type){return appState.gifts.filter(g=>type==='ideas'?['Idea','To buy'].includes(g.status):['Bought','Ordered','Arrived','Wrapped'].includes(g.status))}
function giftsByRecipient(gs){return [...configuredChildren().map(c=>[c.id,c.name]),['both',sharedLabel()],['unassigned','Still deciding']].map(([id,name])=>[name,gs.filter(g=>g.kid===id)]).filter(([,items])=>items.length)}
function giftButton(g,type){const selected=current[type].includes(g.id);return `<div class="mf-item"><label class="mf-item-choice"><input type="checkbox" data-mf-type="${type}" data-mf-id="${E(g.id)}" ${selected?'checked':''} aria-label="Share ${E(g.name)}"><span><strong>${E(g.name)}</strong><small>${E(g.status==='Idea'?'Idea':g.status)}</small></span></label><button type="button" class="mf-edit" data-mf="edit" data-id="${E(g.id)}" aria-label="Edit ${E(g.name)}">${ico('edit')}<span>Edit</span></button></div>`}
function editFamilyGift(id){
 const g=appState.gifts.find(x=>x.id===id);if(!g)return;
 saveProfileEdits();
 const recipients=[...configuredChildren().map(c=>[c.id,c.name]),['both',sharedLabel()],['unassigned','Still deciding']];
 const stages=['Idea','To buy','Bought','Ordered','Arrived','Wrapped'];
 const select=(items,value)=>items.map(([v,label])=>`<option value="${E(v)}" ${String(value)===String(v)?'selected':''}>${E(label)}</option>`).join('');
 modalOpen('Edit gift details',`<form id="mfGiftEdit" class="mf-edit-form"><p class="mf-edit-help">Edit this gift without leaving the Family List. Only the gift name and recipient are shared when you publish. Planning details remain private.</p>
 <label>Gift name<input name="name" required maxlength="160" value="${E(g.name)}"></label>
 <div class="mf-edit-grid"><label>For<select name="kid">${select(recipients,g.kid)}</select></label><label>Gift status<select name="status">${select(stages.map(x=>[x,x]),g.status)}</select></label></div>
 <label>Product link (private)<input name="link" type="url" value="${E(g.link)}" placeholder="https://…"></label>
 <div class="mf-edit-grid"><label>Price (private)<input name="price" type="number" min="0" step="0.01" value="${E(g.price??'')}"></label><label>Store (private)<input name="store" value="${E(g.store)}" maxlength="160"></label></div>
 <label>Notes (private)<textarea name="notes" rows="3">${E(g.notes)}</textarea></label></form>`,`<button type="button" class="secondary" data-action="close">Cancel</button><button class="primary" type="submit" form="mfGiftEdit">Save changes</button>`);
 const form=document.getElementById('mfGiftEdit');form.querySelector('[name="name"]').focus();
 form.addEventListener('submit',async e=>{e.preventDefault();const fields=new FormData(form),value=k=>String(fields.get(k)||'').trim(),old=appState.gifts.find(x=>x.id===id);if(!old)return;
 const name=value('name'),kid=value('kid'),status=value('status'),link=safeLink(value('link'));if(!name||!validRecipient(kid)||!stages.includes(status)||(value('link')&&!link)){showToast('Check the gift details.');return;}
 const next={...old,name,kid,status,link,price:value('price')===''?null:cents(value('price')),store:value('store'),notes:value('notes'),updatedAt:new Date().toISOString()};
 if(next.price!==old.price)next.priceCheckedAt=next.updatedAt;
 if(next.link!==old.link){next.dealLatestPrice=null;next.dealPriceCheckedAt='';next.dealPriceSource='';}
 if(status!==old.status)next.lockedIn=status==='Idea'?false:(giftPlacement(old)!=='undecided'&&(old.lockedIn!==false||status==='To buy'));
 const submit=document.querySelector('[form="mfGiftEdit"][type="submit"]');if(submit)submit.disabled=true;
 try{await putGift(next);appState.gifts=appState.gifts.map(x=>x.id===id?next:x);current.dirty=true;modalClose();render();showToast('Gift updated. Publish to update the shared list.');await cloudPutGift(next)}catch(err){showToast('Could not save gift details.');if(submit)submit.disabled=false;console.error(err)}
 });
}
function shareGroup(type,title,subtitle){const available=eligible(type);return `<section class="settings-card mf-choice-card"><div class="mf-choice-title"><h3>${title}</h3><span>${available.length} available</span></div><p>${subtitle}</p>${available.length?giftsByRecipient(available).map(([name,gifts])=>`<div class="mf-recipient-group"><h4>${E(name)}</h4><div class="mf-items">${gifts.map(g=>giftButton(g,type)).join('')}</div></div>`).join(''):'<p class="mf-empty">Nothing in this section yet.</p>'}</section>`}
function favoritesCards(){
 return `<section class="settings-card mf-favorites"><div class="mf-choice-title"><h3>Kid favorites</h3><span>Optional</span></div>
 <p>A few quick favorites to help relatives find gifts they’ll love. Fill in any that fit, and choose whether to share.</p>
 <div class="mf-profile-grid">${configuredChildren().map(c=>`<section class="mf-profile" data-mf-profile="${E(c.id)}">
 <h4>${childChoiceIcon(c.id)} ${E(c.name)}</h4>
 <label class="mf-profile-field">Favorite colors<input type="text" data-mf-field="favoriteColors" maxlength="120" placeholder="Purple, pink, rainbow…" value="${E(c.favoriteColors)}"></label>
 <label class="mf-profile-field">Favorite characters<input type="text" data-mf-field="favoriteCharacters" maxlength="120" placeholder="Bluey, Elsa, Spider-Man…" value="${E(c.favoriteCharacters)}"></label>
 <label class="mf-profile-field">Favorite activities<input type="text" data-mf-field="favoriteActivities" maxlength="120" placeholder="Drawing, dancing, building…" value="${E(c.favoriteActivities)}"></label>
 <label class="mf-profile-field">Favorite things<input type="text" data-mf-field="favoriteThings" maxlength="120" placeholder="Dinosaurs, LEGO, unicorns…" value="${E(c.favoriteThings)}"></label>
 ${(c.interests||c.favorites)?`<details class="mf-legacy-notes"><summary>Previous notes</summary><label class="mf-profile-field">Previous interests<textarea data-mf-field="interests" maxlength="350" rows="2">${E(c.interests)}</textarea></label><label class="mf-profile-field">Previous favorites<textarea data-mf-field="favorites" maxlength="350" rows="2">${E(c.favorites)}</textarea></label></details>`:''}
 <label class="mf-profile-optin"><input type="checkbox" data-mf-field="shareFavorites" ${c.shareFavorites?'checked':''}><span>Share ${E(c.name)}'s profile with relatives</span></label>
 </section>`).join('')}</div>
 <p class="mf-private-hint">Do not include addresses, schools, dates of birth, or other identifying information. Public gift-list links can be forwarded. Changes go live only when you publish.</p></section>`;
}
function saveProfileEdits(){
 const cards=[...document.querySelectorAll('[data-mf-profile]')];if(!cards.length)return false;
 const draft=new Map(cards.map(card=>[card.dataset.mfProfile,{
   favoriteColors:card.querySelector('[data-mf-field="favoriteColors"]')?.value.trim().slice(0,120)||'',
   favoriteCharacters:card.querySelector('[data-mf-field="favoriteCharacters"]')?.value.trim().slice(0,120)||'',
   favoriteActivities:card.querySelector('[data-mf-field="favoriteActivities"]')?.value.trim().slice(0,120)||'',
   favoriteThings:card.querySelector('[data-mf-field="favoriteThings"]')?.value.trim().slice(0,120)||'',
   interests:card.querySelector('[data-mf-field="interests"]')?.value.trim().slice(0,350)||'',
   favorites:card.querySelector('[data-mf-field="favorites"]')?.value.trim().slice(0,350)||'',
   shareFavorites:!!card.querySelector('[data-mf-field="shareFavorites"]')?.checked
 }]));
 const next=configuredChildren().map(c=>({...c,...(draft.get(c.id)||{})}));
 if(JSON.stringify(next)===JSON.stringify(configuredChildren()))return false;
 settings.children=next;syncLegacyChildren();saveSettingsLocal();cards.forEach(card=>card.querySelectorAll('[data-mf-touched]').forEach(el=>delete el.dataset.mfTouched));return true;
}
function sharingPage(){
 const link=current.shareId?`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`:'';
 const ideaIds=new Set(eligible('ideas').map(g=>g.id)),bagIds=new Set(eligible('bag').map(g=>g.id));
 const stale=current.ideas.some(id=>!ideaIds.has(id))||current.bag.some(id=>!bagIds.has(id));
 const selected=current.ideas.filter(id=>ideaIds.has(id)).length+current.bag.filter(id=>bagIds.has(id)).length;
 return `<div class="mf-wrap">${heading('SHARE ONLY WHAT YOU CHOOSE','Family gift list','Choose gifts to show relatives. Your private planner stays private.',false)}
 <div class="mf-safety"><span>${ico('shield')}</span><p><strong>Private by default.</strong> Your link shows only selected gift names and recipients. No prices, budgets, private notes, product links, order details, or hiding spots.</p></div>
 ${current.error?`<p class="mf-error" role="alert">${E(current.error)}</p>`:''}
 ${stale?'<p class="mf-notice">Some saved selections changed stage. Republish to keep the shared list accurate.</p>':''}
 ${favoritesCards()}
 ${shareGroup('ideas','Ideas relatives can buy','Choose the gifts relatives can claim, so others know they are covered.')}
 ${shareGroup('bag',"In Santa's Bag (optional)",'Only show purchased gifts you are comfortable revealing to relatives.')}
 <div class="mf-publish-bar"><div><b>${selected} selected</b><small>${current.dirty?'Unpublished changes':'Changes go live when you publish'}</small></div><button type="button" class="primary" data-mf="publish">${current.shareId?'Update shared list':'Create shared list'}</button></div>
 ${link?`<div class="mf-link-row"><div><b>Your family's link</b><small>Anyone with the link can view only published items. Send it to relatives when ready.</small></div><button type="button" class="secondary" data-mf="copy">Copy link</button><a class="secondary" href="${E(link)}" target="_blank" rel="noopener noreferrer">Preview list</a></div>`:''}
 ${current.claims.length?`<section class="settings-card mf-claims"><h3>Claimed by relatives</h3>${current.claims.map(c=>`<div class="mf-claim"><span>${E(appState.gifts.find(g=>g.id===c.gift_id)?.name||'Gift idea')} · ${E(c.name)}</span><button class="secondary" data-mf="release" data-id="${E(c.gift_id)}">Release</button></div>`).join('')}</section>`:''}
 </div>`;
}
async function load(){if(current.loading||!window.SantaFamilies.isConnected())return;current.loading=true;
 try{const r=await window.SantaFamilies.api('/api/family/list');current.shareId=r.shareId||'';current.claims=r.claims||[];current.ideas=(r.list?.ideas||[]).map(x=>x.id);current.bag=(r.list?.bag||[]).map(x=>x.id);current.loaded=true;current.error='';current.dirty=false;if(appState.page==='family')render()}
 catch(err){current.error=err.message;current.loaded=true;if(appState.page==='family')render()}
 finally{current.loading=false}
}
window.addEventListener('santa-family-changed',()=>{document.querySelectorAll('[data-mf-touched]').forEach(el=>delete el.dataset.mfTouched);current.ideas=[];current.bag=[];current.shareId='';current.claims=[];current.loaded=false;current.loading=false;current.dirty=false;current.error=''});
const base=render;
render=function(){if(appState.page!=='family')return base();const drafts=Array.from(document.querySelectorAll('[data-mf-profile] [data-mf-field]')).filter(el=>el.dataset.mfTouched==='1').map(el=>({id:el.closest('[data-mf-profile]').dataset.mfProfile,field:el.dataset.mfField,value:el.type==='checkbox'?el.checked:el.value}));renderNav();document.getElementById('content').innerHTML=sharingPage();for(const draft of drafts){const el=[...document.querySelectorAll('[data-mf-profile] [data-mf-field]')].find(x=>x.closest('[data-mf-profile]').dataset.mfProfile===draft.id&&x.dataset.mfField===draft.field);if(el){if(el.type==='checkbox')el.checked=draft.value;else el.value=draft.value;el.dataset.mfTouched='1'}}document.title='Santa HQ • Family list';if(!current.loaded&&!current.loading)setTimeout(load,0)};
const css=document.createElement('style');css.textContent=`
.mf-wrap{max-width:920px;margin:auto}.mf-safety{display:flex;align-items:flex-start;gap:12px;border:1px solid #e8e4f5;background:#f4f0ff;border-radius:17px;padding:14px 17px;margin:6px 0 19px;color:#68618f}.mf-safety svg{height:21px;width:21px;flex:none}.mf-safety p{margin:0;font-size:12px;line-height:1.6}.mf-choice-card{margin:12px 0}.mf-choice-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.mf-choice-title h3{margin:0}.mf-choice-title span{font-size:11px;color:#8784a6;font-weight:800}.mf-choice-card>p{margin:5px 0 14px}.mf-recipient-group{border-top:1px solid #eeeef5;padding:11px 0}.mf-recipient-group h4{margin:3px 0 8px;font-size:12px;color:#655bac}.mf-items{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mf-item{display:flex;align-items:center;gap:10px;background:#fdfcff;border:1px solid #eceaf8;border-radius:12px;padding:11px;cursor:pointer;min-width:0}.mf-item input{width:18px;height:18px;accent-color:#6256cb;flex:none}.mf-item span{display:grid;gap:2px;min-width:0}.mf-item strong{font-size:12px;overflow-wrap:anywhere}.mf-item small{font-size:11px;color:#83849c}.mf-publish-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;margin:9px 0;border-top:1px solid #e8e8f2}.mf-publish-bar>div{display:grid;gap:3px}.mf-publish-bar small,.mf-link-row small{display:block;color:#898ca0;font-size:11px}.mf-link-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;border:1px solid #e8e7f4;border-radius:16px;background:#fff;padding:14px}.mf-link-row>div{flex:1;min-width:170px}.mf-link-row .secondary{padding:10px 12px;text-decoration:none}.mf-error,.mf-notice{padding:11px 14px;border-radius:12px;background:#fff5e6;color:#87623c;font-size:12px}.mf-claim{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #ececf3}.mf-claims{margin-top:16px}.mf-claim .secondary{padding:8px 10px}.mf-empty{color:#9895a3}@media(max-width:660px){.mf-items{grid-template-columns:1fr}.mf-choice-card{padding:16px}.mf-publish-bar{align-items:flex-start;flex-wrap:wrap}}

.mf-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:16px 0}.mf-profile{border:1px solid #ebe7f5;border-radius:17px;padding:15px;background:#fdfcff;min-width:0}.mf-profile h4{display:flex;align-items:center;gap:8px;margin:0 0 12px;font:800 17px 'Outfit',sans-serif}.mf-profile .kid-symbol{font-size:23px}.mf-profile-field{display:grid;gap:5px;margin-bottom:10px;color:#645b79;font-size:12px;font-weight:800}.mf-profile-field textarea{width:100%;border:1px solid #dedbea;border-radius:10px;padding:10px;font:500 13px 'DM Sans',sans-serif;background:#fff;resize:vertical;min-height:68px;color:#2a304b}.mf-profile-field input[type="text"]{box-sizing:border-box;width:100%;min-width:0;min-height:44px;border:1px solid #dedbea;border-radius:10px;padding:10px;font:500 14px 'DM Sans',sans-serif;background:#fff;color:#2a304b}.mf-profile-field input:focus,.mf-profile-field textarea:focus{outline:2px solid #8b75c9;outline-offset:1px}.mf-legacy-notes{margin:0 0 12px;color:#645b79;font-size:12px}.mf-legacy-notes summary{cursor:pointer;margin-bottom:9px}.mf-profile-optin{display:flex;align-items:flex-start;gap:8px;color:#50437d;font-size:12px;font-weight:800;cursor:pointer}.mf-profile-optin input{width:18px;height:18px;accent-color:#6656c5;flex:none}.mf-private-hint{color:#8d7993;font-size:11px;line-height:1.5;margin:0 0 8px}@media(max-width:670px){.mf-profile-grid{grid-template-columns:1fr}}

.mf-item{padding:0;gap:0;background:#fff;cursor:default;border-color:#ede4ef;overflow:hidden}.mf-item-choice{display:flex;align-items:center;gap:10px;padding:10px;cursor:pointer;min-width:0;flex:1;min-height:58px}.mf-item:has(input:checked){background:#faf5ff;border-color:#d9c5e7}.mf-item-choice span{flex:1}.mf-edit{display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:none;min-height:44px;padding:7px 10px;margin:4px;border:0;border-radius:10px;background:#f5edf9;color:#795480;font:800 12px 'DM Sans',sans-serif;cursor:pointer}.mf-edit svg{width:15px;height:15px}.mf-edit:hover{background:#f0e3f6}.mf-edit:focus-visible{outline:3px solid #b48ec8;outline-offset:1px}.mf-edit-form{display:grid;gap:14px}.mf-edit-help{font-size:12px;color:#77637c;margin:0}.mf-edit-form label{display:grid;gap:5px;color:#674c6e;font-weight:750;font-size:12px}.mf-edit-form :is(input,textarea,select){width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1px solid #e5d9e9;border-radius:12px;background:#fdfaff;color:#48243d;font:500 14px 'DM Sans',sans-serif}.mf-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mf-edit-form textarea{resize:vertical}@media(max-width:360px){.mf-edit-grid{grid-template-columns:1fr}}
`;document.head.append(css);
document.addEventListener('input',e=>{if(e.target.closest('[data-mf-profile]')){current.dirty=true;e.target.dataset.mfTouched='1'}});
document.addEventListener('change',e=>{if(e.target.closest('[data-mf-profile]')){current.dirty=true;e.target.dataset.mfTouched='1';return}const box=e.target.closest('[data-mf-type]');if(!box)return;const type=box.dataset.mfType,id=box.dataset.mfId;if(!['ideas','bag'].includes(type))return;current[type]=box.checked?[...new Set([...current[type],id])]:current[type].filter(x=>x!==id);current.dirty=true;const n=document.querySelector('.mf-publish-bar b');if(n)n.textContent=(current.ideas.length+current.bag.length)+' selected'});
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-mf]');if(!btn)return;const act=btn.dataset.mf;
 if(act==='edit'){editFamilyGift(btn.dataset.id);return}
 if(act==='copy'){if(!current.shareId)return;const link=`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`;try{await navigator.clipboard.writeText(link);showToast('Family list link copied')}catch{prompt('Copy your family list link:',link)}}
 if(act==='publish'){if(!window.SantaFamilies.isConnected()){showToast('Sign in before sharing your list.');return;}btn.disabled=true;
  try{saveProfileEdits();await window.SantaFamilies.refresh();if(window.SantaFamilies.queueCount()>0)throw Error('Your gifts are still syncing. Check your connection, then try Publish again.');const ideas=new Set(eligible('ideas').map(g=>g.id)),bag=new Set(eligible('bag').map(g=>g.id));const data=await window.SantaFamilies.api('/api/family/publish',{ideas:current.ideas.filter(id=>ideas.has(id)),bag:current.bag.filter(id=>bag.has(id))});current.ideas=data.list.ideas.map(x=>x.id);current.bag=data.list.bag.map(x=>x.id);current.shareId=data.shareId;current.dirty=false;current.error='';await load();showToast('Shared list updated');render()}
  catch(err){current.error=err.message;showToast(err.message)}finally{btn.disabled=false}
 }
 if(act==='release'){try{await window.SantaFamilies.api('/api/family/release',{giftId:btn.dataset.id});await load();showToast('Gift claim released')}catch(err){showToast(err.message)}}
});
})();
