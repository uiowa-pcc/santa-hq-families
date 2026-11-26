/** Santa HQ — shared website, private household accounts. Deploy with wrangler.json and a NEW D1. */
const MAX_BODY=850000;
const MAX_PRIVATE_MEDIA=15*1024*1024;
const MEDIA_MIMES=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']);
const SESSION_LIFE=14*86400*1000;
const INVITE_LIFE=7*86400*1000;
const VERIFY_LIFE=24*3600*1000;
const RESET_LIFE=45*60*1000;
// Cloudflare Workers WebCrypto caps PBKDF2 at 100,000 iterations.
// Keep this at or below 100,000 for both registration and sign-in.
const PBKDF2_ITERATIONS=100000;
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

const emailReady=env=>!!(env.EMAIL && typeof env.EMAIL.send==='function' && env.EMAIL_FROM && emailOK(env.EMAIL_FROM));
const validPass=p=>typeof p==='string' && p.length>=12 && p.length<=128;
const safeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function sendAccountEmail(env,to,subject,plain,link){
  if(!emailReady(env))throw Error('Account email is not configured.');
  const html=`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>Santa HQ</h2><p>${safeHTML(plain)}</p><p><a href="${safeHTML(link)}">Open Santa HQ</a></p><p style="font-size:12px">If you did not request this message, you can ignore it.</p></div>`;
  await env.EMAIL.send({from:String(env.EMAIL_FROM),to,subject,text:`${plain}\n\n${link}\n\nIf you did not request this, you can ignore it.`,html});
}
async function startToken(db,userId,purpose,lifetime){
  const token=hex(bytes(32)),now=Date.now();
  await db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').bind(userId,purpose).run();
  await db.prepare('INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').bind(await digest(token),userId,purpose,now+lifetime).run();
  return token;
}
function recoveryDigest(email,code,pepper){return digest('recovery|'+email+'|'+code.toLowerCase().replace(/[^0-9a-f]/g,'')+'|'+pepper)}
async function changePassword(db,userId,password,pepper){
  const salt=hex(bytes(16)),hash=await hashPassword(password,salt,pepper);
  await db.batch([
    db.prepare('UPDATE users SET salt=?,password_hash=?,failed_attempts=0,locked_until=0,recovery_hash=NULL WHERE id=?').bind(salt,hash,userId),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(userId)
  ]);
}
async function sendVerification(db,env,url,user){
  const token=await startToken(db,user.id,'verify',VERIFY_LIFE);
  await sendAccountEmail(env,user.email,'Verify your Santa HQ email','Confirm your email address to finish setting up your Santa HQ account.',url.origin+'/?verify='+token);
}

function validateBody(body){if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid request body.');return body}
async function bodyJSON(request){const size=Number(request.headers.get('content-length')||0);if(size>MAX_BODY)throw Error('Request is too large.');const text=await request.text();if(text.length>MAX_BODY)throw Error('Request is too large.');return validateBody(JSON.parse(text))}
async function session(request,db){
  const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-santa_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token)return null;
  const tokenHash=await digest(token),now=Date.now();
  return db.prepare(`SELECT s.token_hash,s.user_id,s.household_id,m.role,u.email,u.email_verified_at,u.verification_required,h.name AS family_name
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
async function who(db,user){return {user:{email:user.email,emailVerified:!!user.email_verified_at,verificationRequired:!!user.verification_required},family:{id:user.household_id,name:user.family_name,role:user.role},profile:await profile(db,user.household_id)}}
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
// Retailer price checks are optional and authenticated. Never fetch arbitrary gift URLs.
// Amazon uses DataForSEO when configured. Keepa remains available for existing price checks.
// Quotes are returned to the client; they do NOT modify gift budgets or place orders.
function detectPriceProduct(link){
  let u;try{u=new URL(String(link||''))}catch{return null}
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname.toLowerCase();
  if(amazonHosts.has(host)){
    const asin=u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]||u.searchParams.get('asin');
    return asin&&/^[A-Z0-9]{10}$/i.test(asin)?{store:'Amazon',id:asin.toUpperCase()}:null;
  }
  if(host==='bestbuy.com'||host==='www.bestbuy.com'){
    const sku=u.pathname.match(/\/(\d{6,9})\.p(?:\/|$)/)?.[1]||u.searchParams.get('skuId');
    return sku&&/^\d{6,9}$/.test(sku)?{store:'Best Buy',id:sku}:null;
  }
  return null;
}
const amazonHosts=new Set(['amazon.com','www.amazon.com','smile.amazon.com','m.amazon.com']);
const amazonShortHosts=new Set(['a.co','amzn.to','www.amzn.to']);
const dataForSeoReady=env=>Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);

async function resolveAmazonProduct(link,requestFetch=fetch){
  let url;
  try{url=new URL(String(link||'').trim())}catch{return null}
  for(let hop=0;hop<6;hop++){
    if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    const host=url.hostname;
    if(!amazonHosts.has(host)&&!amazonShortHosts.has(host))return null;
    const product=detectPriceProduct(url.href);
    if(product?.store==='Amazon')return product;
    // Only short links and Amazon's own short-link redirect route need expansion.
    if(!amazonShortHosts.has(host)&&!url.pathname.startsWith('/gp/r.html'))return null;
    const res=await requestFetch(url.href,{redirect:'manual',signal:AbortSignal.timeout(3500)});
    const location=res.headers.get('Location');
    await res.body?.cancel();
    if(![301,302,303,307,308].includes(res.status)||!location)return null;
    try{url=new URL(location,url)}catch{return null}
  }
  return null;
}

function amazonOffer(item){
  const condition=String(item?.condition||'').trim();
  const price=item?.price;
  return (!condition||/^new$/i.test(condition))&&price?.currency==='USD'&&
    price.is_price_range!==true&&Number.isFinite(price.current)&&price.current>0;
}

async function fetchAmazonListing(product,env,requestFetch=fetch){
  if(!dataForSeoReady(env))return {error:'Amazon lookup needs DataForSEO credentials in Cloudflare.',status:503};
  try{
    const res=await requestFetch('https://api.dataforseo.com/v3/merchant/amazon/sellers/live/advanced',{
      method:'POST',
      headers:{Authorization:'Basic '+btoa(env.DATAFORSEO_LOGIN+':'+env.DATAFORSEO_PASSWORD),'Content-Type':'application/json'},
      body:JSON.stringify([{language_code:'en_US',location_code:2840,asin:product.id}]),
      signal:AbortSignal.timeout(65000)
    });
    const data=await res.json();
    const task=data.tasks?.[0];
    if(!res.ok||data.status_code!==20000||task?.status_code!==20000){
      return {error:'Amazon lookup is unavailable. Check the DataForSEO credentials and balance, or try again shortly.',status:502};
    }
    const listing=task.result?.find(item=>item.asin===product.id&&item.se_domain==='amazon.com');
    if(!listing)return {error:'No Amazon listing was returned for this item.',status:422};
    const main=listing.items?.find(item=>item.type==='amazon_seller_main_item'&&amazonOffer(item));
    const offers=(listing.items||[]).filter(item=>item.type==='amazon_seller_item'&&amazonOffer(item));
    const price=main?.price.current??(offers.length?Math.min(...offers.map(item=>item.price.current)):null);
    return {
      link:'https://www.amazon.com/dp/'+product.id,
      title:String(listing.title||'').trim().slice(0,160),
      image:typeof listing.image==='string'&&listing.image.startsWith('https://')?listing.image:'',
      price,currency:'USD',store:'Amazon',checkedAt:new Date().toISOString(),
      source:main?'Amazon listed offer · DataForSEO':'Amazon seller offer · DataForSEO'
    };
  }catch{
    return {error:'Could not reach the Amazon lookup service. Try again shortly.',status:502};
  }
}

async function checkAmazonLookupLimit(db,family){
  if(!await guardLimit(db,'amazon-lookup',family,40,3600000))return false;
  // One atomic, shared cap also bounds charges when multiple families use the app at once.
  const now=Date.now(),floor=now-86400000;
  const result=await db.prepare(`INSERT INTO auth_limits(key,attempts,window_started) VALUES('amazon-lookup-global',1,?)
    ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN window_started<=? THEN 1 ELSE attempts+1 END,
      window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END
    WHERE window_started<=? OR attempts<100`).bind(now,floor,floor,floor).run();
  return Boolean(result.meta?.changes);
}

async function fetchPriceQuote(product,env,requestFetch=fetch){
  if(!product)return {error:'Automatic refresh is not available for this retailer or link. Open the store to check its price.',status:422};
  const now=new Date().toISOString();
  if(product.store==='Amazon'){
    if(dataForSeoReady(env)){
      const listing=await fetchAmazonListing(product,env,requestFetch);
      return !listing.error&&listing.price===null?{error:'No available Amazon price was returned for this item.',status:422}:listing;
    }
    if(!env.KEEPA_API_KEY)return {error:'Amazon refresh needs a Keepa API key set by the Santa HQ owner. Use View at store meanwhile.',status:503};
    const u=new URL('https://api.keepa.com/product');u.searchParams.set('key',env.KEEPA_API_KEY);u.searchParams.set('domain','1');u.searchParams.set('asin',product.id);u.searchParams.set('stats','1');u.searchParams.set('history','0');
    const res=await requestFetch(u.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!res.ok)return {error:res.status===429?'Amazon price source is rate-limited; try again later.':'Amazon price source is temporarily unavailable.',status:502};
    const data=await res.json();
    if(data.error)return {error:'Amazon price source could not complete the lookup.',status:502};
    const stats=data.products?.find(p=>String(p.asin||'').toUpperCase()===product.id)?.stats;
    const current=stats?.current;
    if(!Array.isArray(current))return {error:'No recent Amazon price was returned. Open the store to check.',status:422};
    // Keepa price-type indexes: 0=Amazon, 1=marketplace NEW. -1 means no offer.
    const amazon=Number(current[0]),newOffer=Number(current[1]);
    const amount=Number.isFinite(amazon)&&amazon>0?amazon:Number.isFinite(newOffer)&&newOffer>0?newOffer:null;
    if(amount===null)return {error:'No available new-item price was returned for this product.',status:422};
    const source=Number.isFinite(amazon)&&amazon>0?'Keepa · Amazon offer':'Keepa · marketplace new offer';
    return {price:amount/100,currency:'USD',checkedAt:now,source,note:'Keepa prices may be delayed and exclude shipping or taxes.'};
  }
  if(product.store==='Best Buy'){
    if(!env.BEST_BUY_API_KEY)return {error:'Best Buy refresh needs a Best Buy developer API key set by the Santa HQ owner.',status:503};
    const u=new URL(`https://api.bestbuy.com/v1/products(sku=${product.id})`);
    u.searchParams.set('format','json');u.searchParams.set('show','sku,name,salePrice,onlineAvailability');u.searchParams.set('apiKey',env.BEST_BUY_API_KEY);
    const res=await requestFetch(u.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!res.ok)return {error:'Best Buy price source is temporarily unavailable.',status:502};
    const data=await res.json(),item=data.products?.find(p=>String(p.sku)===product.id);
    const price=Number(item?.salePrice);
    if(!item||!Number.isFinite(price)||price<=0)return {error:'No current Best Buy price was returned for this product.',status:422};
    return {price,currency:'USD',checkedAt:now,source:'Best Buy Products API',note:'Price may vary by location, membership, or promotion.'};
  }
  return {error:'This store is not supported for price refresh.',status:422};
}
export { detectPriceProduct,resolveAmazonProduct,fetchAmazonListing,fetchPriceQuote };

// December Mega photo capacity: run only for a photo-enabled Mega or an extended photo upload.
// D1 batch is transactional. No changes to other tables or R2 objects.
async function ensureDecemberPhotoCapacity(db){
  const normalize=s=>String(s||'').toLowerCase().replace(/if\s+not\s+exists/g,'').replace(/[\s"`\[\];]/g,'');
  const original=await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='hunt_photos'").first();
  const current=normalize(original?.sql);
  const oldSchema=normalize("CREATE TABLE hunt_photos (\n id TEXT PRIMARY KEY,\n hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,\n player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,\n clue_index INTEGER NOT NULL CHECK(clue_index BETWEEN 0 AND 29),\n object_key TEXT NOT NULL,\n shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),\n created_at INTEGER NOT NULL,\n UNIQUE(hunt_id,player_id,clue_index)\n)");
  const newSchema=normalize("CREATE TABLE hunt_photos (\n id TEXT PRIMARY KEY,\n hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,\n player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,\n clue_index INTEGER NOT NULL CHECK(clue_index BETWEEN 0 AND 124),\n object_key TEXT NOT NULL,\n shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),\n created_at INTEGER NOT NULL,\n UNIQUE(hunt_id,player_id,clue_index)\n)");
  if(current===newSchema)return true;
  if(current!==oldSchema)throw Error('Unexpected hunt_photos schema; automatic upgrade stopped.');
  const schema=await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name<>'hunt_photos'").all();
  const allowed=new Set(['hunt_photos_feed_idx','hunt_photos_player_idx']);
  for(const row of schema.results||[]){
    if(row.tbl_name==='hunt_photos'&&!allowed.has(row.name))throw Error('Unexpected photo table dependency; automatic upgrade stopped.');
    if(row.tbl_name!=='hunt_photos'&&/\bhunt_photos\b/i.test(row.sql||''))throw Error('Unexpected photo table reference; automatic upgrade stopped.');
    if(row.name==='hunt_photos_december_new')throw Error('A previous photo migration needs review.');
  }
  await db.batch([
  "CREATE TABLE hunt_photos_december_new (\n id TEXT PRIMARY KEY,\n hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,\n player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,\n clue_index INTEGER NOT NULL CHECK(clue_index BETWEEN 0 AND 124),\n object_key TEXT NOT NULL,\n shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),\n created_at INTEGER NOT NULL,\n UNIQUE(hunt_id,player_id,clue_index)\n)",
  "INSERT INTO hunt_photos_december_new(id,hunt_id,player_id,clue_index,object_key,shared,created_at)\n SELECT id,hunt_id,player_id,clue_index,object_key,shared,created_at FROM hunt_photos",
  "DROP TABLE hunt_photos",
  "ALTER TABLE hunt_photos_december_new RENAME TO hunt_photos",
  "CREATE INDEX hunt_photos_feed_idx ON hunt_photos(hunt_id,shared,created_at DESC)",
  "CREATE INDEX hunt_photos_player_idx ON hunt_photos(hunt_id,player_id)"
].map(statement=>db.prepare(statement)));
  const result=await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='hunt_photos'").first();
  if(normalize(result?.sql)!==newSchema)throw Error('Photo capacity verification failed.');
  return true;
}

// Repair incomplete installations of the additive Hunt HQ migration.
// Never drop or replace a table; existing hunts, finds and photos stay intact.
async function ensureHuntHQTables(db){
  const expected=['hunt_nights','hunt_night_progress','hunt_direct_progress','hunt_night_photos'];
  const result=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hunt_nights','hunt_night_progress','hunt_direct_progress','hunt_night_photos')").all();
  const names=new Set((result.results||[]).map(row=>row.name));
  if(expected.every(name=>names.has(name)))return;
  await db.batch([
    "CREATE TABLE IF NOT EXISTS hunt_nights (\n id TEXT PRIMARY KEY,\n hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,\n theme TEXT NOT NULL,\n title TEXT NOT NULL,\n clues_json TEXT NOT NULL,\n created_at INTEGER NOT NULL\n)",
    "CREATE INDEX IF NOT EXISTS hunt_nights_parent_idx ON hunt_nights(hunt_id,created_at)",
    "CREATE TABLE IF NOT EXISTS hunt_night_progress (\n night_id TEXT NOT NULL REFERENCES hunt_nights(id) ON DELETE CASCADE,\n player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,\n found_json TEXT NOT NULL DEFAULT '[]',\n updated_at INTEGER NOT NULL,\n PRIMARY KEY(night_id,player_id)\n)",
    "CREATE TABLE IF NOT EXISTS hunt_direct_progress (\n player_id TEXT PRIMARY KEY REFERENCES hunt_players(id) ON DELETE CASCADE,\n found_json TEXT NOT NULL DEFAULT '[]',\n updated_at INTEGER NOT NULL\n)",
    "CREATE TABLE IF NOT EXISTS hunt_night_photos (\n id TEXT PRIMARY KEY,\n hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,\n night_id TEXT NOT NULL REFERENCES hunt_nights(id) ON DELETE CASCADE,\n player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,\n clue_index INTEGER NOT NULL,\n object_key TEXT NOT NULL,\n shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),\n created_at INTEGER NOT NULL,\n UNIQUE(night_id,player_id,clue_index)\n)",
    "CREATE INDEX IF NOT EXISTS hunt_night_photo_feed_idx ON hunt_night_photos(hunt_id,shared,created_at DESC)"
  ].map(sql=>db.prepare(sql)));
}

async function handleApi(request,env,url){
  if(!env.DB||!env.PASSWORD_PEPPER)return error('Server setup is incomplete. Ask the site administrator to configure DB and PASSWORD_PEPPER.',503);
  const db=env.DB,path=url.pathname,method=request.method;
  if(!['GET','POST'].includes(method))return error('Method not allowed',405);
  if(method==='POST'){
    // Cookie-authenticated writes must originate from THIS website; no cross-origin credential APIs.
    if(request.headers.get('Origin')!==url.origin)return error('Origin check failed.',403);
    if(path!=='/api/private/media'&&!/^\/api\/hunts\/[a-f0-9]{32}\/photos\/upload$/.test(path)&&!(request.headers.get('Content-Type')||'').startsWith('application/json'))return error('JSON required.',415);
  }
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  if(path==='/api/auth/capabilities'&&method==='GET')return json({emailEnabled:emailReady(env),recoveryCodes:true});
  if(path==='/api/auth/verify'&&method==='POST'){
    const b=await bodyJSON(request),token=String(b.token||'');
    if(!/^[0-9a-f]{64}$/.test(token))return error('Verification link invalid or expired.',400);
    const hash=await digest(token),row=await db.prepare("SELECT user_id FROM account_tokens WHERE token_hash=? AND purpose='verify' AND used_at IS NULL AND expires_at>?").bind(hash,Date.now()).first();
    if(!row)return error('Verification link invalid or expired.',400);
    await db.batch([db.prepare('UPDATE users SET email_verified_at=?,verification_required=0 WHERE id=?').bind(Date.now(),row.user_id),db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(row.user_id)]);
    return json({ok:true});
  }
  if(path==='/api/auth/verify-request'&&method==='POST'){
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase();
    if(!emailOK(email))return error('Enter a valid email address.');
    if(!await guardLimit(db,'verify-request',ip+':'+email,4,3600000))return error('Too many requests. Try again later.',429);
    if(emailReady(env)){
      const user=await db.prepare('SELECT id,email,email_verified_at FROM users WHERE email=?').bind(email).first();
      if(user&&!user.email_verified_at)try{await sendVerification(db,env,url,user)}catch(e){console.error('Santa HQ verification email:',e)}
    }
    return json({ok:true,message:'If an unverified account exists and email delivery is active, a verification link is on its way.'});
  }
  if(path==='/api/auth/forgot'&&method==='POST'){
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase();
    if(!emailOK(email))return error('Enter a valid email address.');
    if(!await guardLimit(db,'forgot',ip+':'+email,4,3600000))return error('Too many requests. Try again later.',429);
    if(emailReady(env)){
      const user=await db.prepare('SELECT id,email FROM users WHERE email=?').bind(email).first();
      if(user)try{
        const token=await startToken(db,user.id,'reset',RESET_LIFE);
        await sendAccountEmail(env,user.email,'Reset your Santa HQ password','Someone requested a password reset for your Santa HQ account. This link expires in 45 minutes.',url.origin+'/?reset='+token);
      }catch(e){console.error('Santa HQ reset email:',e)}
    }
    return json({ok:true,message:'If this account exists and email delivery is active, you will receive a password reset link.'});
  }
  if(path==='/api/auth/reset'&&method==='POST'){
    if(!await guardLimit(db,'reset',ip,12,3600000))return error('Too many requests. Try again later.',429);
    const b=await bodyJSON(request),token=String(b.token||''),password=String(b.password||'');
    if(!/^[0-9a-f]{64}$/.test(token)||!validPass(password))return error('Use a valid reset link and a password of at least 12 characters.');
    const row=await db.prepare("SELECT user_id FROM account_tokens WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>?").bind(await digest(token),Date.now()).first();
    if(!row)return error('This reset link is invalid or expired.',400);
    await changePassword(db,row.user_id,password,env.PASSWORD_PEPPER);
    return json({ok:true,message:'Your password has been changed. Sign in with your new password.'});
  }
  if(path==='/api/auth/recovery/reset'&&method==='POST'){
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase(),code=String(b.code||''),password=String(b.password||'');
    if(!emailOK(email)||!validPass(password)||!/^([0-9a-f]{4}-?){8}$/i.test(code))return error('Enter your account email, complete recovery code, and a new password of at least 12 characters.');
    if(!await guardLimit(db,'recovery-reset',ip+':'+email,8,3600000))return error('Too many attempts. Try again later.',429);
    const user=await db.prepare('SELECT id,recovery_hash FROM users WHERE email=?').bind(email).first();
    const attempt=await recoveryDigest(email,code,env.PASSWORD_PEPPER);
    if(!user?.recovery_hash||!equal(attempt,user.recovery_hash))return error('Recovery code is invalid or already used.',400);
    await changePassword(db,user.id,password,env.PASSWORD_PEPPER);
    return json({ok:true,message:'Password updated. Your recovery code has been used. Sign in and create a new one.'});
  }

  if(path==='/api/public/list'&&method==='GET'){
    const share=url.searchParams.get('share')||'';
    if(!/^[0-9a-f-]{36}$/i.test(share))return error('Invalid link.',404);
    const r=await db.prepare('SELECT data,household_id FROM public_lists WHERE share_id=?').bind(share).first();
    if(!r)return error('This family list is not available.',404);
    const claims=await db.prepare('SELECT gift_id,name FROM public_claims WHERE household_id=?').bind(r.household_id).all();
    const list=JSON.parse(r.data);for(const key of ['ideas','bag'])if(Array.isArray(list[key]))list[key]=list[key].map(({category,...gift})=>gift);
    return json({list,claims:claims.results||[]});
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
  // The installed D1 schema restricts mode to easy/family. A versioned seed marks
  // 30-clue mega hunts without changing that CHECK constraint or migrating old data.

// December Mega v3: stable 125-clue catalogue, any 100 earns completion.
const DEC_BASE = ["Christmas tree","Glowing star","Candy cane","Santa Claus","Snowman","Reindeer","Holiday wreath","Big light-up gift","Christmas elf","Icicle lights","Colorful roof","Gingerbread person","Penguin","Glowing snowflake","Santa sleigh","Pink or purple lights","Giant inflatable","Giant ornament","Nativity scene","Light-up mailbox","","","","","","Music-synced lights","Holiday projector","Chasing light pattern","Light tunnel or arch","Lights spelling a word"];
const DEC_CATS = ["Christmas decorations","Christmas decorations","Christmas decorations","Characters","Characters","Animals & creatures","Christmas decorations","Christmas decorations","Characters","Colors & styles","Holiday scenes","Characters","Animals & creatures","Christmas decorations","Holiday scenes","Colors & styles","Holiday scenes","Christmas decorations","Holiday scenes","Holiday scenes","Characters","Characters","Characters","Characters","Characters","Words, music & effects","Words, music & effects","Words, music & effects","Words, music & effects","Words, music & effects"];
const DEC_EXTRA = [["Minnie Mouse","Characters",1],["Donald Duck","Characters",1],["Goofy","Characters",1],["Pluto","Characters",1],["Stitch","Characters",1],["Bluey","Characters",1],["Bingo (Bluey)","Characters",1],["Hello Kitty","Characters",1],["Charlie Brown","Characters",2],["Woodstock","Characters",2],["Sally Brown","Characters",2],["Max (The Grinch)","Characters",2],["Cindy Lou Who","Characters",2],["Elsa","Characters",2],["Anna","Characters",2],["Jack Skellington","Characters",2],["Grogu (Baby Yoda)","Characters",2],["Minion","Characters",2],["The Nutcracker","Characters",2],["Mrs. Claus","Characters",2],["Buddy the Elf","Characters",2],["The Abominable Snow Monster","Characters",2],["Tigger","Characters",3],["Eeyore","Characters",3],["Scooby-Doo","Characters",3],["Rudolph","Animals & creatures",0],["Polar bear","Animals & creatures",0],["Fox","Animals & creatures",0],["Owl","Animals & creatures",0],["Cardinal","Animals & creatures",0],["Squirrel","Animals & creatures",0],["Rabbit","Animals & creatures",1],["Dog in a Santa hat","Animals & creatures",1],["Cat in a Santa hat","Animals & creatures",1],["Dinosaur","Animals & creatures",1],["Unicorn","Animals & creatures",1],["Dragon","Animals & creatures",2],["Giraffe","Animals & creatures",2],["Elephant","Animals & creatures",2],["Flamingo","Animals & creatures",3],["Christmas stocking","Christmas decorations",0],["Giant bow","Christmas decorations",0],["Light-up bell","Christmas decorations",0],["Holly leaves","Christmas decorations",0],["Mistletoe","Christmas decorations",0],["Christmas candle","Christmas decorations",0],["Light-up lantern","Christmas decorations",0],["Christmas drum","Christmas decorations",1],["Toy soldier","Christmas decorations",1],["Candy cane pathway","Christmas decorations",1],["Gingerbread house","Christmas decorations",1],["Peppermint swirl","Christmas decorations",1],["Light-up lollipop","Christmas decorations",1],["Christmas angel","Christmas decorations",1],["Christmas crown","Christmas decorations",1],["Light-up candy cottage","Christmas decorations",2],["Christmas ball cluster","Christmas decorations",2],["Lighted garland","Christmas decorations",2],["Light-up gift stack","Christmas decorations",2],["Light-up snow globe","Christmas decorations",3],["Red lights","Colors & styles",0],["Green lights","Colors & styles",0],["Blue lights","Colors & styles",0],["White lights","Colors & styles",0],["Purple lights","Colors & styles",0],["Pink lights","Colors & styles",0],["Yellow lights","Colors & styles",0],["Two colors together","Colors & styles",0],["Rainbow lights","Colors & styles",1],["Twinkling lights","Colors & styles",1],["Tree in a window","Holiday scenes",0],["Lighted front door","Holiday scenes",0],["Glowing bush","Holiday scenes",0],["Wrapped tree trunk","Holiday scenes",0],["Decorated porch","Holiday scenes",0],["Lighted fence","Holiday scenes",0],["Lighted driveway","Holiday scenes",1],["Lights on a balcony","Holiday scenes",1],["Santa on a roof","Holiday scenes",1],["Reindeer pulling a sleigh","Holiday scenes",1],["Christmas train","Holiday scenes",1],["Santa workshop","Holiday scenes",2],["North Pole sign","Holiday scenes",2],["Christmas village","Holiday scenes",2],["Lighted bridge","Holiday scenes",3],["JOY in lights","Words, music & effects",0],["NOEL in lights","Words, music & effects",0],["Merry Christmas in lights","Words, music & effects",0],["Happy Holidays in lights","Words, music & effects",0],["Lights in a spiral","Words, music & effects",1],["Color-changing lights","Words, music & effects",1],["Dancing light tree","Words, music & effects",1],["Laser light dots","Words, music & effects",1],["Animated Santa waving","Words, music & effects",2],["Singing Christmas display","Words, music & effects",2]];
const DEC_TIERS = ["common","common","common","common","common","common","common","common","common","common","common","common","common","common","common","common","common","common","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","rare","uncommon","uncommon","uncommon","uncommon","common","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","rare","rare","rare","rare","rare","rare","rare","rare","rare","rare","rare","rare","legendary","legendary","legendary","common","common","common","common","common","common","uncommon","uncommon","uncommon","uncommon","uncommon","rare","rare","rare","legendary","common","common","common","common","common","common","common","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","uncommon","rare","rare","rare","rare","legendary","common","common","common","common","common","common","common","common","uncommon","uncommon","common","common","common","common","common","common","uncommon","uncommon","uncommon","uncommon","uncommon","rare","rare","rare","legendary","common","common","common","common","uncommon","uncommon","uncommon","uncommon","rare","rare"];
const DEC_RESERVE = ["Piglet","Rapunzel","SpongeBob SquarePants","Kermit the Frog","Pikachu","Mario","Yoshi","Peppa Pig","Elmo","Chase (PAW Patrol)"];
const decSlug = s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const isDecemberMega = seed=>/^mega-v[34]-/.test(String(seed||''));
const isUniqueMega = seed=>String(seed||'').startsWith('mega-v4-');
const DEC_REPLACEMENTS = {"Pink or purple lights": "Orange lights", "Lights spelling a word": "PEACE in lights", "Toy soldier": "Light-up rocking horse", "Light-up candy cottage": "Lighted bicycle"};
const DEC_UNIQUE_HINTS = {"Orange lights": "Find a display glowing orange.", "PEACE in lights": "Find the word PEACE spelled with lights.", "Light-up rocking horse": "Spot an illuminated rocking horse decoration.", "Lighted bicycle": "Find a bicycle decorated with holiday lights.", "Two colors together": "Find a display using exactly two colors, not three or more.", "Rainbow lights": "Find a display with at least three different colors.", "Giant ornament": "Find one oversized glowing ornament, not an ornament cluster.", "Christmas ball cluster": "Find a group of ornaments displayed together.", "Big light-up gift": "Find a single illuminated wrapped present.", "Light-up gift stack": "Find several illuminated presents stacked together.", "Candy cane": "Find a single candy cane decoration.", "Candy cane pathway": "Find multiple candy canes lining a path.", "Snowman": "Find a generic snowman, not a named character.", "Reindeer": "Find an ordinary reindeer without a red nose.", "Santa sleigh": "Find a sleigh displayed without a team of reindeer.", "Reindeer pulling a sleigh": "Find reindeer attached to a sleigh.", "Holiday projector": "Find projected holiday pictures or shapes, rather than just laser dots.", "Laser light dots": "Find a pattern of tiny projected light dots, not pictures.", "Music-synced lights": "Find lights timed to a song.", "Singing Christmas display": "Find a decoration that appears to sing, with a moving mouth or singing figure.", "Dancing light tree": "Find a tree-shaped display with animated patterns.", "Chasing light pattern": "Find lights that travel in sequence.", "Color-changing lights": "Find bulbs changing their colors over time.", "Twinkling lights": "Find lights that sparkle independently, rather than chasing in sequence.", "Light-up lollipop": "Find a candy decoration on a stick.", "Peppermint swirl": "Find a round peppermint decoration without a stick."};
function decemberCards(characters=[],seed=''){
 const unique=isUniqueMega(seed);
 const defaults=['Mickey Mouse','Winnie-the-Pooh','The Grinch','Snoopy','Olaf'];
 const names=DEC_BASE.map((name,i)=>i>=20&&i<=24?(characters[i-20]||defaults[i-20]):(unique?(DEC_REPLACEMENTS[name]||name):name));
 const used=new Set(names.map(decSlug));
 const cards=names.map((name,i)=>({name,category:DEC_CATS[i],tier:DEC_TIERS[i]}));
 for(const [original,category] of DEC_EXTRA){
  let name=unique?(DEC_REPLACEMENTS[original]||original):original;if(used.has(decSlug(name)))name=DEC_RESERVE.find(n=>!used.has(decSlug(n))&&!DEC_EXTRA.some(x=>decSlug(x[0])===decSlug(n)));
  if(!name)throw Error('December clue reserve exhausted');
  used.add(decSlug(name));cards.push({name,category:unique&&name!==original&&!DEC_REPLACEMENTS[original]?'Characters':category,tier:DEC_TIERS[cards.length]});
 }
 if(unique)for(const card of cards)if(DEC_UNIQUE_HINTS[card.name])card.hint=DEC_UNIQUE_HINTS[card.name];
 return cards;
}

  const publicHuntMode = room => String(room.seed||'').startsWith('mega-v')?'mega':room.mode;
  const collectionFor=async huntId=>await db.prepare('SELECT title,kind,theme,play_mode,clues_json,archived_at FROM hunt_collections WHERE hunt_id=?').bind(huntId).first();
  const publicMode=(room,collection)=>collection?.kind==='standalone'?'standalone':publicHuntMode(room);
  // Reuse the existing expiry column; a sentinel means the host will end it manually.
  const NO_MEGA_DEADLINE=253402300799999;
  const megaEnded=(room,now=Date.now())=>publicHuntMode(room)==='mega'&&room.expires_at<=now;
  const megaEndAt=room=>publicHuntMode(room)==='mega'&&room.expires_at<NO_MEGA_DEADLINE?room.expires_at:null;
  const validMegaDeadline=(value,now)=>value===null||value===''?NO_MEGA_DEADLINE:Number.isSafeInteger(value)&&value>now&&value<NO_MEGA_DEADLINE?value:null;
  const allowChanges=(room,collection,now)=>room.expires_at>now&&!collection?.archived_at;
  const huntOptions = room => {
    const seed=String(room.seed||''),photoMode=seed.startsWith('photo-v1-');
    if(!seed.startsWith('mega-v2-')&&!isDecemberMega(seed))return {photoMode,characters:[]};
    try{
      const payload=JSON.parse(decodeURIComponent(seed.split('~')[1]||''));
      const characters=Array.isArray(payload.characters)?payload.characters:[];
      return {photoMode:payload.photoMode===true,characters:characters.length===5?characters:[],goal:isDecemberMega(seed)?100:30,clueCount:isDecemberMega(seed)?125:30};
    }catch{return {photoMode:false,characters:[]}}
  };
  const huntPublic=(room,collection)=>({id:room.id,mode:publicMode(room,collection),seed:room.seed,expiresAt:room.expires_at,title:collection?.title|| (publicHuntMode(room)==='mega'?'Mega Lights Hunt':'Christmas Lights Hunt'),theme:collection?.theme||'',playMode:collection?.play_mode||'competition',archived:!!collection?.archived_at||megaEnded(room),ended:megaEnded(room),endAt:megaEndAt(room),clues:collection?.kind==='standalone'?JSON.parse(collection.clues_json||'[]'):[],...huntOptions(room),clueCount:collection?.kind==='standalone'?JSON.parse(collection.clues_json||'[]').length:(publicHuntMode(room)==='mega'?(isDecemberMega(room.seed)?125:30):room.mode==='family'?16:9)});
  function finaleAwards(room,rows){
    const modern=isDecemberMega(room.seed),cards=modern?decemberCards(huntOptions(room).characters,room.seed):[];
    const scores=rows.map(p=>{const found=safeFound(p.found_json,modern?125:30);return {nickname:p.nickname,total:found.length,rare:found.filter(i=>['rare','legendary'].includes(cards[i]?.tier)).length,variety:new Set(found.map(i=>cards[i]).filter(Boolean).map(decGroupFor)).size}});
    const specs=[['champion','Twinkle Trail Champion','Most unique finds','finds','total'],...(modern?[['treasure','North Pole Treasure Hunter','Most rare & legendary finds','rare & legendary finds','rare'],['explorer','Christmas Magic Explorer','Most clue categories explored','categories','variety']]:[])];
    return specs.flatMap(([id,title,description,unit,key])=>{const score=Math.max(0,...scores.map(p=>p[key]));return score?[{id,title,description,unit,score,winners:scores.filter(p=>p[key]===score).map(p=>p.nickname)}]:[]});
  }
  // Hunt HQ: a Mega room owns all its themed mini hunts. One guest token and
  // one set of private player photos cover the entire linked competition.
  const MEGA_LABELS=['Christmas tree','Glowing star','Candy cane','Santa Claus','Snowman','Reindeer','Holiday wreath','Big light-up gift','Christmas elf','Icicle lights','Colorful roof','Gingerbread person','Penguin','Glowing snowflake','Santa sleigh','Pink or purple lights','Giant inflatable','Giant ornament','Nativity scene','Light-up mailbox','','','','','','Music-synced lights','Holiday projector','Chasing light pattern','Light tunnel or arch','Lights spelling a word'];
const DEC_GROUPS=[["workshop","Santa’s Workshop","Christmas friends, presents and toys"],["disney","Disney Night","Disney, Pixar and Star Wars favorites"],["stories","Storybook & TV Favorites","Peanuts, Bluey, the Grinch and more"],["animals","Christmas Critters","Animals, pets and magical creatures"],["festive-decor","Christmas Classics & Candy","Ornaments, holiday symbols and sweet treats"],["neighborhood","Neighborhood Glow","Houses, trees, yards and big holiday displays"],["colors","Color Quest","Colors, twinkles and light styles"],["light-show","Light Show & Messages","Glowing words, music, motion and effects"]];
const decNamedGroups={
 classic:['Santa Claus','Snowman','Christmas elf','Gingerbread person','Mrs. Claus','The Nutcracker','Buddy the Elf','The Abominable Snow Monster','Bumble','Frosty the Snowman','Gingerbread Man','Rudolph','Reindeer'],
 disney:['Mickey Mouse','Minnie Mouse','Donald Duck','Goofy','Pluto','Winnie-the-Pooh','Winnie-the-Pooh and Piglet','Piglet','Tigger','Eeyore','Olaf','Elsa','Anna','Stitch','Jack Skellington','Zero (Nightmare Before Christmas)','Grogu (Baby Yoda)','The Mandalorian','Rapunzel','Simba'],
 candy:['Candy cane','Candy cane pathway','Gingerbread house','Peppermint swirl','Light-up lollipop','Light-up candy cottage'],
 home:['Colorful roof','Tree in a window','Lighted front door','Glowing bush','Wrapped tree trunk','Decorated porch','Lighted fence','Lighted driveway','Lights on a balcony','Light-up mailbox','Christmas tree'],
 words:['PEACE in lights','Lights spelling a word','JOY in lights','NOEL in lights','Merry Christmas in lights','Happy Holidays in lights']
};
const decNamedGroupMap=new Map(Object.entries(decNamedGroups).flatMap(([group,names])=>names.map(name=>[decSlug(name),group])));
function legacyDecGroupFor(c){return decNamedGroupMap.get(decSlug(c.name))||({'Characters':'stories','Animals & creatures':'animals','Christmas decorations':'decor','Colors & styles':'colors','Holiday scenes':'scenes','Words, music & effects':'effects'}[c.category])||'decor'}

// The same eight pools power both Mega sections and new mini hunts. Old theme IDs stay playable.
const workshopExtras=new Set(['Big light-up gift','Light-up gift stack','Christmas drum','Light-up rocking horse','Toy soldier','Lighted bicycle'].map(decSlug));
function decGroupFor(c){
 const old=legacyDecGroupFor(c);
 if(old==='classic'||(old==='decor'&&workshopExtras.has(decSlug(c.name))))return 'workshop';
 if(old==='decor'||old==='candy')return 'festive-decor';
 if(old==='home'||old==='scenes')return 'neighborhood';
 if(old==='words'||old==='effects')return 'light-show';
 return old;
}
const ACTIVE_THEME_DEFS=[["workshop","Santa’s Workshop","workshop"],["disney","Disney Night","disney"],["stories","Storybook & TV Favorites","stories"],["animals","Christmas Critters","animals"],["festive-decor","Christmas Classics & Candy","festive-decor"],["neighborhood","Neighborhood Glow","neighborhood"],["colors","Color Quest","colors"],["light-show","Light Show & Messages","light-show"],["random","Surprise Me","*"]];
const LEGACY_THEME_DEFS=[["christmas-friends","Christmas Friends","classic"],["classic","Christmas Classics","decor"],["candy","Candyland","candy"],["home","Neighborhood Glow","home"],["scenes","North Pole Adventure","scenes"],["words","Merry Messages","words"],["effects","Light Show Night","effects"]];
const THEME_DEFS=[...ACTIVE_THEME_DEFS,...LEGACY_THEME_DEFS];
function chooseThemeCards(cards,theme,seed,found=[],prior=[]){
 const def=THEME_DEFS.find(x=>x[0]===theme);if(!def)return [];
 const pool=cards.map((c,index)=>({...c,megaIndex:index})).filter(c=>def[2]==="*"||(LEGACY_THEME_DEFS.includes(def)?legacyDecGroupFor(c):decGroupFor(c))===def[2]);
 let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
 const rand=()=>{h+=0x6d2b79f5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const f=new Set(found),p=new Set(prior);pool.sort((a,b)=>Number(f.has(a.megaIndex))-Number(f.has(b.megaIndex))||Number(p.has(a.megaIndex))-Number(p.has(b.megaIndex)));
 return pool.slice(0,8);
}
  const NIGHT_THEMES=Object.fromEntries(THEME_DEFS.map(([key,title])=>[key,{title}]));
  function themedClues(theme,seed='',characters=[],roomSeed='',found=[],prior=[]){
    const pool=roomSeed&&!isDecemberMega(roomSeed)?MEGA_LABELS.map((name,i)=>({name:i>=20&&i<=24?(characters[i-20]||['Mickey Mouse','Winnie-the-Pooh','The Grinch','Snoopy','Olaf'][i-20]):name,category:DEC_CATS[i]})):decemberCards(characters,roomSeed||'mega-v4-default');
    return chooseThemeCards(pool,theme,seed,found,prior).map(c=>({name:c.name,hint:c.hint||'Spot this illuminated decoration',megaIndex:c.megaIndex}));
  }
  const listNights=async huntId=>{
    const rows=await db.prepare('SELECT id,hunt_id,theme,title,clues_json,created_at FROM hunt_nights WHERE hunt_id=? ORDER BY created_at,id').bind(huntId).all();
    return (rows.results||[]).map(n=>({id:n.id,theme:n.theme,title:n.title,clues:JSON.parse(n.clues_json||'[]'),createdAt:n.created_at}));
  };
  function safeFound(value,max){let items=[];try{items=typeof value==='string'?JSON.parse(value||'[]'):value||[]}catch{}return Array.isArray(items)?[...new Set(items.filter(n=>Number.isInteger(n)&&n>=0&&n<max))]:[]}
  async function recomputeMegaPlayer(huntId,playerId,now){
    const version=await db.prepare('SELECT seed FROM hunts WHERE id=?').bind(huntId).first();
    const maximum=isDecemberMega(version?.seed)?125:30,goal=maximum===125?100:30;
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO hunt_direct_progress(player_id,found_json,updated_at) SELECT id,found_json,? FROM hunt_players WHERE id=? AND hunt_id=?').bind(now,playerId,huntId),
      db.prepare(`UPDATE hunt_players SET found_json=(SELECT json_group_array(v) FROM (SELECT CAST(j.value AS INTEGER) AS v FROM hunt_direct_progress d,json_each(d.found_json) j WHERE d.player_id=hunt_players.id AND j.value>=0 AND j.value<? UNION SELECT CAST(json_extract(c.value,'$.megaIndex') AS INTEGER) FROM hunt_night_progress p JOIN hunt_nights n ON n.id=p.night_id,json_each(p.found_json) j JOIN json_each(n.clues_json) c ON c.key=j.value WHERE p.player_id=hunt_players.id AND n.hunt_id=hunt_players.hunt_id AND json_type(c.value,'$.megaIndex')='integer' AND json_extract(c.value,'$.megaIndex')>=0 AND json_extract(c.value,'$.megaIndex')<? ORDER BY v)),updated_at=? WHERE id=? AND hunt_id=?`).bind(maximum,maximum,now,playerId,huntId),
      db.prepare('UPDATE hunt_players SET finished_at=CASE WHEN json_array_length(found_json)>=? THEN COALESCE(finished_at,?) ELSE NULL END WHERE id=? AND hunt_id=?').bind(goal,now,playerId,huntId)
    ]);
    const row=await db.prepare('SELECT found_json FROM hunt_players WHERE id=? AND hunt_id=?').bind(playerId,huntId).first();
    return safeFound(row?.found_json,maximum);
  }

  const nightRoute=path.match(/^\/api\/hunts\/([a-f0-9]{32})\/nights(?:\/([a-f0-9]{32})\/progress)?$/);
  if(nightRoute){
    const huntId=nightRoute[1],nightId=nightRoute[2],now=Date.now();
    const room=await db.prepare('SELECT id,household_id,mode,seed,expires_at FROM hunts WHERE id=?').bind(huntId).first();
    if(!room||room.expires_at<=now||publicHuntMode(room)!=='mega')return error('This ongoing competition is unavailable.',404);
    const collection=await collectionFor(huntId);
    if(!allowChanges(room,collection,now))return error('This competition is archived and read-only.',409);
    await ensureHuntHQTables(db);
    if(method==='POST'&&!nightId){
      const current=await session(request,db);
      if(!current||current.household_id!==room.household_id)return error('Only the family hosting this competition can add a themed night.',403);
      if(!await guardLimit(db,'hunt-night-create',huntId,25,86400000))return error('Too many theme nights created today.',429);
      const b=await bodyJSON(request),theme=String(b.theme||''),spec=NIGHT_THEMES[theme];
      if(!spec)return error('Choose a supported theme.');
      const existing=await db.prepare('SELECT COUNT(*) AS total FROM hunt_nights WHERE hunt_id=?').bind(huntId).first();
      if(existing.total>=45)return error('This competition already has 45 themed nights.',409);
      const options=huntOptions(room),idNew=hex(bytes(16));
      const earlier=await listNights(huntId);
      const prior=earlier.filter(n=>n.theme===theme).flatMap(n=>n.clues.map(c=>c.megaIndex).filter(Number.isInteger));
      const clues=themedClues(theme,idNew,options.characters,room.seed,safeFound(b.found,isDecemberMega(room.seed)?125:30),prior);
      if(!clues.length)return error('No clues in this category for this older Mega Hunt. Choose another theme or create a new December Mega.');
      await db.prepare('INSERT INTO hunt_nights(id,hunt_id,theme,title,clues_json,created_at) VALUES(?,?,?,?,?,?)').bind(idNew,huntId,theme,spec.title,JSON.stringify(clues),now).run();
      return json({ok:true,night:{id:idNew,theme,title:spec.title,clues,createdAt:now}});
    }
    if(method==='POST'&&nightId){
      if(!await guardLimit(db,'hunt-night-progress',ip+':'+huntId,240,3600000))return error('Too many updates. Try shortly.',429);
      const night=await db.prepare('SELECT clues_json FROM hunt_nights WHERE id=? AND hunt_id=?').bind(nightId,huntId).first();if(!night)return error('Themed night not found.',404);
      const b=await bodyJSON(request),clues=JSON.parse(night.clues_json||'[]');
      const delta=progressDelta(b,clues.length);if(!delta)return error('Refresh your hunt to install the latest progress update.',409);
      const token=String(b.playerToken||''),player=await huntPlayer(huntId,token);if(!player)return error('Join the ongoing competition first.',401);
      // Protect existing Mega progress when this player first switches to themed nights.
      await recomputeMegaPlayer(huntId,player.id,now);
      await db.prepare(`INSERT INTO hunt_night_progress(night_id,player_id,found_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(night_id,player_id) DO UPDATE SET found_json=${deltaSQL('hunt_night_progress.found_json')},updated_at=excluded.updated_at`).bind(nightId,player.id,delta[1],now,...delta).run();
      const saved=await db.prepare('SELECT found_json FROM hunt_night_progress WHERE night_id=? AND player_id=?').bind(nightId,player.id).first(),found=safeFound(saved?.found_json,clues.length);
      const megaFound=await recomputeMegaPlayer(huntId,player.id,now);
      return json({ok:true,score:found.length,megaScore:megaFound.length});
    }
    return error('Not found.',404);
  }

  async function ensureHuntAccess(){
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS hunt_access (player_id TEXT PRIMARY KEY REFERENCES hunt_players(id) ON DELETE CASCADE,hunt_id TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,name_key TEXT NOT NULL,salt TEXT NOT NULL,pin_hash TEXT NOT NULL,user_id TEXT,adventure_json TEXT,completion_json TEXT NOT NULL DEFAULT '{}',UNIQUE(hunt_id,name_key),UNIQUE(hunt_id,user_id))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS hunt_access_tokens (token_hash TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES hunt_players(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS hunt_access_tokens_player_idx ON hunt_access_tokens(player_id)`)
    ]);
  }
  async function issueHuntToken(player){
    const token=hex(bytes(32));
    await db.prepare('INSERT INTO hunt_access_tokens(token_hash,player_id,expires_at) VALUES(?,?,?)').bind(await digest(token),player.id,Date.now()+180*86400000).run();
    return json({playerId:player.id,playerToken:token,nickname:player.nickname});
  }
  function nameKey(n){return String(n).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()}
  // Atomic rate-limit increment, scoped to both the player name and source IP.
  async function pinAttempt(kind,key,max){
    const k=await digest(kind+':'+key),now=Date.now();
    const row=await db.prepare(`INSERT INTO auth_limits(key,attempts,window_started) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_started<=? THEN 1 ELSE attempts+1 END,window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END RETURNING attempts`).bind(k,now,now-3600000,now-3600000).first();
    return row.attempts<=max;
  }
  function pinOK(pin){return typeof pin==='string'&&/^\d{4}$/.test(pin)}
  // An atomic JSON set delta prevents stale snapshots from removing another device's finds.
  function deltaSQL(column){return `(SELECT json_group_array(v) FROM (SELECT DISTINCT CAST(value AS INTEGER) AS v FROM json_each(${column}) WHERE value NOT IN (SELECT value FROM json_each(?)) UNION SELECT CAST(value AS INTEGER) FROM json_each(?) ORDER BY v))`}
  function progressDelta(b,max){
    if(!Array.isArray(b.add)||!Array.isArray(b.remove)||b.add.length>max||b.remove.length>max||[...b.add,...b.remove].some(n=>!Number.isInteger(n)||n<0||n>=max))return null;
    return [JSON.stringify([...new Set(b.remove)]),JSON.stringify([...new Set(b.add)])];
  }
  async function huntPlayer(roomId,auth){
    const token=String(auth||'').replace(/^Bearer\s+/i,'');
    if(!/^[a-f0-9]{64}$/.test(token))return null;
    const hash=await digest(token);
    const original=await db.prepare('SELECT id,nickname FROM hunt_players WHERE hunt_id=? AND token_hash=?').bind(roomId,hash).first();
    if(original)return original;
    await ensureHuntAccess();
    return db.prepare('SELECT p.id,p.nickname FROM hunt_access_tokens t JOIN hunt_players p ON p.id=t.player_id WHERE p.hunt_id=? AND t.token_hash=? AND t.expires_at>?').bind(roomId,hash,Date.now()).first();
  }

  const huntClueCount = (room,collection) => collection?.kind==='standalone'?JSON.parse(collection.clues_json||'[]').length:publicHuntMode(room)==='mega'?(isDecemberMega(room.seed)?125:30):room.mode==='family'?16:9;
  // Private owner index is authoritative across devices; guest links never expose household IDs.
  if(path==='/api/hunts/mine'&&method==='GET'){
    const owner=await session(request,db);if(!owner)return error('Sign in to see your hunts.',401);
    const results=await db.prepare(`SELECT h.id,h.mode,h.seed,h.created_at,h.expires_at,c.title,c.kind,c.theme,c.play_mode,c.archived_at,c.clues_json
      FROM hunts h LEFT JOIN hunt_collections c ON c.hunt_id=h.id WHERE h.household_id=? ORDER BY h.created_at DESC LIMIT 100`).bind(owner.household_id).all();
    return json({hunts:(results.results||[]).map(r=>({id:r.id,mode:r.kind&&r.kind!=='legacy'?r.kind:publicHuntMode(r),title:r.title||(publicHuntMode(r)==='mega'?'Mega Lights Hunt':'Classic Lights Hunt'),theme:r.theme||'',playMode:r.play_mode||'competition',archived:!!r.archived_at,ended:megaEnded(r),endAt:megaEndAt(r),createdAt:r.created_at,expiresAt:r.expires_at,photoMode:huntOptions(r).photoMode,clueCount:huntClueCount(r,r),goal:isDecemberMega(r.seed)?100:publicHuntMode(r)==='mega'?30:undefined}))});
  }
  const manageRoute=path.match(/^\/api\/hunts\/([a-f0-9]{32})\/manage$/);
  if(manageRoute&&method==='POST'){
    const owner=await session(request,db);if(!owner)return error('Sign in to manage your hunts.',401);
    const huntId=manageRoute[1],room=await db.prepare('SELECT household_id,mode,seed,created_at,expires_at FROM hunts WHERE id=?').bind(huntId).first();
    if(!room||room.household_id!==owner.household_id)return error('Hunt not found in your family.',404);
    const body=await bodyJSON(request);let collection=await collectionFor(huntId);
    if(!collection){const defaultTitle=publicHuntMode(room)==='mega'?'Earlier Mega Hunt':'Earlier Lights Hunt';
      await db.prepare('INSERT OR IGNORE INTO hunt_collections(hunt_id,title,kind,theme,play_mode,clues_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(huntId,defaultTitle,'legacy','', 'competition','[]',room.created_at||Date.now()).run();
      collection=await collectionFor(huntId);}
    if(body.action==='end'||body.action==='deadline'){
      if(publicHuntMode(room)!=='mega')return error('Only Mega Hunts have a finale.',400);
      const now=Date.now();
      if(room.expires_at<=now)return error('This Mega Hunt has already ended.',409);
      if(collection?.archived_at)return error('Restore the hunt before changing its end date.',409);
      const deadline=body.action==='end'?now:validMegaDeadline(body.endAt,now);
      if(deadline===null)return error('Choose an end date in the future.',400);
      const result=await db.prepare('UPDATE hunts SET expires_at=? WHERE id=? AND expires_at>?').bind(deadline,huntId,now).run();
      if(!result.meta?.changes)return error('This hunt has already ended.',409);
      return json({ok:true,expiresAt:deadline,endAt:deadline===NO_MEGA_DEADLINE?null:deadline,ended:body.action==='end'});
    }
    if(body.action==='rename'){
      const title=String(body.title||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,65);
      if(!title)return error('Enter a competition name.');
      await db.prepare('UPDATE hunt_collections SET title=? WHERE hunt_id=?').bind(title,huntId).run();return json({ok:true,title});
    }
    if(body.action==='archive'||body.action==='restore'){
      if(body.action==='restore'&&room.expires_at<=Date.now())return error('This hunt has ended; keep it archived as a memory.',409);
      const archived=body.action==='archive'?Date.now():null;
      await db.prepare('UPDATE hunt_collections SET archived_at=? WHERE hunt_id=?').bind(archived,huntId).run();
      return json({ok:true,archived:!!archived});
    }
    if(body.action==='delete'){
      // Only the account owner of the hosting family may delete a hunt.
      if(owner.role!=='owner')return error('Only the family account owner can permanently delete a hunt.',403);
      if(body.confirmHuntId!==huntId)return error('Confirm the selected hunt before deleting it.',400);
      // Older installations may lack optional photo/night tables. Never assume
      // that an optional migration was run before a user deletes an older hunt.
      let existingTables;
      try{
        const schema=await db.prepare(`SELECT name FROM sqlite_master WHERE type=? AND name IN
          ('hunt_photos','hunt_night_photos','hunt_night_progress','hunt_direct_progress','hunt_nights','hunt_players','hunt_collections','hunt_access','hunt_access_tokens')`).bind('table').all();
        existingTables=new Set((schema.results||[]).map(x=>x.name));
      }catch(e){console.error('Hunt deletion schema lookup failed:',e);
        return error('Could not check the hunt database. The hunt has not been deleted. Please try again.',503)}

      // All hunt photo objects share this exact household + hunt R2 prefix.
      // List the prefix as well as registered metadata to catch old/orphan photos.
      const prefix=`${room.household_id}/hunt/${huntId}/`;
      const keys=new Set();
      try{
        for(const table of ['hunt_photos','hunt_night_photos']){
          if(!existingTables.has(table))continue;
          const photos=await db.prepare(`SELECT object_key FROM ${table} WHERE hunt_id=?`).bind(huntId).all();
          for(const row of photos.results||[]){
            if(typeof row.object_key==='string'&&row.object_key.startsWith(prefix))keys.add(row.object_key);
          }
        }
      }catch(e){console.error('Hunt deletion photo metadata lookup failed:',e);
        return error('Could not check hunt photos in the database. The hunt has not been deleted. Please try again.',503)}
      if(env.MEDIA?.list){
        let cursor;
        try{
          for(let pageNumber=0;pageNumber<100;pageNumber++){
            const page=await env.MEDIA.list({prefix,limit:1000,...(cursor?{cursor}:{})});
            for(const obj of page.objects||[])if(obj.key.startsWith(prefix))keys.add(obj.key);
            if(!page.truncated){cursor=null;break}
            if(!page.cursor)throw Error('Storage did not provide a continuation cursor.');
            cursor=page.cursor;
          }
          if(cursor)throw Error('Too many photos to clean in one request.');
        }catch(e){console.error('Hunt deletion R2 listing failed:',e);
          return error('Could not verify hunt photo storage. Nothing has been deleted; try again or check Cloudflare R2.',503)}
      }
      if(keys.size&&!env.MEDIA?.delete)return error('Photo storage is unavailable. Nothing has been deleted. Check the R2 MEDIA binding.',503);

      // Fail closed if R2 can't remove files: keep the hunt available for retry.
      // D1 schema is preflighted above so missing optional tables can't cause
      // an unexpected D1 failure after photo cleanup.
      try{
        const list=[...keys];
        for(let i=0;i<list.length;i+=500)await env.MEDIA.delete(list.slice(i,i+500));
      }catch(e){console.error('Hunt deletion R2 cleanup failed:',e);
        return error('Unable to remove hunt photos from storage. The hunt was not deleted. Check R2 / Worker Logs and try again.',503)}

      // Delete children explicitly inside one D1 batch transaction. Older base
      // schema versions cannot be relied upon to cascade all dependencies.
      // In Cloudflare D1, batch() runs all statements in one transaction.
      const statements=[];
      const add=(table,sql,...args)=>{if(existingTables.has(table))statements.push(db.prepare(sql).bind(...args))};
      add('hunt_night_photos','DELETE FROM hunt_night_photos WHERE hunt_id=?',huntId);
      add('hunt_night_progress','DELETE FROM hunt_night_progress WHERE night_id IN (SELECT id FROM hunt_nights WHERE hunt_id=?)',huntId);
      add('hunt_direct_progress','DELETE FROM hunt_direct_progress WHERE player_id IN (SELECT id FROM hunt_players WHERE hunt_id=?)',huntId);
      add('hunt_photos','DELETE FROM hunt_photos WHERE hunt_id=?',huntId);
      add('hunt_nights','DELETE FROM hunt_nights WHERE hunt_id=?',huntId);
      add('hunt_access_tokens','DELETE FROM hunt_access_tokens WHERE player_id IN (SELECT id FROM hunt_players WHERE hunt_id=?)',huntId);
      add('hunt_access','DELETE FROM hunt_access WHERE hunt_id=?',huntId);
      add('hunt_players','DELETE FROM hunt_players WHERE hunt_id=?',huntId);
      add('hunt_collections','DELETE FROM hunt_collections WHERE hunt_id=?',huntId);
      statements.push(db.prepare('DELETE FROM hunts WHERE id=? AND household_id=?').bind(huntId,owner.household_id));
      try{
        const results=await db.batch(statements);
        if(!results.at(-1)?.meta?.changes)return error('Hunt no longer exists.',404);
      }catch(e){console.error('Hunt deletion D1 transaction failed:',e);
        return error('Cloudflare could not remove this hunt from the database. The hunt is still saved. Check Worker Logs for “Hunt deletion D1 transaction failed.”',503)}

      return json({ok:true,deleted:true});
    }
    return error('Choose rename, archive, restore, or delete.');
  }
  // Shared lights hunts are capability links. No parent account data is exposed here.
  const huntMatch=path.match(/^\/api\/hunts\/([a-f0-9]{32})(?:\/(join|progress|resume|access|adventure|account))?$/);
  if(huntMatch){
    const huntId=huntMatch[1],action=huntMatch[2]||'',now=Date.now();
    const room=await db.prepare('SELECT id,mode,seed,created_at,expires_at FROM hunts WHERE id=?').bind(huntId).first();
    const collection=room?await collectionFor(huntId):null;
    if(!room||(!allowChanges(room,collection,now)&&!collection?.archived_at&&!megaEnded(room,now)))return error('This hunt is unavailable or has expired.',404);
    if(method==='GET'&&!action){
      const rows=await db.prepare('SELECT id,nickname,found_json,finished_at,updated_at FROM hunt_players WHERE hunt_id=?').bind(huntId).all();
      const maximum=huntClueCount(room,collection);
      const leaders=(rows.results||[]).map(p=>{
        let found=[];try{found=JSON.parse(p.found_json||'[]')}catch{}
        const score=Array.isArray(found)?new Set(found.filter(n=>Number.isInteger(n)&&n>=0&&n<maximum)).size:0;
        return {id:p.id,nickname:p.nickname,score,finishedAt:p.finished_at||null,updatedAt:p.updated_at};
      }).sort((a,b)=>b.score-a.score||(a.finishedAt||Infinity)-(b.finishedAt||Infinity)||a.updatedAt-b.updatedAt);
      let nights=[],nightLeaders={},myProgress=null,access=null;
      if(publicHuntMode(room)==='mega'){
        try{
          await ensureHuntHQTables(db);
          nights=await listNights(huntId);
          const progress=await db.prepare(`SELECT n.id AS night_id,p.player_id,p.found_json,hp.nickname,hp.updated_at FROM hunt_night_progress p JOIN hunt_nights n ON n.id=p.night_id JOIN hunt_players hp ON hp.id=p.player_id WHERE n.hunt_id=?`).bind(huntId).all();
          for(const row of progress.results||[]){(nightLeaders[row.night_id]??=[]).push({id:row.player_id,nickname:row.nickname,score:safeFound(row.found_json,8).length,updatedAt:row.updated_at})}
          for(const rows of Object.values(nightLeaders))rows.sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt);
        }catch(e){console.error('Hunt HQ migration unavailable:',e.message)}
      }
      const authPlayer=await huntPlayer(huntId,request.headers.get('Authorization'));
      if(authPlayer){
        const own=await db.prepare('SELECT found_json FROM hunt_players WHERE id=? AND hunt_id=?').bind(authPlayer.id,huntId).first();
        let direct=own?.found_json||'[]',nightFound={};
        if(publicHuntMode(room)==='mega'){
          try{
            const row=await db.prepare('SELECT found_json FROM hunt_direct_progress WHERE player_id=?').bind(authPlayer.id).first();
            if(row)direct=row.found_json;
            const mini=await db.prepare('SELECT night_id,found_json FROM hunt_night_progress WHERE player_id=?').bind(authPlayer.id).all();
            for(const row of mini.results||[])nightFound[row.night_id]=safeFound(row.found_json,8);
          }catch{}
        }
        await ensureHuntAccess();
        const profile=await db.prepare('SELECT user_id,adventure_json,completion_json FROM hunt_access WHERE player_id=?').bind(authPlayer.id).first();
        access={pinSet:!!profile,accountLinked:!!profile?.user_id,adventure:profile?.adventure_json?JSON.parse(profile.adventure_json):null,completions:profile?JSON.parse(profile.completion_json||'{}'):{}};
        myProgress={found:safeFound(own?.found_json||'[]',huntClueCount(room,collection)),direct:safeFound(direct,huntClueCount(room,collection)),nights:nightFound};
      }
      return json({hunt:huntPublic(room,collection),awards:megaEnded(room,now)&&collection?.play_mode!=='solo'?finaleAwards(room,rows.results||[]):[],leaders:collection?.play_mode==='solo'?[]:leaders,nights,nightLeaders:collection?.play_mode==='solo'?{}:nightLeaders,myProgress,access});
    }
    if(method==='POST'&&['resume','account','access','adventure'].includes(action)){
      await ensureHuntAccess();
      const b=await bodyJSON(request);
      if(action==='resume'){
        const key=nameKey(String(b.nickname||'').slice(0,24));
        if(!key||!pinOK(b.pin))return error('Enter your team name and four-digit PIN.');
        if(!await pinAttempt('hunt-pin-ip',ip+':'+huntId,20)||!await pinAttempt('hunt-pin-name',huntId+':'+key,5))return error('Too many sign-in attempts. Try again in an hour.',429);
        const row=await db.prepare('SELECT a.salt,a.pin_hash,p.id,p.nickname FROM hunt_access a JOIN hunt_players p ON p.id=a.player_id WHERE a.hunt_id=? AND a.name_key=?').bind(huntId,key).first();
        const check=await hashPassword(b.pin,row?.salt||'invalid',env.PASSWORD_PEPPER);
        if(!row||!equal(check,row.pin_hash))return error('That name and PIN do not match. If you started before PIN access, set up your PIN on your original device.',401);
        return issueHuntToken(row);
      }
      if(action==='account'){
        const user=await session(request,db);if(!user)return error('Sign in to Santa HQ first, or use your team PIN.',401);
        const player=await db.prepare('SELECT p.id,p.nickname FROM hunt_access a JOIN hunt_players p ON p.id=a.player_id WHERE a.hunt_id=? AND a.user_id=?').bind(huntId,user.user_id).first();
        if(!player)return error('No team is linked to this Santa HQ account in this hunt. Join or resume using a PIN first.',404);
        return issueHuntToken(player);
      }
      const player=await huntPlayer(huntId,b.playerToken);if(!player)return error('Resume your hunt before making changes.',401);
      const prior=await db.prepare('SELECT * FROM hunt_access WHERE player_id=?').bind(player.id).first();
      if(action==='access'){
        if(b.linkAccount){
          const user=await session(request,db);if(!user)return error('Sign in to Santa HQ first.',401);
          if(!prior)return error('Set up your PIN first.');
          if(prior.user_id&&prior.user_id!==user.user_id)return error('This team is already linked to another account.',409);
          try{await db.prepare('UPDATE hunt_access SET user_id=? WHERE player_id=? AND (user_id IS NULL OR user_id=?)').bind(user.user_id,player.id,user.user_id).run()}catch{return error('This account is already linked to another team in this hunt.',409)}
          return json({ok:true});
        }
        if(prior)return error('This team already has a PIN. Use it to resume on another device.',409);
        if(!pinOK(b.pin))return error('Choose a four-digit PIN.');
        const nickname=String(b.nickname||player.nickname).trim().replace(/[<>\x00-\x1f]/g,'').slice(0,24),key=nameKey(nickname);
        if(!key)return error('Choose a team name.');
        const names=await db.prepare('SELECT id,nickname FROM hunt_players WHERE hunt_id=?').bind(huntId).all();
        if((names.results||[]).some(p=>p.id!==player.id&&nameKey(p.nickname)===key))return error('That team name is already used. Choose a different name to keep your existing finds.',409);
        const salt=hex(bytes(16)),hash=await hashPassword(b.pin,salt,env.PASSWORD_PEPPER);
        try{await db.batch([db.prepare('INSERT INTO hunt_access(player_id,hunt_id,name_key,salt,pin_hash) VALUES(?,?,?,?,?)').bind(player.id,huntId,key,salt,hash),db.prepare('UPDATE hunt_players SET nickname=? WHERE id=?').bind(nickname,player.id)])}catch{return error('That name is already used or a PIN has already been set.',409)}
        return json({ok:true,nickname});
      }
      if(!prior)return json({ok:true});
      const a=b.adventure,completions=b.completions||{};
      if(a&&(!THEME_DEFS.some(t=>t[0]===a.theme)||!Array.isArray(a.indices)||a.indices.length>8||!a.indices.length||a.indices.some(i=>!Number.isInteger(i)||i<0||i>=huntClueCount(room,collection))))return error('Invalid adventure.');
      const clean=Object.fromEntries(Object.entries(completions).filter(([k,v])=>/^(personal:[a-z-]+|[a-f0-9]{32}|standalone)$/.test(k)&&Number.isInteger(v)&&v>=2020&&v<=2100).slice(0,100));
      await db.prepare('UPDATE hunt_access SET adventure_json=CASE WHEN ? THEN ? ELSE adventure_json END,completion_json=json_patch(completion_json,?) WHERE player_id=?').bind(b.setAdventure?1:0,a?JSON.stringify({theme:a.theme,indices:[...new Set(a.indices)]}):null,JSON.stringify(clean),player.id).run();
      return json({ok:true});
    }
    if(method==='POST'&&action==='join'){
      if(!allowChanges(room,collection,now))return error('This hunt is archived or has ended.',409);
      if(!await guardLimit(db,'hunt-join',ip+':'+huntId,25,3600000))return error('Too many players joining from this network. Try later.',429);
      const b=await bodyJSON(request);
      const name=String(b.nickname||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,24);
      if(name.length<1)return error('Choose a short team nickname (up to 24 characters).');
      if(!pinOK(b.pin))return error('Choose a four-digit PIN.');
      await ensureHuntAccess();
      const names=await db.prepare('SELECT id,nickname FROM hunt_players WHERE hunt_id=?').bind(huntId).all(),key=nameKey(name);
      if((names.results||[]).some(p=>nameKey(p.nickname)===key))return error('That team name is already in use. Resume your hunt or choose a different name.',409);
      const count=await db.prepare('SELECT count(*) AS total FROM hunt_players WHERE hunt_id=?').bind(huntId).first();
      if(count.total>=40)return error('This hunt is full (40 players).',409);
      const token=hex(bytes(32)),playerId=id();
      const salt=hex(bytes(16)),hash=await hashPassword(b.pin,salt,env.PASSWORD_PEPPER);
      try{await db.batch([
        db.prepare('INSERT INTO hunt_players(id,hunt_id,token_hash,nickname,found_json,updated_at) VALUES(?,?,?,?,?,?)').bind(playerId,huntId,await digest(token),name,'[]',now),
        db.prepare('INSERT INTO hunt_access(player_id,hunt_id,name_key,salt,pin_hash) VALUES(?,?,?,?,?)').bind(playerId,huntId,key,salt,hash)
      ])}catch{return error('That team name is already in use. Try resuming instead.',409)}
      return json({playerId,playerToken:token,nickname:name});
    }
    if(method==='POST'&&action==='progress'){
      if(!allowChanges(room,collection,now))return error('This hunt is archived or has ended.',409);
      if(!await guardLimit(db,'hunt-progress',ip+':'+huntId,240,3600000))return error('Too many updates. Try again in a moment.',429);
      const b=await bodyJSON(request),token=String(b.playerToken||''),maximum=huntClueCount(room,collection);
      const delta=progressDelta(b,maximum);if(!delta)return error('Refresh your hunt to install the latest progress update.',409);
      const player=await huntPlayer(huntId,token);
      if(!player)return error('Resume this hunt using your team PIN.',401);
      if(publicHuntMode(room)==='mega'){
        await ensureHuntHQTables(db);
        await db.prepare('INSERT OR IGNORE INTO hunt_direct_progress(player_id,found_json,updated_at) SELECT id,found_json,? FROM hunt_players WHERE id=? AND hunt_id=?').bind(now,player.id,huntId).run();
        await db.prepare(`UPDATE hunt_direct_progress SET found_json=${deltaSQL('found_json')},updated_at=? WHERE player_id=?`).bind(...delta,now,player.id).run();
        const union=await recomputeMegaPlayer(huntId,player.id,now);
        return json({ok:true,score:union.length});
      }
      await db.batch([db.prepare(`UPDATE hunt_players SET found_json=${deltaSQL('found_json')},updated_at=? WHERE id=? AND hunt_id=?`).bind(...delta,now,player.id,huntId),db.prepare('UPDATE hunt_players SET finished_at=CASE WHEN json_array_length(found_json)>=? THEN COALESCE(finished_at,?) ELSE NULL END WHERE id=? AND hunt_id=?').bind(maximum,now,player.id,huntId)]);
      const saved=await db.prepare('SELECT found_json FROM hunt_players WHERE id=?').bind(player.id).first();
      return json({ok:true,score:safeFound(saved?.found_json,maximum).length});
    }
    return error('Not found.',404);
  }
  if(path==='/api/auth/register'&&method==='POST'){
    if(!await guardLimit(db,'registration',ip,5,3600000))return error('Too many registrations. Try later.',429);
    const b=await bodyJSON(request),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),inviteToken=String(b.invite||'');
    if(!emailOK(email)||password.length<12||password.length>128)return error('Use a valid email and a password of 12–128 characters.');
    const invitation=inviteToken?await validInvitation(db,inviteToken):null;
    if(inviteToken&&!invitation)return error('This invitation is invalid, expired, or already used.');
    const familyName=String(b.familyName||'Our North Pole').trim().slice(0,70)||'Our North Pole';
    const userId=id(),houseId=invitation?.household_id||id(),salt=hex(bytes(16)),now=Date.now();
    const mustVerify=emailReady(env)?1:0;
    const passHash=await hashPassword(password,salt,env.PASSWORD_PEPPER);
    if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return error('This email is already registered. Sign in instead.',409);
    const calls=[db.prepare('INSERT INTO users(id,email,salt,password_hash,created_at,verification_required) VALUES(?,?,?,?,?,?)').bind(userId,email,salt,passHash,now,mustVerify)];
    if(!invitation){
      calls.push(db.prepare('INSERT INTO households(id,name,created_at) VALUES(?,?,?)').bind(houseId,familyName,now));
      calls.push(db.prepare("INSERT INTO memberships(user_id,household_id,role) VALUES(?,?,'owner')").bind(userId,houseId));
      const defaults=[{id:'1',name:'Child 1',icon:'star',budget:250},{id:'2',name:'Child 2',icon:'heart',budget:250}];
      const allowedIcons=['star','heart','flower','moon','sparkle','snow','elf-purple-girl','elf-pink-girl','elf-red-girl','elf-lilac-girl','elf-green-boy','elf-blue-boy','elf-teal-boy','elf-navy-boy','elf-gold','elf-mint','elf-coral','elf-classic'] ;
      const submitted=Array.isArray(b.children)?b.children:null;
      const chosen=submitted||[{id:'1',name:b.child1||'Child 1',budget:b.budget1??250,icon:'star'},{id:'2',name:b.child2||'Child 2',budget:b.budget2??250,icon:'heart'}];
      if(chosen.length<1||chosen.length>6||chosen.some((c,i)=>!c||String(c.id)!==String(i+1)||typeof c.name!=='string'||!c.name.trim()||c.name.length>50||!allowedIcons.includes(c.icon)||!Number.isFinite(Number(c.budget))||Number(c.budget)<0||Number(c.budget)>1000000))return error('Enter 1–6 children with names, icons and valid budgets.');
      const children=chosen.map(c=>({id:String(c.id),name:c.name.trim().slice(0,50),icon:c.icon,budget:Number(c.budget)}));
      const p={familyName,child1:children[0]?.name||'Child 1',child2:children[1]?.name||'Child 2',budget1:children[0]?.budget||0,budget2:children[1]?.budget||0,children,traditions:[]};
      calls.push(db.prepare("INSERT INTO records(household_id,kind,id,data,deleted,updated_at) VALUES(?,'profile','main',?,0,?)").bind(houseId,JSON.stringify(p),now));
    } else calls.push(db.prepare("INSERT INTO memberships(user_id,household_id,role) VALUES(?,?,'parent')").bind(userId,houseId));
    try{await db.batch(calls)}catch(e){if(/UNIQUE/i.test(String(e)))return error('Account already exists.',409);throw e}
    if(invitation)await db.prepare('UPDATE invitations SET used_at=? WHERE token_hash=? AND used_at IS NULL').bind(now,await digest(inviteToken)).run();
    if(mustVerify){
      try{await sendVerification(db,env,url,{id:userId,email})}catch(e){console.error('Santa HQ registration email:',e);return error('Your account was created, but the verification email could not be sent. Use Resend verification after email delivery is configured.',503)}
      return json({ok:true,verificationPending:true,email},201);
    }
    const token=await makeSession(db,userId,houseId);
    const newUser=await db.prepare(`SELECT s.token_hash,s.user_id,s.household_id,m.role,u.email,u.email_verified_at,u.verification_required,h.name AS family_name FROM sessions s JOIN memberships m ON m.user_id=s.user_id AND m.household_id=s.household_id JOIN users u ON u.id=s.user_id JOIN households h ON h.id=s.household_id WHERE s.token_hash=?`).bind(await digest(token)).first();
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
    if(user.verification_required&&!user.email_verified_at)return json({error:'Verify your email address before signing in.',code:'VERIFY_REQUIRED'},403);
    const preferred=await db.prepare('SELECT household_id FROM memberships WHERE user_id=? ORDER BY role DESC LIMIT 1').bind(user.id).first();
    if(!preferred)return error('Account has no family.',403);
    const token=await makeSession(db,user.id,preferred.household_id);
    const cur=await session(new Request(url.origin,{headers:{Cookie:`__Host-santa_session=${token}`}}),db);
    return json({ok:true,...await who(db,cur)},200,{'Set-Cookie':cookie(token)});
  }
  // Photo Hunt is capability-link based: guest player tokens grant rights to THEIR
  // own photos, not parent-account gifts, mail, or anyone else's private photos.
  const pMatch=path.match(/^\/api\/hunts\/([a-f0-9]{32})\/photos(?:\/(upload|visibility|delete|file)(?:\/([a-f0-9-]{36}))?)?$/);
  if(pMatch){
    const huntId=pMatch[1],action=pMatch[2]||'list',photoId=pMatch[3]||'',now=Date.now();
    const room=await db.prepare('SELECT id,household_id,mode,seed,expires_at FROM hunts WHERE id=?').bind(huntId).first();
    const collection=room?await collectionFor(huntId):null;
    if(!room||(!allowChanges(room,collection,now)&&!collection?.archived_at&&!megaEnded(room,now)))return error('This hunt has expired or is unavailable.',404);
    if(!huntOptions(room).photoMode)return error('This hunt does not allow photo submissions.',403);
    const token=request.headers.get('Authorization')||'',player=await huntPlayer(huntId,token);
    if(publicHuntMode(room)==='mega')await ensureHuntHQTables(db);
    if(action==='list'&&method==='GET'){
      const rows=await db.prepare(`SELECT hp.id,hp.player_id,hp.clue_index,hp.shared,hp.created_at,p.nickname
       FROM hunt_photos hp JOIN hunt_players p ON p.id=hp.player_id
       WHERE hp.hunt_id=? AND (hp.shared=1 OR hp.player_id=?) ORDER BY hp.created_at DESC LIMIT 1000`)
       .bind(huntId,player?.id||'').all();
      let combined=(rows.results||[]).map(r=>({id:r.id,playerId:r.player_id,clueIndex:r.clue_index,nightId:null,shared:!!r.shared,createdAt:r.created_at,nickname:r.nickname}));
      if(publicHuntMode(room)==='mega'){
        const nightRows=await db.prepare(`SELECT hp.id,hp.player_id,hp.clue_index,hp.night_id,hp.shared,hp.created_at,p.nickname,n.title,n.clues_json
         FROM hunt_night_photos hp JOIN hunt_players p ON p.id=hp.player_id JOIN hunt_nights n ON n.id=hp.night_id
         WHERE hp.hunt_id=? AND (hp.shared=1 OR hp.player_id=?) ORDER BY hp.created_at DESC LIMIT 1000`)
         .bind(huntId,player?.id||'').all();
        combined.push(...(nightRows.results||[]).map(r=>({id:r.id,playerId:r.player_id,clueIndex:r.clue_index,nightId:r.night_id,clueName:JSON.parse(r.clues_json||'[]')[r.clue_index]?.name||'Holiday lights',nightTitle:r.title,shared:!!r.shared,createdAt:r.created_at,nickname:r.nickname})));
      }
      return json({photos:combined.sort((a,b)=>b.createdAt-a.createdAt).slice(0,1000)});
    }
    if(action==='file'&&method==='GET'){
      if(!env.MEDIA)return error('Photo storage is unavailable.',503);
      let row=await db.prepare('SELECT player_id,object_key,shared FROM hunt_photos WHERE hunt_id=? AND id=?').bind(huntId,photoId).first();
      if(!row&&publicHuntMode(room)==='mega')row=await db.prepare('SELECT player_id,object_key,shared FROM hunt_night_photos WHERE hunt_id=? AND id=?').bind(huntId,photoId).first();
      if(!row||(row.shared!==1&&row.player_id!==player?.id))return error('Photo unavailable.',404);
      const object=await env.MEDIA.get(row.object_key);if(!object)return error('Photo unavailable.',404);
      return new Response(object.body,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    if(!player)return error('Join this hunt to manage your photos.',401);
    if(action==='upload'&&method==='POST'){
      if(!allowChanges(room,collection,now))return error('This hunt is archived or has ended.',409);
      if(!env.MEDIA)return error('Private R2 media storage must be configured first.',503);
      if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('multipart/form-data'))return error('Upload a photo.',415);
      if(!await guardLimit(db,'hunt-photo-upload',huntId+':'+player.id,45,86400000))return error('Photo limit reached for today.',429);
      if(Number(request.headers.get('Content-Length')||0)>2.3*1024*1024)return error('Photo exceeds the 2 MB upload limit.',413);
      const fd=await request.formData();
      const file=fd.get('photo'),clue=Number(fd.get('clueIndex')),share=String(fd.get('shared'))==='1',nightId=String(fd.get('nightId')||'');
      const maximum=huntClueCount(room,collection);
      let night=null;
      if(nightId){
        if(publicHuntMode(room)!=='mega'||!/[a-f0-9]{32}/.test(nightId))return error('Invalid themed hunt.',400);
        night=await db.prepare('SELECT clues_json FROM hunt_nights WHERE id=? AND hunt_id=?').bind(nightId,huntId).first();
        if(!night)return error('Themed hunt not found.',404);
        const clues=JSON.parse(night.clues_json||'[]');
        if(!Number.isInteger(clue)||clue<0||clue>=clues.length||Number.isInteger(clues[clue].megaIndex))return error('Only bonus finds need a separate nightly photo.',400);
      }else if(!Number.isInteger(clue)||clue<0||clue>=maximum)return error('Choose a valid hunt clue.',400);
      if(!file||typeof file.arrayBuffer!=='function'||file.type!=='image/jpeg')return error('Choose a supported JPEG photo.',415);
      if(!file.size||file.size>2*1024*1024)return error('Photo must be smaller than 2 MB.',413);
      const buffer=await file.arrayBuffer(),magic=new Uint8Array(buffer.slice(0,4));
      if(magic[0]!==255||magic[1]!==216||magic[2]!==255)return error('This is not a valid JPEG photo.',415);
      if(!night&&clue>=30){try{await ensureDecemberPhotoCapacity(db)}catch(e){console.error('December Mega photo setup:',e);return error('Extended photo storage is not ready. Contact the site administrator.',503)}}
      const previous=night
       ?await db.prepare('SELECT id,object_key FROM hunt_night_photos WHERE hunt_id=? AND night_id=? AND player_id=? AND clue_index=?').bind(huntId,nightId,player.id,clue).first()
       :await db.prepare('SELECT id,object_key FROM hunt_photos WHERE hunt_id=? AND player_id=? AND clue_index=?').bind(huntId,player.id,clue).first();
      const newId=id(),objectKey=`${room.household_id}/hunt/${huntId}/${newId}.jpg`;
      await env.MEDIA.put(objectKey,buffer,{httpMetadata:{contentType:'image/jpeg'},customMetadata:{huntId,playerId:player.id}});
      try{
        if(night)await db.prepare(`INSERT INTO hunt_night_photos(id,hunt_id,night_id,player_id,clue_index,object_key,shared,created_at)
          VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(night_id,player_id,clue_index)
          DO UPDATE SET id=excluded.id,object_key=excluded.object_key,shared=excluded.shared,created_at=excluded.created_at`)
          .bind(newId,huntId,nightId,player.id,clue,objectKey,share?1:0,now).run();
        else await db.prepare(`INSERT INTO hunt_photos(id,hunt_id,player_id,clue_index,object_key,shared,created_at)
          VALUES(?,?,?,?,?,?,?) ON CONFLICT(hunt_id,player_id,clue_index)
          DO UPDATE SET id=excluded.id,object_key=excluded.object_key,shared=excluded.shared,created_at=excluded.created_at`)
          .bind(newId,huntId,player.id,clue,objectKey,share?1:0,now).run();
      }catch(e){await env.MEDIA.delete(objectKey);throw e}
      if(previous)await env.MEDIA.delete(previous.object_key);
      return json({ok:true,photoId:newId,clueIndex:clue,shared:share});
    }
    if(['visibility','delete'].includes(action)&&method==='POST'){
      if(!photoId)return error('Photo ID required.',400);
      let isNight=false,row=await db.prepare('SELECT player_id,object_key,shared FROM hunt_photos WHERE hunt_id=? AND id=?').bind(huntId,photoId).first();
      if(!row&&publicHuntMode(room)==='mega'){
        row=await db.prepare('SELECT player_id,object_key,shared FROM hunt_night_photos WHERE hunt_id=? AND id=?').bind(huntId,photoId).first();isNight=!!row;
      }
      if(!row||row.player_id!==player.id)return error('You can only change your own photos.',403);
      if(action==='visibility'){
        const b=await bodyJSON(request);
        if(typeof b.shared!=='boolean')return error('Choose whether to share this photo.');
        await db.prepare(isNight?'UPDATE hunt_night_photos SET shared=? WHERE hunt_id=? AND id=?':'UPDATE hunt_photos SET shared=? WHERE hunt_id=? AND id=?').bind(b.shared?1:0,huntId,photoId).run();
        return json({ok:true,shared:b.shared});
      }
      if(!env.MEDIA)return error('Photo storage is unavailable.',503);
      await db.prepare(isNight?'DELETE FROM hunt_night_photos WHERE hunt_id=? AND id=?':'DELETE FROM hunt_photos WHERE hunt_id=? AND id=?').bind(huntId,photoId).run();
      await env.MEDIA.delete(row.object_key);
      return json({ok:true});
    }
    return error('Not found.',404);
  }
  const me=await session(request,db);
  if(path==='/api/auth/me'&&method==='GET')return me?json({authenticated:true,...await who(db,me)}):json({authenticated:false});
  if(!me)return error('Please sign in to your family.',401);
  // Kid photos and videos live in a PRIVATE R2 bucket, not in D1 or the relatives' list.
  // The ID is random, and the object key is scoped to the authenticated household.
  const mediaMatch=path.match(/^\/api\/private\/media\/([a-f0-9-]{36})$/i);
  if(mediaMatch&&method==='GET'){
    if(!env.MEDIA)return error('Private media storage has not been set up.',503);
    const mediaId=mediaMatch[1].toLowerCase();
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(mediaId))return error('Invalid media ID.',400);
    const key=`${me.household_id}/mail/${mediaId}`;
    const object=await env.MEDIA.get(key,request.headers.has('range')?{range:request.headers}:undefined);
    if(!object)return error('This private file is unavailable.',404);
    const mime=String(object.httpMetadata?.contentType||object.customMetadata?.mime||'');
    if(!MEDIA_MIMES.has(mime))return error('Unsupported media type.',415);
    const headers=new Headers({'Content-Type':mime,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Accept-Ranges':'bytes','Cross-Origin-Resource-Policy':'same-origin'});
    let status=200;
    if(request.headers.has('range')&&object.range&&typeof object.range.offset==='number'&&typeof object.range.length==='number'){
      status=206;headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);
    }
    return new Response(object.body,{status,headers});
  }
  if(path==='/api/private/media'&&method==='POST'){
    if(!env.MEDIA)return error('The site owner must create the private Santa media bucket first.',503);
    const mime=String(request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
    if(!MEDIA_MIMES.has(mime))return error('Choose a JPEG, PNG, WebP, MP4, MOV, or WebM file.',415);
    if(!await guardLimit(db,'private-media-upload',me.user_id,40,86400000))return error('Too many media uploads today. Please try tomorrow.',429);
    const announced=Number(request.headers.get('Content-Length')||0);
    if(announced>MAX_PRIVATE_MEDIA)return error('Choose a photo or video smaller than 15 MB.',413);
    const buffer=await request.arrayBuffer();
    if(!buffer.byteLength||buffer.byteLength>MAX_PRIVATE_MEDIA)return error('Choose a file smaller than 15 MB.',413);
    const mark=new Uint8Array(buffer.slice(0,16));
    const ascii=(start,len)=>String.fromCharCode(...mark.slice(start,start+len));
    const valid=mime==='image/jpeg'?mark[0]===255&&mark[1]===216&&mark[2]===255:
      mime==='image/png'?mark[0]===137&&ascii(1,3)==='PNG':
      mime==='image/webp'?ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP':
      mime==='video/webm'?mark[0]===26&&mark[1]===69&&mark[2]===223&&mark[3]===163:
      ascii(4,4)==='ftyp';
    if(!valid)return error('This file does not match its photo/video format.',415);
    const mediaId=id(),key=`${me.household_id}/mail/${mediaId}`;
    await env.MEDIA.put(key,buffer,{httpMetadata:{contentType:mime},customMetadata:{mime,uploadedBy:me.user_id,householdId:me.household_id}});
    return json({ok:true,mediaId,mime,format:mime.startsWith('image/')?'photo':'video'});
  }
  if(path==='/api/private/media/abandon'&&method==='POST'){
    const b=await bodyJSON(request),mediaId=String(b.mediaId||'');
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(mediaId))return error('Invalid media ID.',400);
    if(!env.MEDIA)return error('Private media storage is not configured.',503);
    // Only remove an unreferenced upload belonging to the signed-in household.
    const rows=await db.prepare("SELECT data FROM records WHERE household_id=? AND kind='mail' AND deleted=0").bind(me.household_id).all();
    if((rows.results||[]).some(r=>r.data&&JSON.parse(r.data).mediaId===mediaId))return error('This media belongs to a saved letter.',409);
    await env.MEDIA.delete(`${me.household_id}/mail/${mediaId.toLowerCase()}`);
    return json({ok:true});
  }
  if(path==='/api/private/mail/delete'&&method==='POST'){
    const b=await bodyJSON(request),messageId=String(b.messageId||'');
    if(!messageId||messageId.length>160)return error('Invalid message.',400);
    const row=await db.prepare("SELECT data FROM records WHERE household_id=? AND kind='mail' AND id=? AND deleted=0").bind(me.household_id,messageId).first();
    if(!row)return error('This letter is unavailable.',404);
    const mail=JSON.parse(row.data||'{}');
    const mediaId=String(mail.mediaId||'');
    if(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(mediaId)&&env.MEDIA){
      await env.MEDIA.delete(`${me.household_id}/mail/${mediaId.toLowerCase()}`);
    }
    await db.prepare("UPDATE records SET data=NULL,deleted=1,updated_at=? WHERE household_id=? AND kind='mail' AND id=?").bind(Date.now(),me.household_id,messageId).run();
    return json({ok:true});
  }
  if(path==='/api/auth/recovery/new'&&method==='POST'){
    const b=await bodyJSON(request),password=String(b.password||'');
    const user=await db.prepare('SELECT salt,password_hash FROM users WHERE id=?').bind(me.user_id).first();
    if(!user||!equal(await hashPassword(password,user.salt,env.PASSWORD_PEPPER),user.password_hash))return error('Enter your current password to generate a recovery code.',403);
    const raw=hex(bytes(16)),display=raw.match(/.{4}/g).join('-'),hash=await recoveryDigest(me.email,raw,env.PASSWORD_PEPPER);
    await db.prepare('UPDATE users SET recovery_hash=? WHERE id=?').bind(hash,me.user_id).run();
    return json({ok:true,code:display,message:'Store this code securely. It is shown once, works only once, and replaces any previous recovery code.'});
  }

  if(path==='/api/hunts'&&method==='POST'){
    if(!await guardLimit(db,'hunt-create',ip,30,86400000))return error('Hunt creation limit reached. Try tomorrow.',429);
    const b=await bodyJSON(request),mode=['easy','family','mega','standalone'].includes(b.mode)?b.mode:null;
    if(!mode)return error('Choose Standalone Hunt or Mega Hunt.');
    const photoMode=b.photoMode===true;
    if(photoMode&&!env.MEDIA)return error('Photo Hunt needs private R2 MEDIA storage.',503);
    const title=String(b.title||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,65) || (mode==='mega'?'Mega Lights Competition':'Christmas Lights Hunt');
    const theme=String(b.theme||'random'),playMode=b.playMode==='solo'?'solo':'competition';
    const themes=Object.keys(NIGHT_THEMES);
    if(mode==='standalone'&&theme!=='random'&&!themes.includes(theme))return error('Choose a theme or Random Mix.');
    const defaultCharacters=['Mickey Mouse','Winnie-the-Pooh','The Grinch','Snoopy','Olaf'];
    let characters=mode==='mega'?(Array.isArray(b.characters)?b.characters:defaultCharacters):[];
    if(mode==='mega'&&(characters.length!==5||characters.some(x=>typeof x!=='string'||!x.trim()||x.trim().length>40||/[<>\x00-\x1f]/.test(x))||new Set(characters.map(x=>x.trim().toLowerCase())).size!==5))return error('Choose five different characters (up to 40 characters each).');
    // Canonicalize known alternate names before checking for duplicate choices.
    if(mode==='mega'){const aliases={'bumble':'The Abominable Snow Monster','gingerbread-man':'Gingerbread person','winnie-the-pooh-and-piglet':'Winnie-the-Pooh'};characters=characters.map(name=>aliases[decSlug(name)]||name.trim());}
    const huntId=hex(bytes(16)),raw=hex(bytes(16)),now=Date.now();
    if(mode==='mega'&&characters.some(c=>DEC_BASE.filter(Boolean).some(n=>decSlug(c)===decSlug(DEC_REPLACEMENTS[n]||n))||DEC_EXTRA.some(([n,category])=>category!=='Characters'&&n!=='Rudolph'&&decSlug(c)===decSlug(DEC_REPLACEMENTS[n]||n))))return error('Choose characters that are not already fixed Mega clues.');
    if(mode==='mega'&&new Set(characters.map(decSlug)).size!==5)return error('Choose five distinct characters.');
    if(mode==='mega'||mode==='standalone')await ensureHuntHQTables(db);
    if(mode==='mega'&&photoMode){try{await ensureDecemberPhotoCapacity(db)}catch(e){console.error('December Mega photo setup:',e);return error('Photo Hunt setup could not complete safely. Your existing photos were not intentionally changed. Contact the site administrator.',503)}}
    const seasonYear=new Date(now-6*3600000).getUTCFullYear(),seasonMonth=new Date(now-6*3600000).getUTCMonth();
    const expiresAt=mode==='mega'?validMegaDeadline(b.endAt??null,now):now+30*86400000;
    if(expiresAt===null)return error('Choose an end date in the future.',400);
    const seed=mode==='mega'?'mega-v4-'+raw+'~'+encodeURIComponent(JSON.stringify({characters,photoMode})):(photoMode?'photo-v1-':'')+raw;
    const storedMode=mode==='mega'?'family':mode==='standalone'?'easy':mode;
    const clues=mode==='standalone'?themedClues(theme,raw,[]).map(({megaIndex,...c})=>c):[];
    const insertHunt=db.prepare('INSERT INTO hunts(id,household_id,mode,seed,created_at,expires_at) VALUES(?,?,?,?,?,?)')
      .bind(huntId,me.household_id,storedMode,seed,now,expiresAt);
    if(mode==='mega'||mode==='standalone'){
      const insertCollection=db.prepare('INSERT INTO hunt_collections(hunt_id,title,kind,theme,play_mode,clues_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(huntId,title,mode,theme,playMode,JSON.stringify(clues),now);
      await db.batch([insertHunt,insertCollection]); // atomic: no orphan hunt if migration missing
    }else await insertHunt.run();
    return json({ok:true,hunt:{id:huntId,mode,title,theme,playMode,seed,photoMode,characters,clues,expiresAt,endAt:mode==='mega'&&expiresAt!==NO_MEGA_DEADLINE?expiresAt:null,ended:false,clueCount:mode==='mega'?125:mode==='standalone'?clues.length:mode==='family'?16:9,goal:mode==='mega'?100:undefined}});
  }
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
  if(path==='/api/private/amazon-lookup'&&method==='POST'){
    const body=await bodyJSON(request);
    if(typeof body.link!=='string'||body.link.length>2048)return error('Paste an Amazon product link.');
    if(!dataForSeoReady(env))return error('Amazon lookup needs DataForSEO credentials in Cloudflare.',503);
    if(!await checkAmazonLookupLimit(db,family))return error('Amazon lookup limit reached. Try again later.',429);
    const product=await resolveAmazonProduct(body.link).catch(()=>null);
    if(!product)return error('Could not open that Amazon link. Try copying the full product URL from Safari.',422);
    const listing=await fetchAmazonListing(product,env);
    return listing.error?error(listing.error,listing.status):json({ok:true,...listing});
  }
  if(path==='/api/private/price-check'&&method==='POST'){
    const body=await bodyJSON(request),giftId=String(body.giftId||'');
    if(!giftId||giftId.length>160)return error('Select a gift to check.',400);
    // Only the signed-in household's gift URL can be checked. Never accept an arbitrary URL.
    const record=await db.prepare("SELECT data FROM records WHERE household_id=? AND kind='gift' AND id=? AND deleted=0").bind(family,giftId).first();
    if(!record?.data)return error('Gift not found in your family.',404);
    let gift;try{gift=JSON.parse(record.data)}catch{return error('Gift record is unavailable.',422)}
    if(['Bought','Ordered','Arrived','Wrapped'].includes(gift.status))return error('This gift is already purchased.',422);
    let product=detectPriceProduct(gift.link);
    if(!product){
      if(!await guardLimit(db,'price-link-resolution',family,40,3600000))return error('Price refresh limit reached. Try again later.',429);
      product=await resolveAmazonProduct(gift.link).catch(()=>null);
    }
    if(!product)return error('Automatic refresh is not available for this store or product link. Use View at store.',422);
    if(product.store!=='Amazon'&&!gift.watchDeal)return error('Turn on Deal Watch for this gift first.',422);
    if(product.store==='Amazon'&&dataForSeoReady(env)){
      if(!await checkAmazonLookupLimit(db,family))return error('Amazon lookup limit reached. Try again later.',429);
    }else{
      if((product.store==='Amazon'&&!env.KEEPA_API_KEY)||(product.store==='Best Buy'&&!env.BEST_BUY_API_KEY)){
        return error(`${product.store} price lookup has not been configured. Use View at store for now.`,503);
      }
      if(!await guardLimit(db,'price-check',family,50,3600000))return error('Price refresh limit reached for your family. Try again in an hour.',429);
    }
    const quote=await fetchPriceQuote(product,env);
    return quote.error?error(quote.error,quote.status||422):json({ok:true,...quote});
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
    const p=await profile(db,family);
    const make=(ids,stages)=>Array.from(new Set(ids.filter(x=>typeof x==='string'))).map(x=>gifts.get(x)).filter(g=>g&&stages.includes(g.status)).map(g=>({id:String(g.id).slice(0,160),name:String(g.name||'Gift').slice(0,160),recipient:(Array.isArray(p.children)?p.children.map(c=>String(c.id)):['1','2']).includes(String(g.kid))?String(g.kid):g.kid==='both'?'both':'unassigned'}));
    const visibleIdeas=make(ideas,['Idea','To buy']);
    const visibleBag=make(bag,['Bought','Ordered','Arrived','Wrapped']);
    const data={familyName:String(p.familyName||'A Santa HQ family').slice(0,70),child1:String(p.child1||'Child 1').slice(0,50),child2:String(p.child2||'Child 2').slice(0,50),children:Array.isArray(p.children)?p.children.map(c=>({id:String(c.id).slice(0,2),name:String(c.name||'Child').slice(0,50),icon:['star','heart','flower','moon','sparkle','snow','elf-purple-girl','elf-pink-girl','elf-red-girl','elf-lilac-girl','elf-green-boy','elf-blue-boy','elf-teal-boy','elf-navy-boy','elf-gold','elf-mint','elf-coral','elf-classic'].includes(c.icon)?c.icon:'star'})):undefined,profiles:(Array.isArray(p.children)?p.children:[]).filter(c=>c&&c.shareFavorites===true).map(c=>({id:String(c.id||'').slice(0,2),name:String(c.name||'Child').slice(0,50),interests:String(c.interests||'').slice(0,350),favorites:String(c.favorites||'').slice(0,350),favoriteColors:String(c.favoriteColors||'').trim().slice(0,120),favoriteCharacters:String(c.favoriteCharacters||'').trim().slice(0,120),favoriteActivities:String(c.favoriteActivities||'').trim().slice(0,120),favoriteThings:String(c.favoriteThings||'').trim().slice(0,120)})).filter(c=>c.name&&(c.interests||c.favorites||c.favoriteColors||c.favoriteCharacters||c.favoriteActivities||c.favoriteThings)).slice(0,6),ideas:visibleIdeas,bag:visibleBag,updatedAt:new Date().toISOString()};
    const existing=await db.prepare('SELECT share_id FROM public_lists WHERE household_id=?').bind(family).first();
    const shareId=existing?.share_id||id();
    await db.prepare(`INSERT INTO public_lists(household_id,share_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(household_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`).bind(family,shareId,JSON.stringify(data),Date.now()).run();
    // Claims are attached to wishlist items only. Remove obsolete claims when unpublished.
    const oldClaims=await db.prepare('SELECT gift_id FROM public_claims WHERE household_id=?').bind(family).all();
    const allowed=new Set(visibleIdeas.map(g=>g.id));
    for(const claim of oldClaims.results||[]){if(!allowed.has(claim.gift_id))await db.prepare('DELETE FROM public_claims WHERE household_id=? AND gift_id=?').bind(family,claim.gift_id).run();}
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
      try{return await handleApi(request,env,url)}catch(e){console.error('Santa HQ API:',request.method,url.pathname,e);if(e instanceof SyntaxError)return error('Invalid JSON.',400);if(['Request is too large.','Invalid request body.'].includes(e?.message))return error(e.message,400);return error('An unexpected server error occurred.',500)}
    }
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
