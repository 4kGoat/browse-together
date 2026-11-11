# Browse Together

Browse the web together with friends: one person shares a browser tab, everyone sees it live, and (optionally) everyone can control it. Includes chat, live cursors, drawing and image/GIF stickers.

**Open it:** https://4kgoat.github.io/browse-together/

## How to use

1. Open the link, type your name and click **Start a room**.
2. Click the room code at the top to copy an invite link, and send it to your friends. When someone opens it, a card asks you to **Let in** or **Decline** them. Click **×** on someone's name to remove them later.
3. Click **Share my tab** and pick the browser tab everyone should see. In Chrome or Edge, choose the "Tab" option and tick "Share tab audio".

Everyone can chat, point, **Draw**, and **Add sticker** (or paste an image or image link with Ctrl+V, or drop one onto the view).

**Embedded site** loads a website inside the room for everyone at once, but only works on sites that allow it (YouTube, Wikipedia…). For sites like X or Instagram, share a tab instead.

## Letting friends control the shared tab (host only)

Friends don't need anything extra. Only the person whose tab is shared needs this:

1. Install [Tampermonkey](https://www.tampermonkey.net/). On newer Chrome, also turn on **Allow User Scripts** in Tampermonkey's extension details.
2. Set up tab control: open [browse-together-control.user.js](https://raw.githubusercontent.com/4kGoat/browse-together/main/browse-together-control.user.js) and click **Install**. It updates itself from this repo.
3. Keep the room page open and click **Share my tab**. The tab you share shows a popup in its bottom-right corner: click **Connect**. (If it doesn't appear, open the Tampermonkey menu in that tab and choose **Let my room control this tab**, or press **Alt+Shift+B** there.)
4. The host can always click, scroll, type and open sites from the room. Turn on **Let friends control** to let everyone else do it too.

Friends act as you in the controlled tab, so only share a tab (or browser profile) you're happy for them to click around in.

## If something doesn't work

- **You can't see a friend's tab.** The room retries a few times, then says "Can't get …'s video" with a **Try again** button. If it keeps failing, something between your two networks (a strict router, school or work network, VPN) is blocking the video. Try turning off a VPN, or have one of you switch network (for example a phone hotspot).
- **No Connect button appears in the tab you share.** Tampermonkey only runs in tabs opened or reloaded after the script was installed or updated, so reload that tab. Also make sure you picked a **Chrome tab**, not a window or your whole screen. You can always press **Alt+Shift+B** in the tab instead.
- **Tab control says it's out of date.** Click **Update tab control** in the room, then reload the room and the tab you share.

## How it works

- `index.html` is the whole app. Connections go directly between browsers (WebRTC via [PeerJS](https://peerjs.com/)); there's no server of its own.
- `browse-together-control.user.js` is the Tampermonkey script, compiled from `browse-together-control.user.ts`:
  ```
  npx -p typescript tsc --target es2020 --lib es2020,dom --strict browse-together-control.user.ts
  ```
  Then keep the `// ==UserScript==` header as the first lines of the output.
