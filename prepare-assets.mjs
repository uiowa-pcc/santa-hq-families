/** Cloudflare's GitHub build runs this; families and the site owner install NOTHING.
 *  Reuses the public artwork from the original Santa HQ repository, but
 *  stores it in this deployment rather than hotlinking images at runtime.
 *  Existing downloaded assets are never overwritten.
 */
import {mkdir,writeFile,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
const assets=[
  'manifest.webmanifest','icon-192.png','icon-512.png',
  'art/crayons.svg','art/elf.svg','art/letter.svg','art/mailbox.svg',
  'art/microphone.svg','art/ornament.svg','art/present.svg',
  'art/santa-full.svg','art/santa-peek.svg','art/stocking.svg','art/tree.svg'
];
const upstream='https://raw.githubusercontent.com/uiowa-pcc/santa-hq/main/';
let missing=0;
for(const rel of assets){
  const dest=join('public',rel);
  try{await access(dest);console.log('Keeping',rel);continue}catch{}
  const url=upstream+rel;
  let response;
  try{response=await fetch(url,{headers:{'User-Agent':'SantaHQ-FamilyBuild/1.0'}})}
  catch(err){console.error(`Cannot fetch ${rel}: ${err.message}`);missing++;continue}
  if(!response.ok){console.error(`Cannot fetch ${rel}: HTTP ${response.status}`);missing++;continue}
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,new Uint8Array(await response.arrayBuffer()));
  console.log('Copied Santa HQ artwork:',rel);
}
if(missing)throw Error(`${missing} original Santa HQ art file(s) unavailable. Check the original public GitHub repository and build log; nothing was deployed.`);
