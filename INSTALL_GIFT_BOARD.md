# Santa HQ Christmas Morning update

Replace these three files at the root of your existing Santa HQ repository, then commit to trigger the usual Cloudflare deployment.

- index.html
- santa-hq-details.css
- sw.js

This patch includes the simplified Gift Board and the confirmed-gifts view. It requires no Worker or database changes.

On Gift Board, open an idea and choose **Confirm Under the Tree & Add to Shopping List**. For a stocking idea, use the stocking confirmation. The gift appears both in Shopping and on Christmas Morning. Gifts already purchased keep their purchase status.

In Christmas Morning, select a pile and drag a gift by its handle or tap the gift to choose where it goes. Returning a gift to Ideas from Gift Board removes it from Christmas Morning and, if it was still to buy, from Shopping.

Tap **Confirm gift** on a Gift Board row to check it off. Confirmation uses the selected pile, or Under the Tree for an unsorted idea. Tap **Confirmed** to clear the checkmark. The gift stays in its pile and its purchase history is preserved.
