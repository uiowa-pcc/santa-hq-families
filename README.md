# Santa HQ — Use a Santa Mail photo as the gift photo

This release builds directly on **Santa_HQ_Santa_Mail_Gift_Ideas_Full.zip** and retains previous Photo Hunt, Hunt HQ, archive/delete, Santa Mail wishes, and family-sync features.

## New behavior

- Open **Santa Mail → Santa inbox → Add as gift idea** for a photo letter.
- In the Gift photo section, see a thumbnail of the incoming photo and a **Use as gift photo** button. Click to copy it into the gift image. Edit the name, category, recipient, etc., and select **Add gift** to save.
- Drawings also offer the same option when the saved drawing is available. Videos and audio remain attached to their original message and are not used as static gift photos.
- The copy uses Santa HQ's existing 610-pixel JPEG compression and is saved with the gift's existing image field. Other devices in the same family load it through ordinary gift sync. The photo will continue to display if the original Santa Mail letter is later deleted.
- Importing is entirely optional. Upload your own photo instead at any point. No photo is copied until an adult clicks the button; no gift is saved until they submit the gift form.
- When the private original can't be fetched (e.g. signed-out session), show a useful error and leave the current gift image unchanged.
- No new SQL, Worker changes, or Cloudflare settings are needed. Kid View and other households' records are unchanged.

## Installation (small patch recommended)

1. Export a Santa HQ gift backup. Keep your latest known working GitHub commit available.
2. Extract `Santa_HQ_Santa_Mail_Photo_To_Gift_Patch.zip` and upload **index.html** and **sw.js** to the repository root, replacing the existing versions.
3. Commit and confirm Cloudflare finishes deploying. If it reports the earlier Cloudflare `10002` error, inspect the deployment log; this patch changes only static assets.
4. In the grown-up inbox, open a photo Santa letter, tap Add as gift idea, tap **Use as gift photo**, and save a named gift. The photo should appear on the Gift Board.

The full combined ZIP is for installs missing the last Santa Mail release. Do not reset your existing D1 database or rerun completed migrations.
