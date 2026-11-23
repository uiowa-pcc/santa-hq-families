/**
 * Santa HQ Families — Cloudflare Workers build helper.
 * Supports the GitHub upload layout where all files are at the repository root.
 * Copies ONLY public website assets into public/; worker.js and private source
 * files must never be exposed as static files.
 */
import { access, copyFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const websiteFiles = [
  'index.html', 'santa-hq-design.css', 'santa-hq-details.css', 'santa-home.webp', 'kid-santa-new.webp', 'kid-view-recording-fix.js', 'north-pole-adventure.js', 'family.html', 'family-hq.js', 'family-sync.js', 'sw.js', 'hunt.html', 'hunt.js', 'hunt-photos.webp', 'elf-avatars.webp'
];
const artworkFiles = [
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'art/crayons.svg', 'art/elf.svg', 'art/letter.svg', 'art/mailbox.svg',
  'art/microphone.svg', 'art/ornament.svg', 'art/present.svg',
  'art/santa-full.svg', 'art/santa-peek.svg', 'art/stocking.svg', 'art/tree.svg'
];
const originalRepository = 'https://raw.githubusercontent.com/uiowa-pcc/santa-hq/main/';
const exists = async path => { try { await access(path); return true; } catch { return false; } };

await mkdir('public', { recursive: true });
websiteFiles.push('kid-view-recording-fix.js', 'north-pole-adventure.js');
websiteFiles.push('hunt-print.html', 'hunt-print.js');
websiteFiles.push('mega-hunt-picker-upgrade.js');
for (const file of websiteFiles) {
  const destination = join('public', file);
  if (await exists(file)) {
    await copyFile(file, destination);
    console.log(`Website: ${file} → public/${file}`);
  } else if (await exists(destination)) {
    console.log(`Website already in public/: ${file}`);
  } else {
    throw Error(`Missing ${file}. Upload it to the main GitHub repository folder.`);
  }
}

// The SQL file was uploaded to the root; put a copy where Wrangler expects it.
for (const migration of ['0001_multifamily.sql', '0002_account_security.sql', '0003_shared_hunts.sql', '0004_hunt_photos.sql', '0005_hunt_hq.sql', '0006_hunt_collections.sql']) {
  if (await exists(migration)) {
    await mkdir('migrations', { recursive: true });
    await copyFile(migration, join('migrations', migration));
    console.log(`Database migration copied: ${migration}`);
  }
}

for (const file of artworkFiles) {
  const destination = join('public', file);
  if (await exists(destination)) continue;
  if (await exists(file)) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
    console.log(`Artwork: ${file} → public/${file}`);
    continue;
  }
  const response = await fetch(originalRepository + file).catch(error => {
    throw Error(`Could not download artwork ${file}: ${error.message}`);
  });
  if (!response.ok) throw Error(`Cannot download artwork ${file} (HTTP ${response.status}).`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  console.log(`Downloaded artwork: ${file}`);
}
// Optional family-chosen Christmas lights hunt photos. Upload JPG/PNG/WebP
// directly to hunt-images/ in GitHub. Every deployment picks up new files,
// without hard-coding individual image names into the application.
await mkdir('public/hunt-images', { recursive: true });
const imageMap = {};
if (await exists('hunt-images')) {
  const names = (await readdir('hunt-images')).sort();
  for (const name of names) {
    const match = name.match(/^(.+)\.(webp|png|jpe?g)$/i);
    if (!match) continue; // Ignore notes, hidden files, and unsupported formats.
    // GitHub photo filenames may have spaces and capital letters. Normalize
    // their published names so the app still matches the clue automatically.
    const key = match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!key || key.length > 100) continue;
    const publishedName = `${key}.${match[2].toLowerCase()}`;
    if (imageMap[key]) {
      console.warn(`Hunt image ${name} skipped: ${key} already has a photo. Remove the old extension first.`);
      continue;
    }
    await copyFile(join('hunt-images', name), join('public/hunt-images', publishedName));
    imageMap[key] = `./hunt-images/${publishedName}`;
    console.log(`Hunt photo: ${name} → public/hunt-images/${publishedName}`);
  }
}
await writeFile('public/hunt-images/manifest.json', JSON.stringify(imageMap, null, 2));
console.log(`Santa HQ hunt photos ready: ${Object.keys(imageMap).length} optional images.`);

console.log('Santa HQ website assets prepared. Ready for Wrangler deployment.');
