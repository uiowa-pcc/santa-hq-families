# Santa HQ — Save Santa Mail wishes as Gift Ideas

This update builds on **Santa_HQ_Delete_Hunt_Error_Fix_Full.zip**. It keeps all the preceding Hunt HQ, Photo Hunt, Archive/Delete, and gift-board changes.

## New feature

- Every incoming Santa letter has an adult-only **Add as gift idea** button inside **Santa Mail → Santa inbox**.
- Opens the existing gift editor, automatically selecting the child who sent the letter and the **Idea** status, with **Santa** as the initial giver and category **Regular gift**. By default it is saved to the **Ideas** tray; you can opt out of that during review. You can change the name, recipient, category, notes, price, and other fields before saving.
- For an unambiguous one-item written wish (e.g. “I want a rainbow science kit”), a suggested gift name is filled in. For longer or multi-item letters and voice/photo/drawing messages, the name stays editable/blank. The original letter text or a reference to the original media is placed in **Notes**, and notes are expanded for review.
- The source letter ID is saved with each gift so Santa Mail can show **1 gift idea saved**, **2 gift ideas saved**, etc. You can add as many *different* gift ideas as needed from the same letter; saving the exact same name again from that letter asks for confirmation.
- The Gift Board displays **From Santa letter** on these ideas. The original message remains untouched. Deleting a message does not automatically delete any saved gifts, and vice versa.
- The button, gift details, budgets and source labels are *only* on the grown-up side. **Kid View is unchanged**; the child cannot see what was saved from their letter.
- Gifts use the **existing gift database and family sync**. No new D1 tables, SQL, Cloudflare secrets or R2 configuration are required.

## Recommended installation (small patch)

1. From Santa HQ **Settings**, save a gifts backup. Copy your current working GitHub commit ID.
2. Extract `Santa_HQ_Santa_Mail_Gift_Ideas_Patch.zip` and upload **index.html** and **sw.js** to the ROOT of the existing `uiowa-pcc/santa-hq-families` GitHub repo. Replace the versions already there, and commit.
3. Let Cloudflare deploy. Reopen the app or hard-refresh to load the updated service worker.
4. Open **Santa Mail → Santa inbox**. Select **Add as gift idea** on a letter. Edit the wish name and any details, then tap **Add gift**. The entry will appear in **Plan Gifts → Ideas**.

Use the **full combined ZIP** only if the previous latest release has not been installed. It includes the existing previous migrations and assets; do not rerun migrations you already ran. Uploaded `hunt-images` photos are unaffected.

## Behavior notes

- This intentionally **does not parse all wishes automatically**: a written letter may include many gifts, and a voice or drawing cannot be reliably read without transcription. One save = one gift; tap **Add another gift idea** for additional wishes.
- Nothing is saved until the adult confirms the gift editor.
- Existing gifts, Santa Mail, and other families' records are never bulk replaced by this patch.
- If Cloudflare family sync is disconnected, new ideas save locally just like manually added gifts and sync according to the app's existing behavior.

## QA

Local JavaScript syntax checks and isolated UI/logic tests completed. The full release preserves previous Worker code and SQL files byte-for-byte. Not deployed to the live family's Cloudflare account.
