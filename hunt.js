/* Santa HQ guest Christmas lights hunt with original picture examples and an optional shared scoreboard.
   Multiplayer uses anonymous room credentials scoped to ONE hunt, never family account credentials. */
(()=>{
'use strict';
const CLUES=[
 ['Christmas tree','A tree covered in twinkles',0,'lights'],
 ['Glowing star','A star up high',1,'lights'],
 ['Candy cane','A striped candy decoration',2,'decor'],
 ['Santa Claus','Santa waving from a yard',3,'character'],
 ['Snowman','A snowman with a smile',4,'character'],
 ['Reindeer','Look for antlers!',5,'character'],
 ['Holiday wreath','A glowing circle on a door',6,'decor'],
 ['Big light-up gift','A wrapped surprise outdoors',7,'decor'],
 ['Christmas elf','A cheerful helper',8,'character'],
 ['Icicle lights','Lights hanging down like ice',9,'lights'],
 ['Colorful roof','Lights tracing the roof',10,'lights'],
 ['Gingerbread person','A sweet holiday character',11,'character'],
 ['Penguin','A winter friend in a hat',12,'character'],
 ['Glowing snowflake','A sparkly winter shape',13,'lights'],
 ['Santa sleigh','A glowing ride full of gifts',14,'decor'],
 ['Pink or purple lights','A surprise-colored glow',15,'lights']
];
// Mega retains the 16 existing photo clues and adds 14 newer finds.
// Custom images uploaded into hunt-images/ can replace any clue's example art.
const MEGA_NEW=[
 {name:'Giant inflatable',hint:'Find an illuminated, oversized yard inflatable.',tier:'easy',type:'decor',symbol:'WOW',icon:'🎈'},
 {name:'Giant ornament',hint:'A big glowing Christmas bauble or ornament.',tier:'tricky',type:'decor',symbol:'JOY',icon:'🟣'},
 {name:'Nativity scene',hint:'A light-up manger or stable scene.',tier:'tricky',type:'decor',symbol:'STAR',icon:'⭐'},
 {name:'Light-up mailbox',hint:'A mailbox outlined or wrapped in Christmas lights.',tier:'tricky',type:'decor',symbol:'MAIL',icon:'📫'},
 {name:'Mickey Mouse',hint:'An illuminated or projected Mickey Mouse decoration.',tier:'expert',type:'character',symbol:'MICKEY',icon:'◉◉'},
 {name:'Winnie-the-Pooh',hint:'Pooh Bear glowing in a holiday yard display.',tier:'expert',type:'character',symbol:'POOH',icon:'🍯'},
 {name:'The Grinch',hint:'A lit-up or projected Grinch decoration.',tier:'expert',type:'character',symbol:'GRINCH',icon:'😈'},
 {name:'Snoopy',hint:'Snoopy in a holiday light or inflatable display.',tier:'expert',type:'character',symbol:'SNOOPY',icon:'🐾'},
 {name:'Olaf',hint:'The snowman from Frozen as a light-up decoration.',tier:'expert',type:'character',symbol:'OLAF',icon:'⛄'},
 {name:'Music-synced lights',hint:'Find lights that change in time with music.',tier:'expert',type:'effect',symbol:'MUSIC',icon:'🎵'},
 {name:'Holiday projector',hint:'Moving holiday images projected onto a house.',tier:'expert',type:'effect',symbol:'PROJECT',icon:'🎥'},
 {name:'Chasing light pattern',hint:'Lights that appear to race or travel across a display.',tier:'expert',type:'effect',symbol:'MOVE',icon:'✨'},
 {name:'Light tunnel or arch',hint:'Walkway or driveway with an illuminated arch or tunnel.',tier:'expert',type:'effect',symbol:'TUNNEL',icon:'🌈'},
 {name:'Lights spelling a word',hint:'Letters in lights spelling JOY, NOEL, MERRY or another word.',tier:'expert',type:'effect',symbol:'WORDS',icon:'ABC'}
];
const MEGA_ORIGINAL_TIERS=['easy','easy','easy','easy','easy','easy','easy','easy','easy','tricky','tricky','tricky','tricky','tricky','tricky','tricky'];
const MEGA_TIERS=[['easy','Easy finds','Start with the classics'],['tricky','Tricky finds','Look a little closer'],['expert','Expert finds','Rare characters and wow-factor lights']];
// Preserve the exact clue set/order of previously shared #h= hunts.
function legacyCards(huntId){
 const EASY=[
  ['A Christmas tree','A tree all dressed in lights'],['A glowing star','Shining on a tree or roof'],['Red lights','Look for a bright red glow'],
  ['Green lights','Can you spot a green glow?'],['Blue lights','Find something glowing blue'],['White lights','A whole patch of white twinkles'],
  ['A candy cane','A tall striped candy decoration'],['Santa Claus','An outdoor Santa decoration'],['A snowman','A smiling frosty friend'],
  ['A reindeer','Antlers in the yard or lights'],['A wreath','A circle of Christmas cheer'],['A big present','An outdoor gift decoration'],
  ['An inflatable','A giant puffy decoration'],['A light-up window','A glowing window display'],['A glowing roof','Lights outlining a rooftop'],
  ['An elf','A little helper decoration'],['Pink or purple lights','Find a surprise color'],['A lighted doorway','A front door ready for Christmas'],
  ['An ornament','A giant bauble decoration'],['A snowflake','A twinkly winter shape'],['A sleigh','A little sleigh or Santa ride'],
  ['A glowing bush','Lights wrapped in leaves or branches'],['A yard full of lights','Lots of twinkles in one place'],['Two colors together','A display mixing bright colors']
 ];
 const HARD=[...EASY,
  ['Blinking lights','Lights that flash on and off'],['A penguin','A chilly bird decoration'],['An icicle shape','Dangling light-up icicles'],
  ['A light tunnel','A walkway or arch of lights'],['A gingerbread person','A sweet light-up figure'],['A glowing mailbox','Christmas lights near a mailbox'],
  ['Lights in a spiral','A swirl or wrap of twinkles'],['A dancing display','Lights that move to music'],['A nativity scene','A glowing stable display'],
  ['A decorated porch','A whole porch dressed up'],['A giant bow','An extra-large holiday ribbon'],['A tree in a window','A lit tree seen from outside']
 ];

 const easy=huntId.startsWith('e_'),items=easy?EASY:HARD,random=rng(huntId);
 const photoFor=name=>{const s=name.toLowerCase();
  if(s.includes('santa'))return 3;if(s.includes('snowman'))return 4;if(s.includes('reindeer'))return 5;
  if(s.includes('elf'))return 8;if(s.includes('gingerbread'))return 11;if(s.includes('penguin'))return 12;
  if(s.includes('candy'))return 2;if(s.includes('wreath'))return 6;if(s.includes('snowflake'))return 13;
  if(s.includes('sleigh'))return 14;if(s.includes('star'))return 1;if(s.includes('icicle'))return 9;
  if(s.includes('gift')||s.includes('present'))return 7;if(s.includes('roof')||s.includes('doorway')||s.includes('window'))return 10;
  if(s.includes('purple')||s.includes('pink'))return 15;if(s.includes('tree')||s.includes('bush'))return 0;return 10;};
 const cards=items.map((v,i)=>({name:v[0],hint:v[1],photo:photoFor(v[0]),type:'legacy',id:i}));
 for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
 return cards.slice(0,easy?9:16);
}
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frag=location.hash;
const room=(frag.match(/^#room=([a-f0-9]{32})(?:&|$)/)||[])[1]||'';
const legacy=(frag.match(/^#h=([ef]_[a-f0-9]{24})$/)||[])[1]||'';
const requestedNight=(frag.match(/(?:^|&)night=([a-f0-9]{32})/)||[])[1]||'';
const state={crossCandidates:[],room,legacy,hunt:null,picks:[],photoOverrides:{},playerId:'',token:'',nickname:'',found:new Set(),leaders:[],saving:false,error:'',offline:false,photos:[],photoUrls:{},feedExpanded:false,pendingFile:null,pendingIndex:null,photoMode:false,photoBusy:false,photoSignature:'',megaPicks:[],megaFound:new Set(),directFound:new Set(),nights:[],nightLeaders:{},nightFound:{},completionYears:{},activeNightId:'',nightRequest:false,resend:false};
const key='santa_hq_hunt_player_v2_'+(room||legacy);
const slugFor=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// The Cloudflare build automatically generates this manifest from the actual
// photo files placed in the repository's hunt-images/ folder. No JS edits needed.
async function loadPhotoOverrides(){
 try{
  const response=await fetch('./hunt-images/manifest.json',{cache:'no-cache'});
  if(!response.ok)return;
  const map=await response.json();
  if(!map||typeof map!=='object'||Array.isArray(map))return;
  for(const [slug,url] of Object.entries(map)){
   if(/^[a-z0-9-]+$/.test(slug)&&typeof url==='string'&&/^\.\/hunt-images\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/.test(url)){
    state.photoOverrides[slug]=url;
   }
  }
 }catch{/* The original clue illustrations remain available offline. */}
}

function rng(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function generate(seed,mode){
 const cards=CLUES.map((x,i)=>({name:x[0],hint:x[1],photo:x[2],type:x[3],id:i}));
 let r=rng(seed);const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[items[i],items[j]]=[items[j],items[i]]}return items};
 if(mode==='mega'){
  const originals=cards.map((c,i)=>({...c,tier:MEGA_ORIGINAL_TIERS[i]}));
  let names=Array.isArray(state.hunt?.characters)&&state.hunt.characters.length===5?state.hunt.characters:null;
  const extras=MEGA_NEW.map((c,i)=>{
   if(i>=4&&i<=8&&names){const name=String(names[i-4]||'').slice(0,40);const familiar=MEGA_NEW.find(x=>x.name===name);c={...c,name,hint:'Find '+name+' as a light-up decoration, inflatable or projection.',icon:familiar?.icon||'🎄'};}
   return {...c,photo:null,id:CLUES.length+i,slug:slugFor(c.name)};
  });
  return [...originals,...extras]; // All thirty: ten per difficulty level.
 }
 if(mode==='family')return shuffle(cards);
 // Young kids always get several recognizable Christmas characters to spot.
 return shuffle([...shuffle(cards.filter(x=>x.type==='character')).slice(0,3),...shuffle(cards.filter(x=>x.type!=='character')).slice(0,6)]);
}
function errors(message){state.error=message||'';const el=$('errorBox');el.textContent=state.error;el.hidden=!state.error;}
function loadLocal(){try{
 const saved=JSON.parse(localStorage.getItem(key)||'{}');state.playerId=saved.playerId||'';state.token=saved.token||'';state.nickname=saved.nickname||'';
 if(legacy&&!state.nickname){state.nickname=localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':name')||'';if(state.nickname)state.playerId='local'}
 state.completionYears=saved.completionYears&&typeof saved.completionYears==='object'&&!Array.isArray(saved.completionYears)?saved.completionYears:{};
 let found=saved.found||[];
 if(legacy&&state.nickname&&!saved.found){found=JSON.parse(localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':checks:'+state.nickname.toLowerCase())||'[]')}
 state.found=new Set(found.filter(n=>Number.isInteger(n)&&n>=0&&n<state.picks.length));
 state.megaFound=new Set(state.found);state.directFound=new Set((saved.directFound||found).filter(n=>Number.isInteger(n)&&n>=0&&n<30));
 if(saved.nightFound&&typeof saved.nightFound==='object')state.nightFound=Object.fromEntries(Object.entries(saved.nightFound).map(([id,n])=>[id,Array.isArray(n)?n.filter(Number.isInteger):[]]));
 }catch{}}
function store(){try{localStorage.setItem(key,JSON.stringify({playerId:state.playerId,token:state.token,nickname:state.nickname,found:[...(state.megaPicks.length?state.megaFound:state.found)],directFound:[...state.directFound],nightFound:state.nightFound,completionYears:state.completionYears}));if(legacy){const b='santa_hq_guest_lights_v1_'+legacy;localStorage.setItem(b+':name',state.nickname);localStorage.setItem(b+':checks:'+state.nickname.toLowerCase(),JSON.stringify([...state.found]))}}catch{}}
function activeNight(){return state.nights.find(n=>n.id===state.activeNightId)||null}
function nightClueIndex(card,index){return Number.isInteger(card.megaIndex)?card.megaIndex:index}
function photoForClue(card,index){
 const n=activeNight();const megaIndex=n?card.megaIndex:index;
 return state.photos.find(p=>p.playerId===state.playerId&&(Number.isInteger(megaIndex)?(!p.nightId&&p.clueIndex===megaIndex):(n&&p.nightId===n.id&&p.clueIndex===index)));
}
const joinedKey='santa_hq_joined_lights_v1';
function joinedHunts(){try{const records=JSON.parse(localStorage.getItem(joinedKey)||'[]');return Array.isArray(records)?records.filter(r=>r&&/^[a-f0-9]{32}$/.test(r.id)&&/^[a-f0-9]{64}$/.test(r.token)).slice(0,30):[]}catch{return []}}
function rememberJoined(){if(!room||!state.token||!state.playerId)return;try{const list=joinedHunts().filter(r=>r.id!==room);list.unshift({id:room,token:state.token,nickname:state.nickname,title:state.hunt?.title||'Christmas lights hunt'});localStorage.setItem(joinedKey,JSON.stringify(list.slice(0,30)))}catch{}}
function cardFromClue(c,i){const original=CLUES.find(x=>slugFor(x[0])===slugFor(c.name));const color=['red','green','blue','white','pink','rainbow'].find(n=>slugFor(c.name).startsWith(n+'-'));return {...c,id:i,photo:original?original[2]:null,tier:'night',type:color?'color-'+color:original?original[3]:'decor',icon:'✦'}}
function competitionClues(hunt){
 if(hunt.mode==='standalone')return Array.isArray(hunt.clues)?hunt.clues:[];
 if(hunt.mode==='mega'){
   const names=[...CLUES.map(x=>x[0]),...MEGA_NEW.map(x=>x.name)];
   (hunt.characters||[]).forEach((name,i)=>{if(i<5)names[20+i]=name});
   return names.map(name=>({name}));
 }
 return [];
}
function matchedClue(name,targetName){const a=slugFor(name),b=slugFor(targetName);return a===b||(['pink-or-purple-lights','purple-lights'].includes(a)&&['pink-or-purple-lights','purple-lights'].includes(b))}
async function refreshCrossChoices(){
 const container=$('otherHuntChoices');if(!container)return;
 container.hidden=true;container.innerHTML='';state.crossCandidates=[];
 const clue=state.picks[Number($('photoClueSelect').value)];if(!clue)return;
 const candidates=joinedHunts().filter(r=>r.id!==room).slice(0,12);
 if(!candidates.length)return;
 const accepted=[];
 for(const record of candidates){try{
  const response=await fetch('/api/hunts/'+record.id,{headers:{Authorization:'Bearer '+record.token},cache:'no-store'});
  if(!response.ok)continue;const data=await response.json(),target=data.hunt;
  if(!target||target.archived||Date.now()>=target.expiresAt||!data.myProgress)continue;
  const main=competitionClues(target).map((c,i)=>({name:c.name,index:i,nightId:''})).filter(c=>matchedClue(clue.name,c.name));
  const nights=(data.nights||[]).flatMap(n=>(n.clues||[]).map((c,i)=>({name:c.name,index:i,nightId:n.id}))).filter(c=>matchedClue(clue.name,c.name));
  if(!main.length&&!nights.length)continue;
  accepted.push({record,target,main,nights,data});
 }catch{}}
 state.crossCandidates=accepted;
 if(!accepted.length)return;
 container.hidden=false;
 container.innerHTML='<strong>Also count this photo in another hunt?</strong><small>Only hunts you have joined on this device with a matching clue are shown. The other group will only see the picture if you choose Share above.</small>'+
  accepted.map((c,i)=>`<label><input type="checkbox" data-cross-index="${i}"><span>${safe(c.target.title||c.record.title)} <small>${c.target.photoMode?'Photo + progress':'Progress only'}</small></span></label>`).join('');
}
async function uploadToOtherHunt(item,blob,shared){
 const {record,target,main,nights,data}=item;
 const selected=main[0]||nights[0];if(!selected)return;
 // Credentials from a DIFFERENT hunt are required to post to it; invites alone are insufficient.
 if(target.photoMode){
  const form=new FormData();form.append('photo',blob,'hunt-photo.jpg');form.append('clueIndex',String(selected.index));
  if(selected.nightId)form.append('nightId',selected.nightId);
  form.append('shared',shared?'1':'0');
  const r=await fetch('/api/hunts/'+record.id+'/photos/upload',{method:'POST',headers:{Authorization:'Bearer '+record.token},body:form});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Photo transfer failed');
 }
 if(main.length){
  const found=new Set(data.myProgress.direct||data.myProgress.found||[]);
  found.add(main[0].index);
  const result=await api('/api/hunts/'+record.id+'/progress',{playerToken:record.token,found:[...found]});
  if(!result.ok)throw Error('Could not count the other hunt');
 }
 // A matching mini hunt in a different Mega competition also earns its nightly point.
 for(const night of nights){
  const found=new Set(data.myProgress.nights?.[night.nightId]||[]);found.add(night.index);
  await api('/api/hunts/'+record.id+'/nights/'+night.nightId+'/progress',{playerToken:record.token,found:[...found]});
 }
}
function renderHuntNav(){
 const el=$('nightNav');if(!el)return;
 if(!state.hunt||state.hunt.mode!=='mega'){el.hidden=true;return}
 el.hidden=false;
 const label=(found,total)=>`${Math.min(new Set(found).size,total)}/${total} found`;
 const options=[{id:'',title:'Mega Hunt',sub:label(state.megaFound,state.megaPicks.length)},...state.nights.map(n=>({id:n.id,title:n.title,sub:label(state.nightFound[n.id]||[],n.clues.length)}))];
 el.innerHTML=`<div class="hunt-hq-title"><strong>Hunt HQ</strong><small>One competition, as many themed nights as you want</small></div><div class="hunt-hq-tabs">${options.map(n=>`<button type="button" data-night-id="${safe(n.id)}" aria-pressed="${n.id===state.activeNightId}"><strong>${safe(n.title)}</strong><small>${safe(n.sub)}</small></button>`).join('')}</div><p class="hunt-hq-note">A find shared with Mega Hunt counts only once there. Bonus clues can win a themed night without adding extra Mega points.</p>`;
}
function switchNight(id,updateURL=true){
 if(id&&!state.nights.some(n=>n.id===id))return;
 state.activeNightId=id;
 const night=activeNight();
 if(night){
  state.picks=night.clues.map((c,i)=>Number.isInteger(c.megaIndex)?{...state.megaPicks[c.megaIndex],megaIndex:c.megaIndex,tier:'night'}:{...c,photo:null,icon:'✨',tier:'night',type:'lights'});
  state.found=new Set(state.nightFound[night.id]||[]);
 }else{state.picks=state.megaPicks;state.found=new Set(state.megaFound)}
 if(updateURL&&room)history.replaceState(null,'',location.pathname+location.search+'#room='+room+(id?'&night='+id:''));
 renderBoard();renderLeaders();if(state.photoMode)renderFeed();
}
function applyRoomData(data){
 if(!data||!state.hunt)return;
 state.leaders=data.leaders||[];state.nights=Array.isArray(data.nights)?data.nights:[];state.nightLeaders=data.nightLeaders||{};
 if(data.myProgress){
   state.megaFound=new Set(data.myProgress.found||[]);
   state.directFound=new Set(data.myProgress.direct||[]);
   for(const [id,found] of Object.entries(data.myProgress.nights||{}))state.nightFound[id]=found;
   store();
 }
 if(!state.activeNightId&&requestedNight&&state.nights.some(n=>n.id===requestedNight))state.activeNightId=requestedNight;
 if(state.activeNightId&&!state.nights.some(n=>n.id===state.activeNightId))state.activeNightId='';
 switchNight(state.activeNightId,false);
}
async function fetchRoom(){
 const response=await fetch('/api/hunts/'+room,{headers:state.token?{'Authorization':'Bearer '+state.token}:{},cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Cannot load the competition');
 return data;
}
$('nightNav')?.addEventListener('click',event=>{const b=event.target.closest('[data-night-id]');if(b)switchNight(b.dataset.nightId||'')});
function card(c,i){
 const picture=c.photo!==null&&c.photo!==undefined;
 const x=picture?(c.photo%4)*100/3:0,y=picture?Math.floor(c.photo/4)*100/3:0;
 const custom=state.photoOverrides[slugFor(c.name)]||'';
 const myPhoto=photoForClue(c,i);
 const mySrc=myPhoto&&(state.photoUrls[myPhoto.id]|| (myPhoto.shared?photoUrl(myPhoto.id):''));
 const altSrc=mySrc||custom;
 const image=altSrc?`<span class="photo custom-photo-wrap"><img class="custom-hunt-photo" src="${safe(altSrc)}" alt="${mySrc?'Your photo of ':'Example of '}${safe(c.name)}" loading="lazy"></span>`:
  picture?`<span class="photo" role="img" aria-label="Example photograph of ${safe(c.name)}" style="background-position:${x}% ${y}%"></span>`:
  `<span class="photo graphic ${safe(c.type)}" role="img" aria-label="Illustrated clue: ${safe(c.name)}"><span class="graphic-icon" aria-hidden="true">${safe(c.icon||'✨')}</span></span>`;
 const content=`<span class="content"><strong>${safe(c.name)}</strong><small>${safe(c.hint)}</small><span class="found-label">${state.found.has(i)?'✓ Found':state.photoMode?'Add a photo to find':'Tap when found'}</span></span>`;
 if(!state.photoMode)return `<button class="find ${state.found.has(i)?'found':''}" data-spot="${i}" aria-pressed="${state.found.has(i)}" type="button">${image}${content}</button>`;
 return `<div class="find photo-find ${state.found.has(i)?'found':''}">${image}${content}<div class="photo-find-actions"><button type="button" class="btn primary" data-photo-for="${i}">${myPhoto?'Replace photo':'Take / add photo'}</button>${myPhoto?`<button type="button" class="photo-small-action" data-photo-share="${safe(myPhoto.id)}">${myPhoto.shared?'Unshare':'Share'}</button><button type="button" class="photo-small-action" data-photo-remove="${safe(myPhoto.id)}">Remove</button>`:''}</div></div>`;
}
function renderBoard(){
 const count=state.picks.length,done=state.picks.filter((_,index)=>state.found.has(index)).length;
 const percentage=count?Math.round(100*done/count):0;
 const night=activeNight();
 const theme=night?.theme||(state.hunt?.mode==='standalone'?state.hunt.theme:'');
 const boardId=night?.id||'standalone';
 if(state.playerId&&theme&&theme!=='random'&&count&&done===count&&!state.completionYears[boardId]){
  state.completionYears[boardId]=new Date().getFullYear();
  store();
 }
 $('joinPanel').hidden=!!state.playerId;
 $('gamePanel').hidden=!state.playerId;
 $('classicHuntIntro').hidden=state.photoMode; $('photoModeIntro').hidden=!state.photoMode; $('photoFeedPanel').hidden=!state.photoMode; $('photoTakeBtn').hidden=!state.photoMode;
 $('boardTitle').textContent=activeNight()?activeNight().title:(state.hunt?.title||'Christmas lights hunt');
 $('boardSubtitle').textContent=activeNight()?`8 clues · ${activeNight().title} · linked to your Mega competition`:state.hunt?.mode==='standalone'?`8 clues · ${state.hunt.theme==='random'?'Surprise Mix':state.hunt.theme} · ${state.hunt.playMode==='solo'?'play independently':'play together'}`:count===30?'30 clues · ongoing Mega lights hunt':count===16?'16 photo clues · family challenge':'9 photo clues · little lights hunt';
 $('leaderPanel').hidden=state.hunt?.playMode==='solo';
 $('huntEndedNote').hidden=!state.hunt?.archived;
 $('joinPanel').hidden=!!state.playerId||!!state.hunt?.archived;
 if(state.hunt?.archived){$('photoTakeBtn').disabled=true;$('resetBtn').disabled=true;}
 $('progressCount').textContent=done+' / '+count;
 $('progressLabel').textContent=done===count?'Every clue spotted!':`${count-done} more to find`;
 $('progressPct').textContent=percentage+'%';
 $('progressBar').style.width=percentage+'%';
 $('challengeSummary').textContent=`Challenge progress · ${done} of ${count} found`;
 $('challengeClues').innerHTML=state.picks.map((clue,index)=>`<li><span>${safe(clue.name)}</span><strong>${state.found.has(index)?'Found':'Still to find'}</strong></li>`).join('');
 renderHuntNav();
 $('huntBoard').classList.toggle('challenge',count===16);
 $('huntBoard').classList.toggle('mega',count===30);
 if(count===30){
  $('huntBoard').innerHTML=MEGA_TIERS.map(([tier,title,description])=>{
   const entries=state.picks.map((c,i)=>({c,i})).filter(x=>x.c.tier===tier);
   const spotted=entries.filter(x=>state.found.has(x.i)).length;
   return `<section class="mega-group tier-${tier}" aria-label="${title}"><header class="mega-head"><div><span class="mega-tier">${title}</span><small>${description}</small></div><strong>${spotted}/${entries.length}</strong></header><div class="mega-grid">${entries.map(x=>card(x.c,x.i)).join('')}</div></section>`;
  }).join('');
 }else $('huntBoard').innerHTML=state.picks.map(card).join('');
 // Images are visual examples only; the tappable whole-card behavior stays intact.
 $('huntBoard').querySelectorAll('.custom-hunt-photo').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
 $('winBanner').textContent=activeNight()?'All themed-night finds complete! Great spotting!':count===30?'All 30 clues found! You are a Mega Lights Hunt champion!':'Every clue found! Well done!';
 $('winBanner').hidden=done!==count;
}
function renderLeaders(){
 const megaStandings=$('megaNightStandings');
 if(megaStandings){
  megaStandings.hidden=!activeNight();
  if(activeNight())$('megaNightList').innerHTML=(state.leaders||[]).slice(0,4).map((p,i)=>`<div><span>${i+1}. ${safe(p.nickname)}</span><strong>${p.score}/30</strong></div>`).join('')||'<small>Start spotting to see the overall competition.</small>';
 }
 const leaders=activeNight()?(state.nightLeaders[state.activeNightId]||[]):state.leaders,maximum=state.picks.length;
 if(!leaders.length){$('leaderText').textContent=state.legacy?'This older hunt keeps scores on each device. Start a new hunt for a live family leaderboard.':'Nobody has joined yet. Share this link and invite your teams!';$('leaderboard').innerHTML='';return;}
 const high=leaders[0].score,winners=leaders.filter(p=>p.score===high),leaderNames=winners.map(p=>p.nickname);
 $('leaderText').textContent=high===maximum?`🏆 ${leaderNames.join(' & ')} finished!`:winners.length===1?`🏆 ${leaderNames[0]} is leading with ${high} finds!`:`🏆 It's a tie at ${high} finds: ${leaderNames.join(' & ')}`;
 $('leaderboard').innerHTML=leaders.map((p,i)=>`<div class="rank ${p.id===state.playerId?'me':''}"><span class="place">${i+1}</span><div><div class="name">${safe(p.nickname)} ${p.id===state.playerId?'(you)':''}</div><div class="mini"><i style="width:${100*p.score/maximum}%"></i></div></div><strong class="score">${p.score}/${maximum}</strong></div>`).join('');
}
async function api(path,body){const response=await fetch(path,{method:body?'POST':'GET',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});let data={};try{data=await response.json()}catch{}if(!response.ok)throw Error(data.error||'Could not connect to the hunt');return data}
async function refresh(){if(!room||document.hidden||state.saving)return;try{const result=await fetchRoom();applyRoomData(result);$('liveStatus').textContent='● Live';state.offline=false;if(state.error==='Scores could not update. Check your connection.')errors('');if(state.photoMode&&state.playerId)await loadGallery()}catch(e){state.offline=true;$('liveStatus').textContent='Offline';errors('Scores could not update. Check your connection.')}}
async function sendProgress(){
 if(!room||!state.token)return;
 if(state.saving){state.resend=true;return}
 state.saving=true;
 try{
  do{
   state.resend=false;
   const night=activeNight();const body={playerToken:state.token,found:night?[...state.found]:state.hunt.mode==='mega'?[...state.directFound]:[...state.found]};
   const target=night?'/api/hunts/'+room+'/nights/'+night.id+'/progress':'/api/hunts/'+room+'/progress';
   await api(target,body);errors('');
  }while(state.resend);
 }catch(e){errors(e.message+' Your checkmarks are saved on this device; tap another clue when connected to retry.')}
 finally{state.saving=false}
 await refresh();
}
async function start(){const nickname=$('playerName').value.trim().slice(0,24);if(!nickname){errors('Choose a nickname or team name first.');$('playerName').focus();return}try{if(room){const result=await api('/api/hunts/'+room+'/join',{nickname});state.playerId=result.playerId;state.token=result.playerToken;}else{state.playerId='local';state.token='';}state.nickname=nickname;state.found=new Set();state.megaFound=new Set();state.directFound=new Set();state.nightFound={};if(legacy){try{state.found=new Set(JSON.parse(localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':checks:'+nickname.toLowerCase())||'[]'))}catch{}}store();rememberJoined();errors('');renderBoard();await refresh();if(state.photoMode)await loadGallery()}catch(e){errors(e.message)}}
// Guest photo hunt: private R2 originals with D1 metadata; only opted-in photos appear in the feed.
const photoUrl=id=>'/api/hunts/'+room+'/photos/file/'+id;
const photoAuth=()=>({'Authorization':'Bearer '+state.token});
async function loadGallery(){
 if(!state.photoMode||!room||!state.playerId||!state.token)return;
 try{
  const response=await fetch('/api/hunts/'+room+'/photos',{headers:photoAuth(),cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Photo feed unavailable');
  const photos=Array.isArray(data.photos)?data.photos:[];
  const signature=photos.map(p=>p.id+':'+p.shared).join('|');
  state.photos=photos;
  if(signature!==state.photoSignature){
   state.photoSignature=signature;
   for(const p of photos.filter(x=>x.playerId===state.playerId&&!x.shared)){
    if(state.photoUrls[p.id])continue;
    try{const r=await fetch(photoUrl(p.id),{headers:photoAuth(),cache:'no-store'});if(r.ok)state.photoUrls[p.id]=URL.createObjectURL(await r.blob())}catch{}
   }
   renderBoard();renderFeed();
  }
 }catch(e){errors(e.message)}
}
function renderFeed(){
 const el=$('familyPhotoFeed');if(!el)return;
 const photos=state.photos.filter(p=>p.shared).sort((a,b)=>b.createdAt-a.createdAt);
 $('photoFeedCount').textContent=photos.length+' shared';
 $('photoFeedExpand').hidden=photos.length<=8;
 $('photoFeedExpand').textContent=state.feedExpanded?'Show fewer':'See all '+photos.length;
 const visible=state.feedExpanded?photos:photos.slice(0,8);
 el.innerHTML=visible.length?visible.map(p=>{
   const name=p.clueName||state.megaPicks[p.clueIndex]?.name||state.picks[p.clueIndex]?.name||'Christmas light';
   return `<button class="feed-card" type="button" data-photo-view="${safe(p.id)}"><img src="${safe(photoUrl(p.id))}" loading="lazy" alt="${safe(name)} shared by ${safe(p.nickname)}"><strong>${safe(name)}</strong><small>${safe(p.nickname)}</small></button>`;
 }).join(''):'<p class="muted">No shared photos yet. Be the first to share a find!</p>';
}
function photoEditorClose(){
 $('photoComposer').hidden=true;state.pendingFile=null;state.pendingIndex=null;state.crossCandidates=[];$('otherHuntChoices').innerHTML='';$('otherHuntChoices').hidden=true;
 const preview=$('photoPreview');if(preview.dataset.objectUrl){URL.revokeObjectURL(preview.dataset.objectUrl);delete preview.dataset.objectUrl}preview.removeAttribute('src');
 $('photoCapture').value='';
}
function openPhotoCapture(index=null){
 if(state.hunt?.archived){errors('This hunt is archived and read-only.');return}
 if(!state.playerId){errors('Join the hunt first.');return}
 if(!state.photoMode)return;
 state.pendingIndex=index;
 $('photoCapture').click();
}
async function resizeForHunt(file){
 if(!file||!file.type.startsWith('image/'))throw Error('Choose a picture from your camera or photo library.');
 const object=URL.createObjectURL(file);
 try{
  const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(Error('Cannot open this image. Try a JPG or PNG photo.'));im.src=object});
  const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height)throw Error('Invalid photo.');
  const scale=Math.min(1,1280/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Photo conversion failed.')),'image/jpeg',.77));
  if(blob.size>2*1024*1024)throw Error('This photo is too large. Choose a smaller photo.');
  return blob; // Redrawing via canvas strips the source image's EXIF/GPS metadata.
 }finally{URL.revokeObjectURL(object)}
}
async function uploadPhoto(){
 if(state.photoBusy||!state.pendingFile)return;
 const index=Number($('photoClueSelect').value);
 if(!Number.isInteger(index)||index<0||index>=state.picks.length){errors('Select the clue you photographed.');return}
 state.photoBusy=true;$('photoSave').disabled=true;$('photoSave').textContent='Saving photo…';
 try{
  const blob=await resizeForHunt(state.pendingFile);
  const also=state.crossCandidates.filter((c,i)=>$('otherHuntChoices').querySelector('[data-cross-index="'+i+'"]')?.checked);
  const sharedWithOther=$('photoShare').checked;
  const form=new FormData();form.append('photo',blob,'hunt-photo.jpg');const night=activeNight(),megaIndex=night?state.picks[index]?.megaIndex:null;form.append('clueIndex',String(Number.isInteger(megaIndex)?megaIndex:index));if(night&&!Number.isInteger(megaIndex))form.append('nightId',night.id);form.append('shared',$('photoShare').checked?'1':'0');
  const r=await fetch('/api/hunts/'+room+'/photos/upload',{method:'POST',headers:photoAuth(),body:form});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not upload photo');
  state.found.add(index);if(activeNight())state.nightFound[state.activeNightId]=[...state.found];else{state.directFound.add(index);state.megaFound.add(index)}store();photoEditorClose();renderBoard();await sendProgress();await loadGallery();
  const unsuccessful=[];for(const item of also){try{await uploadToOtherHunt(item,blob,sharedWithOther)}catch(e){unsuccessful.push(item.target.title+': '+e.message)}}
  errors(unsuccessful.length?'Saved in this hunt, but '+unsuccessful.join(' · '):'');
 }catch(e){errors(e.message)}finally{state.photoBusy=false;$('photoSave').disabled=false;$('photoSave').textContent='Save this find'}
}
async function changePhoto(id,operation){
 const row=state.photos.find(p=>p.id===id&&p.playerId===state.playerId);if(!row)return;
 if(operation==='delete'&&!confirm('Remove this photo and its hunt find? This also removes it from the family photo feed if shared.'))return;
 try{
  const r=await fetch('/api/hunts/'+room+'/photos/'+operation+'/'+id,{method:'POST',headers:{...photoAuth(),'Content-Type':'application/json'},body:JSON.stringify(operation==='visibility'?{shared:!row.shared}:{})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Could not update photo');
  if(operation==='delete'){const index=state.picks.findIndex((c,i)=>row.nightId?(activeNight()?.id===row.nightId&&i===row.clueIndex):activeNight()?c.megaIndex===row.clueIndex:i===row.clueIndex);if(index>=0){state.found.delete(index);if(!activeNight())state.directFound.delete(index);state.nightFound[state.activeNightId]=[...state.found];store();await sendProgress()}}
  if(state.photoUrls[id]&&operation==='delete'){URL.revokeObjectURL(state.photoUrls[id]);delete state.photoUrls[id]}
  state.photoSignature='';await loadGallery();
 }catch(e){errors(e.message)}
}
$('photoTakeBtn').addEventListener('click',()=>openPhotoCapture());
$('photoCapture').addEventListener('change',e=>{
 const f=e.target.files?.[0];if(!f)return;
 state.pendingFile=f;
 const select=$('photoClueSelect');select.innerHTML=state.picks.map((x,i)=>`<option value="${i}">${safe(x.name)}</option>`).join('');
 select.value=state.pendingIndex===null?'0':String(state.pendingIndex);
 $('photoShare').checked=false;
 const u=URL.createObjectURL(f);$('photoPreview').src=u;$('photoPreview').dataset.objectUrl=u;
 $('photoComposer').hidden=false;$('photoComposer').scrollIntoView({block:'nearest',behavior:'smooth'});void refreshCrossChoices();
});
$('photoClueSelect').addEventListener('change',()=>{void refreshCrossChoices()});
$('photoCancel').addEventListener('click',photoEditorClose);
$('photoSave').addEventListener('click',uploadPhoto);
$('photoFeedExpand').addEventListener('click',()=>{state.feedExpanded=!state.feedExpanded;renderFeed()});
$('huntBoard').addEventListener('click',e=>{
 const shot=e.target.closest('[data-photo-for]');if(shot){openPhotoCapture(Number(shot.dataset.photoFor));return}
 const share=e.target.closest('[data-photo-share]');if(share){changePhoto(share.dataset.photoShare,'visibility');return}
 const remove=e.target.closest('[data-photo-remove]');if(remove){changePhoto(remove.dataset.photoRemove,'delete');return}
});
$('familyPhotoFeed').addEventListener('click',e=>{
 const b=e.target.closest('[data-photo-view]');if(!b)return;
 const p=state.photos.find(x=>x.id===b.dataset.photoView);if(!p)return;
 $('photoViewerImg').src=photoUrl(p.id);$('photoViewerTitle').textContent=(p.clueName||state.megaPicks[p.clueIndex]?.name||state.picks[p.clueIndex]?.name||'Holiday lights')+' · '+p.nickname;
 $('photoViewer').hidden=false;
});
$('photoViewerClose').addEventListener('click',()=>{$('photoViewer').hidden=true;$('photoViewerImg').removeAttribute('src')});
async function init(){
 if(!room&&!legacy){errors('This is not a valid hunt link. Ask your family for a fresh link.');$('joinPanel').hidden=true;return;}
 try{if(room){const data=await api('/api/hunts/'+room);state.hunt=data.hunt;state.leaders=data.leaders||[];state.nights=data.nights||[];state.nightLeaders=data.nightLeaders||{};}else{state.hunt={mode:legacy.startsWith('f_')?'family':'easy',seed:legacy};state.leaders=[];$('liveStatus').textContent='Solo scoring';}}
 catch(e){errors(e.message);$('joinPanel').hidden=true;return}
 await loadPhotoOverrides();state.photoMode=!!state.hunt.photoMode;state.picks=legacy?legacyCards(legacy):state.hunt.mode==='standalone'?state.hunt.clues.map(cardFromClue):generate(state.hunt.seed,state.hunt.mode);state.megaPicks=state.picks.slice();loadLocal();rememberJoined();$('playerName').value=state.nickname;switchNight(requestedNight&&state.nights.some(n=>n.id===requestedNight)?requestedNight:'',false);if(room){if(state.playerId&&state.token)await refresh();if(state.photoMode&&state.playerId)await loadGallery();setInterval(refresh,8000)}
}
$('startBtn').addEventListener('click',start);
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();start()}});
$('huntBoard').addEventListener('click',e=>{if(state.photoMode||state.hunt?.archived)return;const b=e.target.closest('[data-spot]');if(!b||!state.playerId)return;const i=Number(b.dataset.spot);if(!Number.isInteger(i)||i<0||i>=state.picks.length)return;const next=!state.found.has(i);if(next)state.found.add(i);else state.found.delete(i);if(activeNight())state.nightFound[state.activeNightId]=[...state.found];else{if(next)state.directFound.add(i);else state.directFound.delete(i);state.megaFound=new Set(state.found)}store();renderBoard();sendProgress()});
$('resetBtn').addEventListener('click',()=>{if(state.hunt?.archived)return;if(!confirm('Clear finds for this board? Mega keeps points earned in other themed nights.'))return;state.found.clear();if(activeNight())state.nightFound[state.activeNightId]=[];else{state.directFound.clear();state.megaFound.clear()}store();renderBoard();sendProgress()});
$('printBtn').addEventListener('click',()=>window.print());
$('shareBtn').addEventListener('click',async()=>{const url=room?location.origin+location.pathname+'#room='+room:location.href;try{if(navigator.share){await navigator.share({title:'Santa HQ Christmas lights hunt',url,text:'Join our family lights hunt!'});return}await navigator.clipboard.writeText(url);$('shareBtn').textContent='Link copied!';setTimeout(()=>$('shareBtn').textContent='Share hunt',2200)}catch(e){if(e.name!=='AbortError')prompt('Copy the hunt link:',url)}});
window.addEventListener('online',()=>{if(room){sendProgress();refresh()}});
init();
})();
