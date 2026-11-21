# Santa HQ — Hunt HQ: Standalone + Mega, multiple groups and cross-hunt photos

This release **extends** the previous linked Hunt HQ + Photo Hunt build. It keeps existing gifts, account data, gift boards, Santa artwork, uploaded GitHub clue photos, old links and existing hunt player data.

## What's new

- **Create a Standalone Hunt or a Mega Hunt.** Every NEW Standalone Hunt is **exactly 8 clues**, either one of seven themes (Color Quest, Disney Night, Character Quest, Christmas Classics, Light Show Night, Winter Wonderland or Holiday Mix) or **Surprise me / randomized**. Existing 9/16-clue links remain playable and are not resized.
- **Mega Hunt** remains an ongoing **30-clue** hunt with five selectable characters; host can add many linked 8-clue themed nights without resetting the overall 30-clue score.
- Each hunt has its own **custom name**, invite link, participant list, scoreboard, optional photo feed and expiry. One hosting family can run **multiple concurrent and separate competitions** for different groups.
- Choose **Compete** (visible leaderboard) or **Play independently** (own progress; no public leaderboard) for either hunt type.
- Rename, **archive** and restore hunts from the family's Hunt HQ. Archived hunts are read-only but scores and previously uploaded shared photos remain viewable via their link, including after their original expiry. Existing gift records are never modified. Expired hunts cannot be restored to active play.
- While uploading a find, choose **also count in another hunt**. The choices are drawn only from OTHER unexpired, active hunts the same player **already joined on this device**, and only when a clue actually matches. An authorized player token for each other hunt is required. If the other hunt uses Photo Hunt, a **separate copy** of the JPEG is uploaded with the same per-hunt share preference; otherwise its matching clue is scored without uploading an image. Matching Mega and themed-night points are credited correctly, without duplicate Mega points. Unticked hunts get nothing. This is intentionally not automatic cross-account sharing.

## Installation — important

**Back up your gifts first, and ask any actively using friends to back theirs up.** Save the working GitHub commit ID so you can revert the app code if needed. Do not recreate, delete, replace or clear the existing Cloudflare D1 database or R2 bucket.

### If you already installed the last Hunt HQ release (`0005_hunt_hq.sql` ran)

1. Download and extract **Santa_HQ_Hunts_Standalones_Multi_Group_Patch.zip**.
2. Upload the extracted files (not the ZIP or an extra enclosing directory) to the **root** of your existing GitHub repository `uiowa-pcc/santa-hq-families`, replacing the matching files, and commit.
3. In Cloudflare **Storage & Databases → D1 → existing Santa HQ database → Console**, open `0006_hunt_collections.sql`, copy all of its SQL, paste and **Execute**. Run it once, against the same DB used by the live Worker.
4. Confirm Cloudflare deploys successfully and then close/reopen the installed app or hard-refresh. Your existing groups and gifts are preserved.

For the least disruption, it's also fine to run the SQL in D1 **before** you upload the code. Uploading the `.sql` file to GitHub alone does not run it.

### If previous Photo Hunt / Hunt HQ upgrades are not installed

Use **Santa_HQ_Hunts_Standalones_Multi_Group_Full.zip**, which contains all the previous public assets and migrations as well as this release. Upload its files to the existing repository, preserving folder paths. In the **same existing D1** Console, apply any missing migrations **in order**: `0004_hunt_photos.sql`, `0005_hunt_hq.sql`, then `0006_hunt_collections.sql`. Skip migrations already applied. These scripts add new tables and indexes; none resets gifts or family accounts.

**Do not delete photos you already uploaded to `hunt-images/`.** This ZIP does not include your personal character-photo files. The existing Cloudflare private R2 `MEDIA` binding must remain configured for Photo Hunt. No new secret or bucket is required.

## Use it

1. In Santa HQ open **Christmas Plans → Lights Hunt → Hunt HQ**.
2. Choose **Standalone** (8 clues) or **Mega** (30 clues), name it (e.g. "Bailey Family Color Quest"), select the theme for standalone, select competing or independent play, and optionally enable Photo Hunt. Mega also lets you pick five characters.
3. Create as many separate hunts as needed. Each has its own invitation link; keep them distinct for friends, cousins or your household.
4. For an active Mega, add themed mini hunts from the card. The guest link remains the same and the mini nights credit overlapping finds to the Mega scoreboard once.
5. To use a photo in another hunt, **open that other hunt link and join it on the same phone/browser first**. Later, when you photograph a matching clue, select the destination hunt under **Also count this photo in another hunt?** before saving. The option is shown only for valid, joined, matching hunts. You may select more than one. Sharing a photo with either group is optional.
6. Archive hunts when you're done. Archived links become read-only keepsakes with scores and opted-in shared photos. If still within its original duration, the host can restore one.

## Data/privacy notes

- Competitions are separated by hunt ID; account data and gifts are isolated by household ID. Cross-hunt contributions **do not happen without a checked option** and require that player's separate credential for the destination group.
- Hunt images and nicknames shared with a group can be viewed by **anyone with that hunt's link**. Avoid children's full names, identifiable faces, street addresses and car plates. Photo canvases strip EXIF/GPS data before uploading.
- A separate photo copy is stored in private R2 for every photo-enabled destination you choose. Deleting a photo from one competition does not automatically delete copies you chose to submit to other competitions; remove those individually if desired.
- The app still does not automatically purge R2 photo objects after archival/expiry; budget for photo retention/cleanup before opening the app to many unrelated groups.
- The new migration only creates the `hunt_collections` table/index. It does **not** alter `records`, gifts, account tables, or existing hunt data.

## Local verification completed

- Worker API / SQLite tests: legacy Mega links, linked-night score union, two simultaneous nights, no double Mega points, 8-clue themed standalone, 8-clue randomized standalone, independent play, multiple named groups, owner listing, rename/archive/restore, photo privacy and isolated guest tokens, gift record intact.
- Headless 390px browser test: photographed clue offers another joined, matching Mega night; checked option uploads the photo with **that** hunt's own player token and records its separate nightly find.
- JavaScript syntax checks and Cloudflare public-asset build smoke test, including copying `0006_hunt_collections.sql` to `migrations/`.

**Not yet deployed or tested on your production Cloudflare account/D1/R2.** Back up and verify on the actual site before inviting more people.
