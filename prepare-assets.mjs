/**
 * Santa HQ Families — Cloudflare Workers build helper.
 * Supports the GitHub upload layout where all files are at the repository root.
 * Copies ONLY public website assets into public/; worker.js and private source
 * files must never be exposed as static files.
 */
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const websiteFiles = [
  'index.html', 'santa-hq-design.css', 'santa-hq-details.css', 'santa-home.webp', 'kid-santa-new.webp', 'family.html', 'family-hq.js', 'family-sync.js', 'sw.js', 'hunt.html', 'hunt.js', 'hunt-photos.webp', 'elf-avatars.webp'
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
for (const migration of ['0001_multifamily.sql', '0002_account_security.sql', '0003_shared_hunts.sql']) {
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
console.log('Santa HQ website assets prepared. Ready for Wrangler deployment.');
