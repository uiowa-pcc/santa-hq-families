/** Santa HQ — shared website, private household accounts. Deploy with wrangler.jsonc and a NEW D1. */
const MAX_BODY=850000;
const SESSION_LIFE=14*86400*1000;
const INVITE_LIFE=7*86400*1000;
const PBKDF2_ITERATIONS=210000;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const error=(message,status=400)=>json({error:message},status);
const id=()=>crypto.randomUUID();
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
const utf=s=>new TextEncoder().encode(s);
async function digest(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',utf(s))))}
async function hashPassword(password,salt,pepper){
  const key=await crypto.subtle.importKey('raw',utf(password+'|'+pepper),'PBKDF2',false,['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:utf(salt),iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},key,256)));
}
const equal=(a,b)=>a.length===b.length && a.split('').reduce((diff,c,i)=>diff|(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
function cookie(token){return `__Host-santa_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFE/1000}`}
const expireCookie='__Host-santa_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
const emailOK=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
function validateBody(body){if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid request body.');return body}
async function bodyJSON(request){const size=Number(request.headers.get('content-length')||0);if(size>MAX_BODY)throw Error('Request is too large.');const text=await request.text();if(text.length>MAX_BODY)throw Error('Request is too large.');return validateBody(JSON.parse(text))}
async function session(request,db){
  const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-santa_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token)return null;
  const tokenHash=await digest(token),now=Date.now();
  return db.prepare(`SELECT s.token_hash,s.user_id,s.household_id,m.role,u.email,h.name AS family_name
    FROM sessions s JOIN memberships m ON m.user_id=s.user_id AND m.household_id=s.household_id
    JOIN users u ON u.id=s.user_id JOIN households h ON h.id=s.household_id
    WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash,now).first();
}
async function makeSession(db,userId,familyId){
  const token=hex(bytes(32)),tokenHash=await digest(token),now=Date.now();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,household_id,expires_at,created_at) VALUES(?,?,?,?,?)').bind(tokenHash,userId,familyId,now+SESSION_LIFE,now).run();
  return token;
}
async function profile(db,householdId){
  const row=await db.prepare("SELECT data FROM records WHERE household_id=? AND kind='profile' AND id='main' AND deleted=0").bind(householdId).first();
  return row?.data?JSON.parse(row.data):{};
}
async function who(db,user){return {user:{email:user.email},family:{id:user.household_id,name:user.family_name,role:user.role},profile:await profile(db,user.household_id)}}
async function guardLimit(db,kind,key,max,windowMs){
  const k=await digest(kind+':'+key),now=Date.now(),r=await db.prepare('SELECT attempts,window_started FROM auth_limits WHERE key=?').bind(k).first();
  if(!r||now-r.window_started>windowMs){await db.prepare('INSERT INTO auth_limits(key,attempts,window_started) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=1,window_started=excluded.window_started').bind(k,now).run();return true}
  if(r.attempts>=max)return false;
  await db.prepare('UPDATE auth_limits SET attempts=attempts+1 WHERE key=?').bind(k).run();return true;
}
async function validInvitation(db,token){if(!/^[0-9a-f]{64}$/.test(token||''))return null;
  return db.prepare('SELECT household_id,expires_at FROM invitations WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(await digest(token),Date.now()).first();}
async function acceptInvitation(db,token,userId){
  const hash=await digest(token),now=Date.now(),r=await db.prepare('UPDATE invitations SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(now,hash,now).run();
  if(!r.meta?.changes)throw Error('This invitation has expired or has already been used.');
  const invite=await db.prepare('SELECT household_id FROM invitations WHERE token_hash=?').bind(hash).first();
  await db.prepare("INSERT OR IGNORE INTO memberships(user_id,household_id,role) VALUES(?,?,'parent')").bind(userId,invite.household_id).run();
  return invite.household_id;
}
async function handleApi(request,env,url){
  if(!env.DB||!env.PASSWORD_PEPPER)return error('Server setup is incomplete. Ask the site administrator to configure DB and PASSWORD_PEPPER.',503);
  const db=env.DB,path=url.pathname,method=request.method;
  if(!['GET','POST'].includes(method))return error('Method not allowed',405);
  if(method==='POST'){
    // Cookie-authenticated writes must originate from THIS website; no cross-origin credential APIs.
    if(request.headers.get('Origin')!==url.origin)return error('Origin check failed.',403);
    if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return error('JSON required.',415);
  }
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  if(path==='/api/public/list'&&method==='GET'){
    const share=url.searchParams.get('share')||'';
    if(!/^[0-9a-f-]{36}$/i.test(share))return error('Invalid link.',404);
    const r=await db.prepare('SELECT data,household_id FROM public_lists WHERE share_id=?').bind(share).first();
    if(!r)return error('This family list is not available.',404);
    const claims=await db.prepare('SELECT gift_id,name FROM public_claims WHERE household_id=?').bind(r.household_id).all();
    return json({list:JSON.parse(r.data),claims:claims.results||[]});
  }
  if(path==='/api/public/claim'&&method==='POST'){
    if(!await guardLimit(db,'claim',ip,20,3600000))return error('Too many requests. Try again later.',429);
    const b=await bodyJSON(request),share=String(b.share||''),giftId=String(b.giftId||''),name=String(b.name||'').trim().slice(0,60);
    if(!name||!giftId||!share)return error('Choose a gift and enter your name.');
    const r=await db.prepare('SELECT data,household_id FROM public_lists WHERE share_id=?').bind(share).first();
    if(!r)return error('List not found.',404);
    const list=JSON.parse(r.data);
    if(!(list.ideas||[]).some(x=>x.id===giftId))return error('This gift is not available for claiming.',404);
    const result=await db.prepare('INSERT OR IGNORE INTO public_claims(household_id,gift_id,name,created_at) VALUES(?,?,?,?)').bind(r.household_id,giftId,name,Date.now()).run();
    if(!result.meta?.changes)return error('Someone has already claimed this gift.',409);
    return json({ok:true});
  }
  if(path==='/api/auth/register'&&method==='POST'){
    if(!await guardLimit(db,'registration',ip,5,3600000))return error('Too many registrations. Try later.',429);
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),inviteToken=String(b.invite||'');
    if(!emailOK(email)||password.length<12||password.length>128)return error('Use a valid email and a password of 12–128 characters.');
    const invitation=inviteToken?await validInvitation(db,inviteToken):null;
    if(inviteToken&&!invitation)return error('This invitation is invalid, expired, or already used.');
    const familyName=String(b.familyName||'Our North Pole').trim().slice(0,70)||'Our North Pole';
    const userId=id(),houseId=invitation?.household_id||id(),salt=hex(bytes(16)),now=Date.now();
    const passHash=await hashPassword(password,salt,env.PASSWORD_PEPPER);
    if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return error('This email is already registered. Sign in instead.',409);
    const calls=[db.prepare('INSERT INTO users(id,email,salt,password_hash,created_at) VALUES(?,?,?,?,?)').bind(userId,email,salt,passHash,now)];
    if(!invitation){
      calls.push(db.prepare('INSERT INTO households(id,name,created_at) VALUES(?,?,?)').bind(houseId,familyName,now));
      calls.push(db.prepare("INSERT INTO memberships(user_id,household_id,role) VALUES(?,?,'owner')").bind(userId,houseId));
      const p={familyName,child1:String(b.child1||'Child 1').trim().slice(0,50)||'Child 1',child2:String(b.child2||'Child 2').trim().slice(0,50)||'Child 2',budget1:Math.max(0,Number(b.budget1)||0),budget2:Math.max(0,Number(b.budget2)||0),traditions:[]};
      calls.push(db.prepare("INSERT INTO records(household_id,kind,id,data,deleted,updated_at) VALUES(?,'profile','main',?,0,?)").bind(houseId,JSON.stringify(p),now));
    } else calls.push(db.prepare("INSERT INTO memberships(user_id,household_id,role) VALUES(?,?,'parent')").bind(userId,houseId));
    try{await db.batch(calls)}catch(e){if(/UNIQUE/i.test(String(e)))return error('Account already exists.',409);throw e}
    if(invitation)await db.prepare('UPDATE invitations SET used_at=? WHERE token_hash=? AND used_at IS NULL').bind(now,await digest(inviteToken)).run();
    const token=await makeSession(db,userId,houseId);
    const newUser=await db.prepare(`SELECT s.token_hash,s.user_id,s.household_id,m.role,u.email,h.name AS family_name FROM sessions s JOIN memberships m ON m.user_id=s.user_id AND m.household_id=s.household_id JOIN users u ON u.id=s.user_id JOIN households h ON h.id=s.household_id WHERE s.token_hash=?`).bind(await digest(token)).first();
    return json({ok:true,...await who(db,newUser)},201,{'Set-Cookie':cookie(token)});
  }
  if(path==='/api/auth/login'&&method==='POST'){
    if(!await guardLimit(db,'login',ip,30,3600000))return error('Too many sign-in attempts. Try again later.',429);
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    const user=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if(!user||user.locked_until>Date.now())return error('Incorrect email or password, or temporarily locked.',401);
    const check=await hashPassword(password,user.salt,env.PASSWORD_PEPPER);
    if(!equal(check,user.password_hash)){
      const failures=user.failed_attempts+1;
      await db.prepare('UPDATE users SET failed_attempts=?,locked_until=? WHERE id=?').bind(failures,failures>=8?Date.now()+15*60000:0,user.id).run();
      return error('Incorrect email or password, or temporarily locked.',401);
    }
    await db.prepare('UPDATE users SET failed_attempts=0,locked_until=0 WHERE id=?').bind(user.id).run();
    const preferred=await db.prepare('SELECT household_id FROM memberships WHERE user_id=? ORDER BY role DESC LIMIT 1').bind(user.id).first();
    if(!preferred)return error('Account has no family.',403);
    const token=await makeSession(db,user.id,preferred.household_id);
    const cur=await session(new Request(url.origin,{headers:{Cookie:`__Host-santa_session=${token}`}}),db);
    return json({ok:true,...await who(db,cur)},200,{'Set-Cookie':cookie(token)});
  }
  const me=await session(request,db);
  if(path==='/api/auth/me'&&method==='GET')return me?json({authenticated:true,...await who(db,me)}):json({authenticated:false});
  if(!me)return error('Please sign in to your family.',401);
  const family=me.household_id;
  if(path==='/api/auth/logout'&&method==='POST'){
    await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(me.token_hash).run();
    return json({ok:true},200,{'Set-Cookie':expireCookie});
  }
  if(path==='/api/auth/invite'&&method==='POST'){
    if(me.role!=='owner')return error('Only a family owner can invite caregivers.',403);
    const token=hex(bytes(32)),hash=await digest(token);
    await db.prepare('INSERT INTO invitations(token_hash,household_id,invited_by,expires_at) VALUES(?,?,?,?)').bind(hash,family,me.user_id,Date.now()+INVITE_LIFE).run();
    return json({inviteUrl:`${url.origin}/?invite=${token}`,expiresInDays:7});
  }
  if(path==='/api/auth/accept'&&method==='POST'){
    const b=await bodyJSON(request),inv=await validInvitation(db,String(b.invite||''));
    if(!inv)return error('Invitation expired or already used.',410);
    const houseId=await acceptInvitation(db,String(b.invite),me.user_id);
    await db.prepare('UPDATE sessions SET household_id=? WHERE token_hash=?').bind(houseId,me.token_hash).run();
    const newUser=await session(request,db);
    return json({ok:true,...await who(db,newUser)});
  }
  if(path==='/api/private/state'&&method==='GET'){
    const rows=await db.prepare('SELECT kind,id,data,deleted,updated_at FROM records WHERE household_id=? ORDER BY updated_at').bind(family).all();
    return json({records:(rows.results||[]).map(r=>({...r,deleted:!!r.deleted,data:r.data?JSON.parse(r.data):null}))});
  }
  if(path==='/api/private/write'&&method==='POST'){
    const b=await bodyJSON(request),kind=String(b.kind||''),recordId=String(b.id||'');
    if(!['gift','mail','profile'].includes(kind)||!recordId||recordId.length>160)return error('Invalid record.');
    if(kind==='profile'&&recordId!=='main')return error('Invalid profile.');
    if(!b.deleted&&(!b.data||typeof b.data!=='object'||Array.isArray(b.data)))return error('Invalid data.');
    if(kind==='profile'&&b.deleted)return error('Cannot delete family settings.');
    const payload=b.deleted?null:JSON.stringify(b.data);
    if(payload&&payload.length>740000)return error('This photo or voice message is too large.');
    await db.prepare(`INSERT INTO records(household_id,kind,id,data,deleted,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(household_id,kind,id) DO UPDATE SET data=excluded.data,deleted=excluded.deleted,updated_at=excluded.updated_at`)
      .bind(family,kind,recordId,payload,b.deleted?1:0,Date.now()).run();
    if(kind==='profile'&&!b.deleted){const nm=String(b.data.familyName||'').trim().slice(0,70);if(nm)await db.prepare('UPDATE households SET name=? WHERE id=?').bind(nm,family).run();}
    return json({ok:true});
  }
  if(path==='/api/family/list'&&method==='GET'){
    const row=await db.prepare('SELECT share_id,data FROM public_lists WHERE household_id=?').bind(family).first();
    const claims=await db.prepare('SELECT gift_id,name FROM public_claims WHERE household_id=?').bind(family).all();
    return json({shareId:row?.share_id||null,list:row?JSON.parse(row.data):null,claims:claims.results||[]});
  }
  if(path==='/api/family/publish'&&method==='POST'){
    const b=await bodyJSON(request),ideas=Array.isArray(b.ideas)?b.ideas:[],bag=Array.isArray(b.bag)?b.bag:[];
    if(ideas.length+bag.length>250)return error('Too many gifts.');
    const current=await db.prepare("SELECT id,data FROM records WHERE household_id=? AND kind='gift' AND deleted=0").bind(family).all();
    const gifts=new Map((current.results||[]).map(r=>[r.id,JSON.parse(r.data)]));
    const make=(ids)=>Array.from(new Set(ids.filter(x=>typeof x==='string'))).map(x=>gifts.get(x)).filter(Boolean).map(g=>({id:String(g.id).slice(0,160),name:String(g.name||'Gift').slice(0,160),recipient:['1','2','both'].includes(g.kid)?g.kid:'unassigned'}));
    const p=await profile(db,family);
    const data={familyName:String(p.familyName||'A Santa HQ family').slice(0,70),child1:String(p.child1||'Child 1').slice(0,50),child2:String(p.child2||'Child 2').slice(0,50),ideas:make(ideas),bag:make(bag),updatedAt:new Date().toISOString()};
    const existing=await db.prepare('SELECT share_id FROM public_lists WHERE household_id=?').bind(family).first();
    const shareId=existing?.share_id||id();
    await db.prepare(`INSERT INTO public_lists(household_id,share_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(household_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`).bind(family,shareId,JSON.stringify(data),Date.now()).run();
    return json({ok:true,shareId,list:data});
  }
  if(path==='/api/family/release'&&method==='POST'){
    const b=await bodyJSON(request);
    await db.prepare('DELETE FROM public_claims WHERE household_id=? AND gift_id=?').bind(family,String(b.giftId||'')).run();return json({ok:true});
  }
  return error('Not found.',404);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      try{return await handleApi(request,env,url)}catch(e){console.error('Santa HQ API:',e);if(e instanceof SyntaxError)return error('Invalid JSON.',400);if(['Request is too large.','Invalid request body.'].includes(e?.message))return error(e.message,400);return error('An unexpected server error occurred.',500)}
    }
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
