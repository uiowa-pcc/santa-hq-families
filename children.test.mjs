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
const childSet=(n)=>Array.from({length:n},(_,i)=>({id:String(i+1),name:['Ari','Blair','Casey','Drew','Eden','Finn'][i],icon:['star','heart','flower','moon','sparkle','snow'][i],budget:100+i*25}));
for(const n of [1,3,6]){
  const children=childSet(n),res=await api('/api/auth/register',{email:`kids${n}@example.org`,password:'very-strong-family-pass-123',familyName:`Family ${n}`,children});
  assert.equal(res.status,201,JSON.stringify(res));assert.equal(res.data.profile.children.length,n);
  assert.deepEqual(res.data.profile.children,children);
  const logged=await api('/api/auth/login',{email:`kids${n}@example.org`,password:'very-strong-family-pass-123'});
  assert.equal(logged.status,200);assert.deepEqual(logged.data.profile.children,children);
  const saved=await api('/api/private/state',undefined,res.token);
  assert.deepEqual(saved.data.records.find(r=>r.kind==='profile').data.children,children);
  const child=children[n-1];
  const wr=await api('/api/private/write',{kind:'gift',id:`gift-${n}`,data:{id:`gift-${n}`,name:'Small surprise',kid:child.id,category:'Stocking',status:'Idea',price:5,notes:'hidden'},deleted:false},res.token);assert.equal(wr.status,200);
  const pub=await api('/api/family/publish',{ideas:[`gift-${n}`],bag:[]},res.token);assert.equal(pub.status,200,JSON.stringify(pub));
  const publicList=await api('/api/public/list?share='+pub.data.shareId);
  assert.equal(publicList.data.list.children.length,n);
  assert.equal(publicList.data.list.ideas[0].recipient,child.id);
  assert.equal(publicList.data.list.children[n-1].name,child.name);
  assert(!JSON.stringify(publicList.data).includes('hidden'));
}
assert.equal((await api('/api/auth/register',{email:'invalid@example.org',password:'very-strong-family-pass-123',familyName:'Invalid',children:[]})).status,400);
console.log('PASS: 1, 3, 6 children signup, profile persistence, login, household gift recipients, public list names, privacy.');
