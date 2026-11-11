# Browse Together

Browse the web together with friends: one person shares a browser tab, everyone sees it live, and (optionally) everyone can control it. Includes chat, live cursors, drawing and image/GIF stickers.

**Open it:** https://4kgoat.github.io/browse-together/

## How to use

1. Open the link, type your name and click **Create a room**.
2. Click **Copy invite** and send the link to your friends.
3. Click **Share a tab** and pick the browser tab everyone should see. In Chrome or Edge, choose the "Tab" option and tick "Share tab audio".

Everyone can chat, point, **✏️ Draw**, and add **🖼 Stickers** (paste an image or an image link with Ctrl+V, or drop one onto the view).

The **🌐 Shared page** mode opens a website for everyone at once, but only works on sites that allow being embedded (YouTube, Wikipedia…). Use screen share for sites like X or Instagram.

## Letting friends control the shared tab (host only)

Friends don't need anything extra. Only the person whose tab is shared needs this:

1. Install [Tampermonkey](https://www.tampermonkey.net/). On newer Chrome, also turn on **Allow User Scripts** in Tampermonkey's extension details.
2. Install the control script: open [browse-together-control.user.js](https://raw.githubusercontent.com/4kGoat/browse-together/main/browse-together-control.user.js) and click **Install**. It updates itself from this repo.
3. Keep the room page open. In the tab you want to share, open the Tampermonkey menu and choose **🎮 Let my room control this tab** (or press **Alt+Shift+B** in that tab).
4. Share that tab. The host can always click, scroll, type and switch sites from the room; turn on **🎮 Guest control** to let everyone else do it too.

Friends act as you in the controlled tab, so only share a tab (or browser profile) you're happy for them to click around in.

## How it works

- `index.html` is the whole app. Connections go directly between browsers (WebRTC via [PeerJS](https://peerjs.com/)); there's no server of its own.
- `browse-together-control.user.js` is the Tampermonkey script, compiled from `browse-together-control.user.ts`:
  ```
  npx -p typescript tsc --target es2020 --lib es2020,dom --strict browse-together-control.user.ts
  ```
  Then keep the `// ==UserScript==` header as the first lines of the output.
