# Bus rides

A one-page counter for how many times you’ve taken the bus.

**Live site:** https://bmwcooks.github.io/bus-rides/

Pushes to `main` run the Pages workflow. The first time, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**, then re-run **Deploy static content to Pages** (or push to `main` again).

Tap **Took the bus** to add one. **Undo** takes one back if you tapped by mistake. The count stays at zero or above.

The number is stored in this browser with `localStorage` (key: `bus-rides`). Refreshing or coming back later on the same browser keeps it. Nothing is uploaded: there is no account and no server. Another browser, another device, or cleared site data starts again at zero.
