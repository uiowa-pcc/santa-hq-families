import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import worker from './worker.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(path.join(root,'0001_multifamily.sql'),'utf8'));sql.exec(readFileSync(path.join(root,'0002_account_security.sql'),'utf8'));
class D1Statement {
 constructor(text,args=[]){this.text=text;this.args=args}
 bind(...args){return new D1Statement(this.text,args)}
 async first(){return sql.prepare(this.text).get(...this.args)||null}
 async all(){return {results:sql.prepare(this.text).all(...this.args)}}
 async run(){const r=sql.prepare(this.text).run(...this.args);return {meta:{changes:r.changes}}}
}
const env={DB:{prepare:s=>new D1Statement(s),batch:async statements=>{
 sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}
}},PASSWORD_PEPPER:'long-test-only-secret-string',ASSETS:{fetch:async()=>new Response('ok')}};
const BASE='https://santa.test';
async function api(route,body,token,origin=BASE){
 const headers={};if(token)headers.Cookie=`__Host-santa_session=${token}`;
 if(body!==undefined){headers.Origin=origin;headers['Content-Type']='application/json'}
 const r=await worker.fetch(new Request(BASE+route,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 let data;try{data=await r.json()}catch{data={}}
 const ck=r.headers.get('Set-Cookie')?.match(/__Host-santa_session=([a-f0-9]{64})/)?.[1];
 return {status:r.status,data,token:ck};
}
const a=await api('/api/auth/register',{email:'a@example.org',password:'very-secure-strong-password',familyName:'Family Alpha',child1:'Riley',child2:'Quinn',budget1:200,budget2:300});
assert.equal(a.status,201,JSON.stringify(a));assert(a.token);
assert.equal(a.data.profile.child1,'Riley');
const b=await api('/api/auth/register',{email:'b@example.org',password:'another-very-secure-password',familyName:'Family Beta',child1:'Will',child2:'Jane'});
assert.equal(b.status,201,JSON.stringify(b));assert(b.token);
assert.notEqual(a.data.family.id,b.data.family.id);
const rejected=await api('/api/private/state');assert.equal(rejected.status,401);
assert.equal((await api('/api/private/write',{kind:'gift',id:'both-households-same-id',data:{id:'both-households-same-id',name:'Alpha Secret',price:99,notes:'Secret hiding place'},deleted:false},a.token)).status,200);
assert.equal((await api('/api/private/write',{kind:'gift',id:'both-households-same-id',data:{id:'both-households-same-id',name:'Beta Secret',price:22},deleted:false},b.token)).status,200);
let x=await api('/api/private/state',undefined,a.token);assert.equal(x.data.records.find(r=>r.kind==='gift').data.name,'Alpha Secret');
x=await api('/api/private/state',undefined,b.token);assert.equal(x.data.records.find(r=>r.kind==='gift').data.name,'Beta Secret');
assert.equal((await api('/api/private/write',{kind:'gift',id:'bad',data:{id:'bad',name:'attack'}},a.token,'https://evil.example')).status,403);
const iv=await api('/api/auth/invite',{},a.token);assert.equal(iv.status,200,JSON.stringify(iv));
const inviteToken=new URL(iv.data.inviteUrl).searchParams.get('invite');
const c=await api('/api/auth/register',{email:'caregiver@example.org',password:'third-secure-long-password',invite:inviteToken});
assert.equal(c.status,201,JSON.stringify(c));assert.equal(c.data.family.id,a.data.family.id);
assert.equal((await api('/api/auth/register',{email:'another@example.org',password:'another-strong-password',invite:inviteToken})).status,400);
assert.equal((await api('/api/auth/invite',{},c.token)).status,403);
const p=await api('/api/family/publish',{ideas:['both-households-same-id'],bag:[]},a.token);assert.equal(p.status,200,JSON.stringify(p));
const publicResult=await api('/api/public/list?share='+p.data.shareId);
assert.equal(publicResult.status,200);assert.equal(publicResult.data.list.ideas[0].name,'Alpha Secret');
assert(!JSON.stringify(publicResult.data).includes('99'));assert(!JSON.stringify(publicResult.data).includes('Secret hiding place'));
const claim=await api('/api/public/claim',{share:p.data.shareId,giftId:'both-households-same-id',name:'Grandma'});assert.equal(claim.status,200,JSON.stringify(claim));
assert.equal((await api('/api/public/claim',{share:p.data.shareId,giftId:'both-households-same-id',name:'Aunt'})).status,409);
assert.equal((await api('/api/family/list',undefined,b.token)).data.list,null);
const settingsWrite=await api('/api/private/write',{kind:'profile',id:'main',data:{familyName:'Family Alpha',child1:'Riley',child2:'Quinn',budget1:250,budget2:200,traditions:[{id:'t1',name:'Gingerbread house'}]},deleted:false},a.token);
assert.equal(settingsWrite.status,200);
const settingsA=(await api('/api/private/state',undefined,a.token)).data.records.find(x=>x.kind==='profile');
const settingsB=(await api('/api/private/state',undefined,b.token)).data.records.find(x=>x.kind==='profile');
assert.equal(settingsA.data.traditions[0].name,'Gingerbread house');
assert.notDeepEqual(settingsA.data,settingsB.data);
assert.equal((await api('/api/auth/logout',{},a.token)).status,200);
assert.equal((await api('/api/private/state',undefined,a.token)).status,401);
assert.equal((await api('/api/auth/login',{email:'a@example.org',password:'very-secure-strong-password'})).status,200);
assert.equal((await api('/api/auth/login',{email:'a@example.org',password:'wrongpass'})).status,401);
assert(sql.prepare('SELECT * FROM users WHERE email=?').get('a@example.org').password_hash!=='very-secure-strong-password');
console.log('PASS: two family registrations, privacy isolation, invite, cookies, origin protection, profile and traditions isolation, published list sanitization, claims, sign-out and login.');

// Account-security regression: existing accounts survive; credentials never leak across families.
const messages=[];
env.EMAIL={send:async(message)=>{messages.push(message);return {messageId:'local-mock-'+messages.length}}};
env.EMAIL_FROM='noreply@verified.example';
const caps=await api('/api/auth/capabilities');assert.equal(caps.data.emailEnabled,true);
const newFamily=await api('/api/auth/register',{email:'verified@example.org',password:'new-family-password-long',familyName:'Verified Family',child1:'Alex',child2:'Jordan'});
assert.equal(newFamily.status,201,JSON.stringify(newFamily));assert.equal(newFamily.data.verificationPending,true);assert.equal(newFamily.token,undefined);
assert.equal((await api('/api/auth/login',{email:'verified@example.org',password:'new-family-password-long'})).status,403);
assert.equal(messages.length,1);
const verifyToken=new URL(messages.at(-1).text.match(/https:\/\/[^\s]+\?verify=[0-9a-f]+/)[0]).searchParams.get('verify');
assert.equal((await api('/api/auth/verify',{token:verifyToken})).status,200);
assert.equal((await api('/api/auth/verify',{token:verifyToken})).status,400);
const verifiedLogin=await api('/api/auth/login',{email:'verified@example.org',password:'new-family-password-long'});
assert.equal(verifiedLogin.status,200,JSON.stringify(verifiedLogin));assert.equal(verifiedLogin.data.user.emailVerified,true);
const forgot=await api('/api/auth/forgot',{email:'verified@example.org'});assert.equal(forgot.status,200);assert.equal(messages.length,2);
const resetToken=new URL(messages.at(-1).text.match(/https:\/\/[^\s]+\?reset=[0-9a-f]+/)[0]).searchParams.get('reset');
assert.equal((await api('/api/auth/reset',{token:resetToken,password:'reset-and-strong-2026'})).status,200);
assert.equal((await api('/api/auth/reset',{token:resetToken,password:'another-strong-password'})).status,400);
assert.equal((await api('/api/private/state',undefined,verifiedLogin.token)).status,401);
assert.equal((await api('/api/auth/login',{email:'verified@example.org',password:'new-family-password-long'})).status,401);
assert.equal((await api('/api/auth/login',{email:'verified@example.org',password:'reset-and-strong-2026'})).status,200);
const rec=await api('/api/auth/recovery/new',{password:'another-very-secure-password'},b.token);
assert.equal(rec.status,200,JSON.stringify(rec));assert.match(rec.data.code,/^[0-9a-f-]{39}$/);
const recReset=await api('/api/auth/recovery/reset',{email:'b@example.org',code:rec.data.code,password:'recovered-without-email-2026'});
assert.equal(recReset.status,200,JSON.stringify(recReset));
assert.equal((await api('/api/auth/recovery/reset',{email:'b@example.org',code:rec.data.code,password:'again-a-strong-password'})).status,400);
assert.equal((await api('/api/private/state',undefined,b.token)).status,401);
assert.equal((await api('/api/auth/login',{email:'b@example.org',password:'recovered-without-email-2026'})).status,200);
assert.equal((await api('/api/auth/forgot',{email:'nonexistent@example.org'})).status,200);
console.log('PASS: additive migration, verified signup, verification expiry/one-time use, email password reset, session revocation, recovery code reset, invalid/reused code rejection, original account login.');
