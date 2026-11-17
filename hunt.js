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
const room=(frag.match(/^#room=([a-f0-9]{32})$/)||[])[1]||'';
const legacy=(frag.match(/^#h=([ef]_[a-f0-9]{24})$/)||[])[1]||'';
const state={room,legacy,hunt:null,picks:[],playerId:'',token:'',nickname:'',found:new Set(),leaders:[],saving:false,error:'',offline:false};
const key='santa_hq_hunt_player_v2_'+(room||legacy);
function rng(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function generate(seed,mode){
 const cards=CLUES.map((x,i)=>({name:x[0],hint:x[1],photo:x[2],type:x[3],id:i}));
 let r=rng(seed);const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[items[i],items[j]]=[items[j],items[i]]}return items};
 if(mode==='family')return shuffle(cards);
 // Young kids always get several recognizable Christmas characters to spot.
 return shuffle([...shuffle(cards.filter(x=>x.type==='character')).slice(0,3),...shuffle(cards.filter(x=>x.type!=='character')).slice(0,6)]);
}
function errors(message){state.error=message||'';const el=$('errorBox');el.textContent=state.error;el.hidden=!state.error;}
function loadLocal(){try{
 const saved=JSON.parse(localStorage.getItem(key)||'{}');state.playerId=saved.playerId||'';state.token=saved.token||'';state.nickname=saved.nickname||'';
 if(legacy&&!state.nickname){state.nickname=localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':name')||'';if(state.nickname)state.playerId='local'}
 let found=saved.found||[];
 if(legacy&&state.nickname&&!saved.found){found=JSON.parse(localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':checks:'+state.nickname.toLowerCase())||'[]')}
 state.found=new Set(found.filter(n=>Number.isInteger(n)&&n>=0&&n<(state.hunt?.mode==='family'?16:9)));
 }catch{}}
function store(){try{localStorage.setItem(key,JSON.stringify({playerId:state.playerId,token:state.token,nickname:state.nickname,found:[...state.found]}));if(legacy){const b='santa_hq_guest_lights_v1_'+legacy;localStorage.setItem(b+':name',state.nickname);localStorage.setItem(b+':checks:'+state.nickname.toLowerCase(),JSON.stringify([...state.found]))}}catch{}}
function card(c,i){const x=(c.photo%4)*100/3,y=Math.floor(c.photo/4)*100/3;return `<button class="find ${state.found.has(i)?'found':''}" data-spot="${i}" aria-pressed="${state.found.has(i)}" type="button"><span class="photo" role="img" aria-label="Example photograph of ${safe(c.name)}" style="background-position:${x}% ${y}%"></span><span class="content"><strong>${safe(c.name)}</strong><small>${safe(c.hint)}</small><span class="found-label">${state.found.has(i)?'✓ Found':'Tap when found'}</span></span></button>`}
function renderBoard(){
 const count=state.picks.length,done=state.found.size;
 $('joinPanel').hidden=!!state.playerId;
 $('gamePanel').hidden=!state.playerId;
 $('boardTitle').textContent=state.nickname?state.nickname+"'s light hunt":'Christmas lights hunt';
 $('boardSubtitle').textContent=count===16?'16 photo clues · family challenge':'9 photo clues · little lights hunt';
 $('progressCount').textContent=done+' / '+count;
 $('progressLabel').textContent=done===count?'Every clue spotted!':`${count-done} more to find`;
 $('progressPct').textContent=Math.round(100*done/count)+'%';
 $('progressBar').style.width=(100*done/count)+'%';
 $('huntBoard').classList.toggle('challenge',count===16);
 $('huntBoard').innerHTML=state.picks.map(card).join('');
 $('winBanner').hidden=done!==count;
}
function renderLeaders(){
 const leaders=state.leaders,maximum=state.picks.length;
 if(!leaders.length){$('leaderText').textContent=state.legacy?'This older hunt keeps scores on each device. Start a new hunt for a live family leaderboard.':'Nobody has joined yet. Share this link and invite your teams!';$('leaderboard').innerHTML='';return;}
 const high=leaders[0].score,winners=leaders.filter(p=>p.score===high),leaderNames=winners.map(p=>p.nickname);
 $('leaderText').textContent=high===maximum?`🏆 ${leaderNames.join(' & ')} finished!`:winners.length===1?`🏆 ${leaderNames[0]} is leading with ${high} finds!`:`🏆 It's a tie at ${high} finds: ${leaderNames.join(' & ')}`;
 $('leaderboard').innerHTML=leaders.map((p,i)=>`<div class="rank ${p.id===state.playerId?'me':''}"><span class="place">${i+1}</span><div><div class="name">${safe(p.nickname)} ${p.id===state.playerId?'(you)':''}</div><div class="mini"><i style="width:${100*p.score/maximum}%"></i></div></div><strong class="score">${p.score}/${maximum}</strong></div>`).join('');
}
async function api(path,body){const response=await fetch(path,{method:body?'POST':'GET',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});let data={};try{data=await response.json()}catch{}if(!response.ok)throw Error(data.error||'Could not connect to the hunt');return data}
async function refresh(){if(!room||document.hidden)return;try{const result=await api('/api/hunts/'+room);state.leaders=result.leaders||[];renderLeaders();$('liveStatus').textContent='● Live';state.offline=false;if(state.error==='Scores could not update. Check your connection.')errors('')}catch(e){state.offline=true;$('liveStatus').textContent='Offline';errors('Scores could not update. Check your connection.')}}
async function sendProgress(){if(!room||!state.token||state.saving)return;state.saving=true;try{await api('/api/hunts/'+room+'/progress',{playerToken:state.token,found:[...state.found]});errors('');await refresh()}catch(e){errors(e.message+' Your checkmarks are saved on this device; tap another clue when connected to retry.')}finally{state.saving=false}}
async function start(){const nickname=$('playerName').value.trim().slice(0,24);if(!nickname){errors('Choose a nickname or team name first.');$('playerName').focus();return}try{if(room){const result=await api('/api/hunts/'+room+'/join',{nickname});state.playerId=result.playerId;state.token=result.playerToken;}else{state.playerId='local';state.token='';}state.nickname=nickname;state.found=new Set();if(legacy){try{state.found=new Set(JSON.parse(localStorage.getItem('santa_hq_guest_lights_v1_'+legacy+':checks:'+nickname.toLowerCase())||'[]'))}catch{}}store();errors('');renderBoard();await refresh()}catch(e){errors(e.message)}}
async function init(){
 if(!room&&!legacy){errors('This is not a valid hunt link. Ask your family for a fresh link.');$('joinPanel').hidden=true;return;}
 try{if(room){const data=await api('/api/hunts/'+room);state.hunt=data.hunt;state.leaders=data.leaders||[];}else{state.hunt={mode:legacy.startsWith('f_')?'family':'easy',seed:legacy};state.leaders=[];$('liveStatus').textContent='Solo scoring';}}
 catch(e){errors(e.message);$('joinPanel').hidden=true;return}
 state.picks=legacy?legacyCards(legacy):generate(state.hunt.seed,state.hunt.mode);loadLocal();$('playerName').value=state.nickname;renderBoard();renderLeaders();if(room){if(state.playerId&&state.token)sendProgress();setInterval(refresh,8000)}
}
$('startBtn').addEventListener('click',start);
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();start()}});
$('huntBoard').addEventListener('click',e=>{const b=e.target.closest('[data-spot]');if(!b||!state.playerId)return;const i=Number(b.dataset.spot);if(!Number.isInteger(i)||i<0||i>=state.picks.length)return;if(state.found.has(i))state.found.delete(i);else state.found.add(i);store();renderBoard();sendProgress()});
$('resetBtn').addEventListener('click',()=>{if(!confirm('Clear your own checkmarks? Other family members keep theirs.'))return;state.found.clear();store();renderBoard();sendProgress()});
$('printBtn').addEventListener('click',()=>window.print());
$('shareBtn').addEventListener('click',async()=>{const url=location.href;try{if(navigator.share){await navigator.share({title:'Santa HQ Christmas lights hunt',url,text:'Join our family lights hunt!'});return}await navigator.clipboard.writeText(url);$('shareBtn').textContent='Link copied!';setTimeout(()=>$('shareBtn').textContent='Share hunt',2200)}catch(e){if(e.name!=='AbortError')prompt('Copy the hunt link:',url)}});
window.addEventListener('online',()=>{if(room){sendProgress();refresh()}});
init();
})();
