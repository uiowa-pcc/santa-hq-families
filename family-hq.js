/* Santa HQ sharing: publish ONLY explicitly selected gift names, recipients and categories. */
(function(){
'use strict';
if(typeof render!=='function'||!window.SantaFamilies)return;
const E=v=>escapeHTML(String(v??''));
const current={ideas:[],bag:[],shareId:'',claims:[],loaded:false,loading:false,dirty:false,error:''};
if(!navItems.some(x=>x[0]==='family'))navItems.splice(navItems.length-1,0,['family','users','Family List']);
function placement(g){return ({Stocking:'Stocking','Regular gift':'Under the tree','Big gift':'Big gift',Experience:'Experience','Shared / family':'Shared / family'})[g.category]||'Under the tree'}
function eligible(type){return appState.gifts.filter(g=>type==='ideas'?['Idea','To buy'].includes(g.status):['Bought','Ordered','Arrived','Wrapped'].includes(g.status))}
function giftsByRecipient(gs){return [...configuredChildren().map(c=>[c.id,c.name]),['both',sharedLabel()],['unassigned','Still deciding']].map(([id,name])=>[name,gs.filter(g=>g.kid===id)]).filter(([,items])=>items.length)}
function giftButton(g,type){const selected=current[type].includes(g.id);return `<label class="mf-item"><input type="checkbox" data-mf-type="${type}" data-mf-id="${E(g.id)}" ${selected?'checked':''}><span><strong>${E(g.name)}</strong><small>${E(placement(g))} · ${E(g.status==='Idea'?'Idea':g.status)}</small></span></label>`}
function shareGroup(type,title,subtitle){const available=eligible(type);return `<section class="settings-card mf-choice-card"><div class="mf-choice-title"><h3>${title}</h3><span>${available.length} available</span></div><p>${subtitle}</p>${available.length?giftsByRecipient(available).map(([name,gifts])=>`<div class="mf-recipient-group"><h4>${E(name)}</h4><div class="mf-items">${gifts.map(g=>giftButton(g,type)).join('')}</div></div>`).join(''):'<p class="mf-empty">Nothing in this section yet.</p>'}</section>`}
function favoritesCards(){
 return `<section class="settings-card mf-favorites"><div class="mf-choice-title"><h3>Interests & favorites</h3><span>Optional</span></div>
 <p>Help relatives choose thoughtful gifts. Write what each child enjoys, then decide whether to include their profile on the shared list. Nothing is published until you tap <b>Update shared list</b>.</p>
 <div class="mf-profile-grid">${configuredChildren().map(c=>`<section class="mf-profile" data-mf-profile="${E(c.id)}">
 <h4>${childChoiceIcon(c.id)} ${E(c.name)}</h4>
 <label class="mf-profile-field">Interests & activities<textarea data-mf-field="interests" maxlength="350" rows="2" placeholder="Art, dinosaurs, puzzles, science, animals…">${E(c.interests)}</textarea></label>
 <label class="mf-profile-field">Favorites<textarea data-mf-field="favorites" maxlength="350" rows="2" placeholder="Favorite characters, colors, books, types of toys…">${E(c.favorites)}</textarea></label>
 <label class="mf-profile-optin"><input type="checkbox" data-mf-field="shareFavorites" ${c.shareFavorites?'checked':''}><span>Share ${E(c.name)}'s profile with relatives</span></label>
 </section>`).join('')}</div>
 <p class="mf-private-hint">Do not include addresses, schools, dates of birth, or other identifying information. Public gift-list links can be forwarded.</p></section>`;
}
function saveProfileEdits(){
 const cards=[...document.querySelectorAll('[data-mf-profile]')];if(!cards.length)return false;
 const draft=new Map(cards.map(card=>[card.dataset.mfProfile,{
   interests:card.querySelector('[data-mf-field="interests"]')?.value.trim().slice(0,350)||'',
   favorites:card.querySelector('[data-mf-field="favorites"]')?.value.trim().slice(0,350)||'',
   shareFavorites:!!card.querySelector('[data-mf-field="shareFavorites"]')?.checked
 }]));
 const next=configuredChildren().map(c=>({...c,...(draft.get(c.id)||{})}));
 if(JSON.stringify(next)===JSON.stringify(configuredChildren()))return false;
 settings.children=next;syncLegacyChildren();saveSettingsLocal();return true;
}
function sharingPage(){
 const link=current.shareId?`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`:'';
 const ideaIds=new Set(eligible('ideas').map(g=>g.id)),bagIds=new Set(eligible('bag').map(g=>g.id));
 const stale=current.ideas.some(id=>!ideaIds.has(id))||current.bag.some(id=>!bagIds.has(id));
 const selected=current.ideas.filter(id=>ideaIds.has(id)).length+current.bag.filter(id=>bagIds.has(id)).length;
 return `<div class="mf-wrap">${heading('SHARE ONLY WHAT YOU CHOOSE','Family gift list','Choose gifts to show relatives. Your private planner stays private.',false)}
 <div class="mf-safety"><span>${ico('shield')}</span><p><strong>Private by default.</strong> Your link shows only selected gift names, recipients, and placements. No prices, budgets, notes, order details, or hiding spots.</p></div>
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
window.addEventListener('santa-family-changed',()=>{current.ideas=[];current.bag=[];current.shareId='';current.claims=[];current.loaded=false;current.loading=false;current.dirty=false;current.error=''});
const base=render;
render=function(){if(appState.page!=='family')return base();renderNav();document.getElementById('content').innerHTML=sharingPage();document.title='Santa HQ • Family list';if(!current.loaded&&!current.loading)setTimeout(load,0)};
const css=document.createElement('style');css.textContent=`
.mf-wrap{max-width:920px;margin:auto}.mf-safety{display:flex;align-items:flex-start;gap:12px;border:1px solid #e8e4f5;background:#f4f0ff;border-radius:17px;padding:14px 17px;margin:6px 0 19px;color:#68618f}.mf-safety svg{height:21px;width:21px;flex:none}.mf-safety p{margin:0;font-size:12px;line-height:1.6}.mf-choice-card{margin:12px 0}.mf-choice-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.mf-choice-title h3{margin:0}.mf-choice-title span{font-size:11px;color:#8784a6;font-weight:800}.mf-choice-card>p{margin:5px 0 14px}.mf-recipient-group{border-top:1px solid #eeeef5;padding:11px 0}.mf-recipient-group h4{margin:3px 0 8px;font-size:12px;color:#655bac}.mf-items{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mf-item{display:flex;align-items:center;gap:10px;background:#fdfcff;border:1px solid #eceaf8;border-radius:12px;padding:11px;cursor:pointer;min-width:0}.mf-item input{width:18px;height:18px;accent-color:#6256cb;flex:none}.mf-item span{display:grid;gap:2px;min-width:0}.mf-item strong{font-size:12px;overflow-wrap:anywhere}.mf-item small{font-size:11px;color:#83849c}.mf-publish-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;margin:9px 0;border-top:1px solid #e8e8f2}.mf-publish-bar>div{display:grid;gap:3px}.mf-publish-bar small,.mf-link-row small{display:block;color:#898ca0;font-size:11px}.mf-link-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;border:1px solid #e8e7f4;border-radius:16px;background:#fff;padding:14px}.mf-link-row>div{flex:1;min-width:170px}.mf-link-row .secondary{padding:10px 12px;text-decoration:none}.mf-error,.mf-notice{padding:11px 14px;border-radius:12px;background:#fff5e6;color:#87623c;font-size:12px}.mf-claim{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #ececf3}.mf-claims{margin-top:16px}.mf-claim .secondary{padding:8px 10px}.mf-empty{color:#9895a3}@media(max-width:660px){.mf-items{grid-template-columns:1fr}.mf-choice-card{padding:16px}.mf-publish-bar{align-items:flex-start;flex-wrap:wrap}}

.mf-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:16px 0}.mf-profile{border:1px solid #ebe7f5;border-radius:17px;padding:15px;background:#fdfcff;min-width:0}.mf-profile h4{display:flex;align-items:center;gap:8px;margin:0 0 12px;font:800 17px 'Outfit',sans-serif}.mf-profile .kid-symbol{font-size:23px}.mf-profile-field{display:grid;gap:5px;margin-bottom:10px;color:#645b79;font-size:12px;font-weight:800}.mf-profile-field textarea{width:100%;border:1px solid #dedbea;border-radius:10px;padding:10px;font:500 13px 'DM Sans',sans-serif;background:#fff;resize:vertical;min-height:68px;color:#2a304b}.mf-profile-optin{display:flex;align-items:flex-start;gap:8px;color:#50437d;font-size:12px;font-weight:800;cursor:pointer}.mf-profile-optin input{width:18px;height:18px;accent-color:#6656c5;flex:none}.mf-private-hint{color:#8d7993;font-size:11px;line-height:1.5;margin:0 0 8px}@media(max-width:670px){.mf-profile-grid{grid-template-columns:1fr}}
`;document.head.append(css);
document.addEventListener('input',e=>{if(e.target.closest('[data-mf-profile]'))current.dirty=true});
document.addEventListener('change',e=>{if(e.target.closest('[data-mf-profile]')){current.dirty=true;return}const box=e.target.closest('[data-mf-type]');if(!box)return;const type=box.dataset.mfType,id=box.dataset.mfId;if(!['ideas','bag'].includes(type))return;current[type]=box.checked?[...new Set([...current[type],id])]:current[type].filter(x=>x!==id);current.dirty=true;const n=document.querySelector('.mf-publish-bar b');if(n)n.textContent=(current.ideas.length+current.bag.length)+' selected'});
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-mf]');if(!btn)return;const act=btn.dataset.mf;
 if(act==='copy'){if(!current.shareId)return;const link=`${location.origin}/family.html#list=${encodeURIComponent(current.shareId)}`;try{await navigator.clipboard.writeText(link);showToast('Family list link copied')}catch{prompt('Copy your family list link:',link)}}
 if(act==='publish'){if(!window.SantaFamilies.isConnected()){showToast('Sign in before sharing your list.');return;}btn.disabled=true;
  try{saveProfileEdits();await window.SantaFamilies.refresh();if(window.SantaFamilies.queueCount()>0)throw Error('Your gifts are still syncing. Check your connection, then try Publish again.');const ideas=new Set(eligible('ideas').map(g=>g.id)),bag=new Set(eligible('bag').map(g=>g.id));const data=await window.SantaFamilies.api('/api/family/publish',{ideas:current.ideas.filter(id=>ideas.has(id)),bag:current.bag.filter(id=>bag.has(id))});current.ideas=data.list.ideas.map(x=>x.id);current.bag=data.list.bag.map(x=>x.id);current.shareId=data.shareId;current.dirty=false;current.error='';await load();showToast('Shared list updated');render()}
  catch(err){current.error=err.message;showToast(err.message)}finally{btn.disabled=false}
 }
 if(act==='release'){try{await window.SantaFamilies.api('/api/family/release',{giftId:btn.dataset.id});await load();showToast('Gift claim released')}catch(err){showToast(err.message)}}
});
})();
