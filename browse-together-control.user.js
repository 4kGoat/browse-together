// ==UserScript==
// @name         Browse Together – Tab Control
// @namespace    browse-together
// @version      2.6.0
// @homepageURL  https://github.com/4kGoat/browse-together
// @updateURL    https://raw.githubusercontent.com/4kGoat/browse-together/main/browse-together-control.user.js
// @downloadURL  https://raw.githubusercontent.com/4kGoat/browse-together/main/browse-together-control.user.js
// @description  Lets friends in your Browse Together room click, scroll and type in this tab.
// @match        *://*/*
// @match        file:///*
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==
"use strict";
(() => {
    const isRoomPage = !!document.querySelector('meta[name="browse-together"]');
    let room = '';
    let control = false;
    let lastBeat = 0; // last heartbeat from the room page
    let myToken = ''; // identifies this tab when it has been chosen
    let active = false; // this tab is the one friends control
    const live = () => Date.now() - lastBeat < 6000;
    let badgeHost = null;
    let badgeBox = null;
    let badgeText = null;
    let badgeActions = null;
    function ensureBadge() {
        if (badgeHost)
            return;
        badgeHost = document.createElement('div');
        badgeHost.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;';
        const root = badgeHost.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
      .b{display:flex;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 28px));
         font:600 13px/1.35 Figtree,system-ui,-apple-system,'Segoe UI',sans-serif;color:#efeaff;
         background:#231e31f2;border:1px solid #3a3252;border-radius:12px;padding:8px 8px 8px 12px;
         box-shadow:0 8px 28px #0008}
      .d{width:9px;height:9px;border-radius:50%;background:#a49bbf;flex:none}
      .on .d{background:#83dba8} .err .d{background:#ff6f7d} .wait .d{background:#ffc24b}
      .offer{border-color:#ffc24b;padding:10px 10px 10px 14px}
      .offer .d{background:#ffc24b;box-shadow:0 0 0 4px #ffc24b33}
      .t{flex:1}
      .a{display:flex;gap:6px;flex:none}
      button{font:inherit;font-size:12.5px;background:#2c2640;color:inherit;border:1px solid #3a3252;border-radius:8px;padding:5px 10px;cursor:pointer}
      button:hover{background:#3a3254}
      button.p{background:#ffc24b;border-color:#ffc24b;color:#2b1d00}
      button.p:hover{background:#ffd27a}
      button:focus-visible{outline:2px solid #93a5ff;outline-offset:2px}
      @media (prefers-reduced-motion:no-preference){.offer{animation:pop .25s ease-out}}
      @keyframes pop{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}`;
        badgeBox = document.createElement('div');
        badgeBox.setAttribute('role', 'status');
        const dot = document.createElement('span');
        dot.className = 'd';
        badgeText = document.createElement('span');
        badgeText.className = 't';
        badgeActions = document.createElement('span');
        badgeActions.className = 'a';
        badgeBox.append(dot, badgeText, badgeActions);
        root.append(style, badgeBox);
        document.documentElement.appendChild(badgeHost);
    }
    function setBadge(text, state, actions = [{ label: 'Stop', run: stop }]) {
        ensureBadge();
        const changed = badgeBox.className !== 'b ' + state;
        badgeText.textContent = text;
        badgeBox.className = 'b ' + state;
        if (changed || badgeActions.childElementCount !== actions.length) {
            badgeActions.textContent = '';
            for (const act of actions) {
                const btn = document.createElement('button');
                btn.textContent = act.label;
                if (act.primary)
                    btn.className = 'p';
                btn.addEventListener('click', act.run);
                badgeActions.append(btn);
            }
        }
    }
    function refreshBadge() {
        if (offer)
            return; // the connect prompt stays until answered
        if (!myToken) {
            removeBadge();
            return;
        }
        if (!active)
            setBadge('Another tab is the controlled tab', 'err', [{ label: 'Use this tab', primary: true, run: choose }, { label: 'Stop', run: stop }]);
        else if (!live())
            setBadge('Waiting for your Browse Together room page…', 'wait');
        else if (control)
            setBadge('Friends can control this tab (room ' + room + ')', 'on');
        else
            setBadge('The host can control this tab (room ' + room + ')', 'on');
    }
    function removeBadge() {
        badgeHost?.remove();
        badgeHost = badgeBox = badgeText = badgeActions = null;
    }
    // ------------------------------------------------- room page → this tab
    function stop() {
        GM_saveTab({});
        if (myToken && GM_getValue('bt-target', '') === myToken)
            GM_setValue('bt-target', '');
        myToken = '';
        active = false;
        offer = null;
        removeBadge();
    }
    const unit = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    };
    const clampN = (v, max) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(-max, Math.min(max, n)) : 0;
    };
    function readState(v) {
        if (!v || typeof v !== 'object')
            return;
        const st = v;
        control = !!st.control;
        room = String(st.room || '').slice(0, 12);
        lastBeat = Number(st.t) || 0;
    }
    let lastSeq = 0;
    let lastWriter = null;
    function onInputBatch(v) {
        if (!v || typeof v !== 'object')
            return;
        const batch = v;
        if (!Array.isArray(batch.items))
            return;
        const newWriter = batch.w !== lastWriter;
        lastWriter = batch.w;
        const now = Date.now();
        for (const it of batch.items) {
            if (!it || typeof it.seq !== 'number')
                continue;
            if (newWriter ? now - (Number(it.t) || 0) > 1500 : it.seq <= lastSeq)
                continue;
            // The room page already decided who may control; just check this tab is the chosen one.
            if (active && live() && it.msg && typeof it.msg === 'object')
                onMsg(it.msg);
        }
        lastSeq = Number(batch.seq) || 0;
    }
    function onMsg(m) {
        switch (m.type) {
            case 'ptr':
                if (m.mode === 'screen' && !m.hide)
                    onMove(unit(m.x), unit(m.y));
                break;
            case 'input':
                try {
                    switch (m.t) {
                        case 'down':
                            onDown(unit(m.x), unit(m.y), Number(m.b) || 0);
                            break;
                        case 'up':
                            onUp(unit(m.x), unit(m.y), Number(m.b) || 0);
                            break;
                        case 'wheel':
                            onWheel(unit(m.x), unit(m.y), clampN(m.dx, 3000), clampN(m.dy, 3000));
                            break;
                        case 'key':
                            onKey(m);
                            break;
                        case 'nav': {
                            let u = null;
                            try {
                                u = new URL(String(m.url));
                            }
                            catch { /* bad link */ }
                            if (u && (u.protocol === 'https:' || u.protocol === 'http:'))
                                location.assign(u.href);
                            break;
                        }
                        case 'back':
                            history.back();
                            break;
                        case 'fwd':
                            history.forward();
                            break;
                        case 'reload':
                            location.reload();
                            break;
                    }
                }
                catch (err) {
                    console.warn('[Browse Together]', err);
                }
                break;
        }
    }
    // ------------------------------------------------------- hit testing
    function at(x, y) {
        let win = window;
        let cx = x * window.innerWidth;
        let cy = y * window.innerHeight;
        let el = document.elementFromPoint(cx, cy);
        for (let depth = 0; el && depth < 12; depth++) {
            if (el.shadowRoot) {
                const inner = el.shadowRoot.elementFromPoint(cx, cy);
                if (inner && inner !== el) {
                    el = inner;
                    continue;
                }
            }
            if (el.tagName === 'IFRAME') {
                const f = el;
                let doc = null;
                try {
                    doc = f.contentDocument;
                }
                catch { /* cross-origin */ }
                if (doc && f.contentWindow) {
                    const r = f.getBoundingClientRect();
                    const nx = cx - r.left - f.clientLeft;
                    const ny = cy - r.top - f.clientTop;
                    const inner = doc.elementFromPoint(nx, ny);
                    if (inner) {
                        cx = nx;
                        cy = ny;
                        win = f.contentWindow;
                        el = inner;
                        continue;
                    }
                }
            }
            break;
        }
        if (!el || el === badgeHost)
            return null;
        return { el, cx, cy, win };
    }
    function deepActive() {
        let a = document.activeElement;
        for (let depth = 0; a && depth < 12; depth++) {
            if (a.shadowRoot && a.shadowRoot.activeElement) {
                a = a.shadowRoot.activeElement;
                continue;
            }
            if (a.tagName === 'IFRAME') {
                try {
                    const d = a.contentDocument;
                    if (d && d.activeElement && d.activeElement !== d.body) {
                        a = d.activeElement;
                        continue;
                    }
                }
                catch { /* cross-origin */ }
            }
            break;
        }
        return a;
    }
    // ----------------------------------------------------------------- mouse
    let pressed = 0;
    let hoverEl = null;
    let downEl = null;
    let lastClick = { t: 0, el: null };
    const BUTTON_MASK = [1, 4, 2];
    function mouse(h, type, button = 0, extra = {}) {
        const init = {
            bubbles: true, cancelable: true, composed: true,
            clientX: h.cx, clientY: h.cy, screenX: h.cx, screenY: h.cy,
            button, buttons: pressed, ...extra,
        };
        const ev = type.startsWith('pointer')
            ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true })
            : new MouseEvent(type, init);
        return h.el.dispatchEvent(ev);
    }
    function onMove(x, y) {
        const h = at(x, y);
        if (!h)
            return;
        if (h.el !== hoverEl) {
            if (hoverEl && hoverEl.isConnected) {
                const old = { ...h, el: hoverEl };
                mouse(old, 'pointerout');
                mouse(old, 'mouseout');
                mouse(old, 'pointerleave', 0, { bubbles: false });
                mouse(old, 'mouseleave', 0, { bubbles: false });
            }
            mouse(h, 'pointerover');
            mouse(h, 'mouseover');
            mouse(h, 'pointerenter', 0, { bubbles: false });
            mouse(h, 'mouseenter', 0, { bubbles: false });
            hoverEl = h.el;
        }
        mouse(h, 'pointermove');
        mouse(h, 'mousemove');
    }
    function onDown(x, y, button) {
        const h = at(x, y);
        if (!h)
            return;
        pressed = BUTTON_MASK[button] ?? 1;
        downEl = h.el;
        const a = mouse(h, 'pointerdown', button);
        const b = mouse(h, 'mousedown', button);
        if (button === 0 && a && b)
            focusAt(h);
    }
    function onUp(x, y, button) {
        const h = at(x, y);
        pressed = 0;
        if (!h) {
            downEl = null;
            return;
        }
        mouse(h, 'pointerup', button);
        mouse(h, 'mouseup', button);
        const same = !!downEl && (downEl === h.el || downEl.contains(h.el) || h.el.contains(downEl));
        if (same) {
            if (button === 0) {
                const select = h.el.closest('select');
                if (select)
                    cycleSelect(select);
                else
                    mouse(h, 'click', 0, { detail: 1 });
                const now = Date.now();
                if (lastClick.el === h.el && now - lastClick.t < 450) {
                    mouse(h, 'dblclick', 0, { detail: 2 });
                    lastClick = { t: 0, el: null };
                }
                else {
                    lastClick = { t: now, el: h.el };
                }
            }
            else if (button === 2) {
                mouse(h, 'contextmenu', 2);
            }
            else {
                mouse(h, 'auxclick', button);
            }
        }
        downEl = null;
    }
    function focusAt(h) {
        const f = h.el.closest('input,textarea,select,button,a[href],[tabindex],[contenteditable=""],[contenteditable="true"]');
        if (f) {
            f.focus({ preventScroll: true });
            if (isTextField(f)) {
                const n = f.value.length;
                try {
                    f.setSelectionRange(n, n);
                }
                catch { /* e.g. number inputs */ }
            }
            else if (f.isContentEditable) {
                const doc = h.el.ownerDocument;
                const range = doc.caretRangeFromPoint?.(h.cx, h.cy);
                const sel = doc.getSelection();
                if (range && sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
        else {
            const active = deepActive();
            if (active && active !== document.body)
                active.blur();
        }
    }
    function cycleSelect(s) {
        if (s.disabled || s.options.length === 0)
            return;
        s.focus();
        s.selectedIndex = (s.selectedIndex + 1) % s.options.length;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // ----------------------------------------------------------------- wheel
    function onWheel(x, y, dx, dy) {
        const h = at(x, y);
        if (!h)
            return;
        const ok = h.el.dispatchEvent(new WheelEvent('wheel', {
            deltaX: dx, deltaY: dy, deltaMode: 0, clientX: h.cx, clientY: h.cy,
            bubbles: true, cancelable: true, composed: true,
        }));
        if (ok)
            scrollFrom(h.el, dx, dy, h.win);
    }
    function canScroll(n, dx, dy) {
        const view = n.ownerDocument.defaultView || window;
        const s = view.getComputedStyle(n);
        const scrollable = (v) => /(auto|scroll|overlay)/.test(v);
        if (dy && scrollable(s.overflowY) && n.scrollHeight > n.clientHeight + 1) {
            if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0)
                return true;
        }
        if (dx && scrollable(s.overflowX) && n.scrollWidth > n.clientWidth + 1) {
            if (dx > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0)
                return true;
        }
        return false;
    }
    function scrollFrom(el, dx, dy, win = window) {
        let n = el;
        while (n && n !== n.ownerDocument.documentElement && n !== n.ownerDocument.body) {
            if (canScroll(n, dx, dy)) {
                n.scrollBy({ left: dx, top: dy });
                return;
            }
            const root = n.getRootNode();
            n = n.parentElement ?? ('host' in root ? root.host : null);
        }
        win.scrollBy({ left: dx, top: dy });
    }
    // -------------------------------------------------------------- keyboard
    function isTextField(el) {
        if (el.tagName === 'TEXTAREA')
            return true;
        if (el.tagName !== 'INPUT')
            return false;
        const t = el.type;
        return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(t);
    }
    function isEditable(el) {
        return isTextField(el) || el.isContentEditable;
    }
    function onKey(m) {
        const key = String(m.k ?? '').slice(0, 32);
        const code = String(m.c ?? '').slice(0, 32);
        if (!key)
            return;
        const mods = { ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt, metaKey: !!m.meta };
        const target = deepActive() || document.body;
        const init = {
            key, code, ...mods, repeat: !!m.repeat, bubbles: true, cancelable: true, composed: true,
        };
        if (m.up) {
            target.dispatchEvent(new KeyboardEvent('keyup', init));
            return;
        }
        if (!target.dispatchEvent(new KeyboardEvent('keydown', init)))
            return; // the page handled it
        if (key.length === 1 && !mods.ctrlKey && !mods.metaKey) {
            if (!target.dispatchEvent(new KeyboardEvent('keypress', init)))
                return;
        }
        defaultKey(target, key, mods);
    }
    function exec(doc, cmd, value) {
        try {
            return doc.execCommand(cmd, false, value);
        }
        catch {
            return false;
        }
    }
    function manualEdit(t, text, back) {
        const start = t.selectionStart ?? t.value.length;
        const end = t.selectionEnd ?? t.value.length;
        let v = t.value, caret = start;
        if (text) {
            v = v.slice(0, start) + text + v.slice(end);
            caret = start + text.length;
        }
        else if (start !== end) {
            v = v.slice(0, start) + v.slice(end);
        }
        else if (back && start > 0) {
            v = v.slice(0, start - 1) + v.slice(end);
            caret = start - 1;
        }
        else if (!back) {
            v = v.slice(0, start) + v.slice(end + 1);
        }
        t.value = v;
        try {
            t.setSelectionRange(caret, caret);
        }
        catch { /* unsupported type */ }
        t.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: text ? 'insertText' : back ? 'deleteContentBackward' : 'deleteContentForward', data: text || null,
        }));
    }
    function moveCaret(t, key, extend) {
        if (isTextField(t)) {
            try {
                const len = t.value.length;
                const s = t.selectionStart ?? len, e = t.selectionEnd ?? len;
                let pos = key === 'Home' ? 0 : key === 'End' ? len
                    : key === 'ArrowLeft' ? (s !== e && !extend ? s : Math.max(0, (extend ? e : s) - 1))
                        : (s !== e && !extend ? e : Math.min(len, e + 1));
                if (extend)
                    t.setSelectionRange(Math.min(s, pos), Math.max(s, pos));
                else
                    t.setSelectionRange(pos, pos);
            }
            catch { /* unsupported type */ }
            return;
        }
        const sel = t.ownerDocument.getSelection();
        if (!sel || !sel.modify)
            return;
        const dir = key === 'ArrowLeft' || key === 'Home' ? 'backward' : 'forward';
        const unitName = key === 'Home' || key === 'End' ? 'lineboundary' : 'character';
        sel.modify(extend ? 'extend' : 'move', dir, unitName);
    }
    function moveFocus(back) {
        const all = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]')).filter(el => !el.disabled && el.getClientRects().length > 0 && el.tabIndex >= 0);
        if (!all.length)
            return;
        const i = all.indexOf(deepActive());
        const next = all[(i + (back ? -1 : 1) + all.length) % all.length];
        next.focus();
    }
    function defaultKey(t, key, mods) {
        const doc = t.ownerDocument;
        const cmd = mods.ctrlKey || mods.metaKey;
        if (isEditable(t)) {
            if (cmd) {
                const k = key.toLowerCase();
                if (k === 'a') {
                    if (isTextField(t))
                        t.select();
                    else
                        exec(doc, 'selectAll');
                }
                else if (k === 'z')
                    exec(doc, mods.shiftKey ? 'redo' : 'undo');
                else if (k === 'y')
                    exec(doc, 'redo');
                return;
            }
            if (key.length === 1) {
                if (!exec(doc, 'insertText', key) && isTextField(t))
                    manualEdit(t, key, false);
                return;
            }
            switch (key) {
                case 'Backspace':
                    if (!exec(doc, 'delete') && isTextField(t))
                        manualEdit(t, '', true);
                    return;
                case 'Delete':
                    if (!exec(doc, 'forwardDelete') && isTextField(t))
                        manualEdit(t, '', false);
                    return;
                case 'Enter':
                    if (t.tagName === 'INPUT') {
                        t.form?.requestSubmit();
                        return;
                    }
                    if (t.tagName === 'TEXTAREA') {
                        if (!exec(doc, 'insertText', '\n'))
                            manualEdit(t, '\n', false);
                        return;
                    }
                    exec(doc, mods.shiftKey ? 'insertLineBreak' : 'insertParagraph');
                    return;
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'Home':
                case 'End':
                    moveCaret(t, key, mods.shiftKey);
                    return;
                case 'Tab':
                    moveFocus(mods.shiftKey);
                    return;
                case 'Escape':
                    t.blur();
                    return;
            }
            return;
        }
        if (cmd)
            return;
        const h = window.innerHeight;
        switch (key) {
            case 'Tab':
                moveFocus(mods.shiftKey);
                return;
            case 'Enter':
                if (t.matches('a[href],button,[role=button],input[type=submit],input[type=button],summary'))
                    t.click();
                return;
            case ' ':
                if (t.matches('button,[role=button],input[type=checkbox],input[type=radio],summary')) {
                    t.click();
                    return;
                }
                scrollFrom(t, 0, (mods.shiftKey ? -1 : 1) * h * 0.85);
                return;
            case 'ArrowDown':
                scrollFrom(t, 0, 60);
                return;
            case 'ArrowUp':
                scrollFrom(t, 0, -60);
                return;
            case 'ArrowRight':
                scrollFrom(t, 60, 0);
                return;
            case 'ArrowLeft':
                scrollFrom(t, -60, 0);
                return;
            case 'PageDown':
                scrollFrom(t, 0, h * 0.85);
                return;
            case 'PageUp':
                scrollFrom(t, 0, -h * 0.85);
                return;
            case 'Home':
                window.scrollTo({ top: 0 });
                return;
            case 'End':
                window.scrollTo({ top: document.documentElement.scrollHeight });
                return;
        }
    }
    // ------------------------------------------------------------ the two roles
    // Tell the room page which site this tab is on (also catches in-app navigation on X etc.).
    let lastReported = '';
    function reportTab() {
        if (!myToken || !active)
            return;
        const title = String(document.title || '');
        const info = location.href + '\n' + title;
        if (info === lastReported)
            return;
        lastReported = info;
        GM_setValue('bt-tabinfo', { url: location.href, title: title.slice(0, 200), t: Date.now() });
    }
    // Every tab gets a private ID that only a page *sharing* it can read (Chrome's
    // Capture Handle). When the room shares this tab it sends the ID back, and this
    // tab offers to connect: no menu or shortcut needed.
    const docId = 'bt:' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    let offer = null;
    let dismissed = false;
    function advertise() {
        const md = navigator.mediaDevices;
        try {
            md?.setCaptureHandleConfig?.({ handle: docId, exposeOrigin: false, permittedOrigins: ['*'] });
        }
        catch { /* not supported in this browser */ }
    }
    // "any" offers come when the room can't tell exactly which tab is shared.
    // Chrome switches to the shared tab right after you pick it, so only a tab
    // that is in front and focused within a few seconds asks.
    let guess = null;
    function onOffer(v) {
        if (!v || typeof v !== 'object')
            return;
        const o = v;
        if (dismissed || Date.now() - (Number(o.t) || 0) > 30000)
            return;
        if (myToken && active)
            return; // already connected
        const roomCode = String(o.room || '').slice(0, 12);
        if (o.any === true) {
            guess = { room: roomCode, until: Date.now() + 5000 };
            tryGuess();
            return;
        }
        if (o.handle !== docId)
            return;
        showOffer(roomCode, false);
    }
    function tryGuess() {
        if (!guess)
            return;
        if (Date.now() > guess.until) {
            guess = null;
            return;
        }
        if (document.visibilityState !== 'visible' || !document.hasFocus())
            return;
        if (dismissed || (myToken && active)) {
            guess = null;
            return;
        }
        const r = guess.room;
        guess = null;
        showOffer(r, true);
    }
    function showOffer(roomCode, unsure) {
        offer = { room: roomCode };
        const where = roomCode ? ' in room ' + roomCode : '';
        setBadge(unsure ? 'Is this the tab you\'re sharing' + where + '? Let the room control it?'
            : 'You\'re sharing this tab' + where + '. Let the room control it?', 'offer', [
            { label: 'Connect', primary: true, run: () => { offer = null; choose(); } },
            { label: 'Not now', run: () => { offer = null; dismissed = true; GM_saveTab({ notNow: true }); refreshBadge(); } },
        ]);
    }
    function choose() {
        myToken = myToken || Math.random().toString(36).slice(2) + Date.now().toString(36);
        GM_saveTab({ token: myToken });
        GM_setValue('bt-target', myToken); // only one controlled tab at a time
        active = true;
        readState(GM_getValue('bt-state', null));
        offer = null;
        refreshBadge();
        lastReported = '';
        reportTab();
    }
    function startTarget() {
        // Backup to the menu: Alt+Shift+B toggles control of this tab.
        // isTrusted means friends' simulated keys can never trigger it.
        window.addEventListener('keydown', e => {
            if (!e.isTrusted || !e.altKey || !e.shiftKey || e.code !== 'KeyB')
                return;
            e.preventDefault();
            e.stopPropagation();
            if (myToken && active)
                stop();
            else
                choose();
        }, true);
        GM_addValueChangeListener('bt-target', (_n, _o, v) => {
            if (!myToken)
                return;
            active = v === myToken;
            refreshBadge();
        });
        GM_addValueChangeListener('bt-state', (_n, _o, v) => { readState(v); if (myToken)
            refreshBadge(); });
        GM_addValueChangeListener('bt-input', (_n, _o, v) => onInputBatch(v));
        GM_addValueChangeListener('bt-offer', (_n, _o, v) => onOffer(v));
        window.addEventListener('focus', tryGuess);
        document.addEventListener('visibilitychange', tryGuess);
        setInterval(() => { if (myToken)
            refreshBadge(); }, 3000);
        setInterval(reportTab, 1000);
        // Resume after this tab navigates to a new page.
        // Check first whether this tab is already linked, *then* tell the room its ID.
        // Otherwise a linked tab that just loaded a new page would get the Connect prompt again.
        GM_getTab(tab => {
            const t = tab && typeof tab.token === 'string' ? tab.token : '';
            dismissed = !!(tab && tab.notNow);
            if (!t) {
                advertise();
                return;
            }
            myToken = t;
            active = GM_getValue('bt-target', '') === t;
            readState(GM_getValue('bt-state', null));
            const cur = GM_getValue('bt-input', null);
            if (cur) {
                lastWriter = cur.w;
                lastSeq = Number(cur.seq) || 0;
            }
            refreshBadge();
            reportTab();
            advertise();
        });
    }
    function startBridge() {
        const writer = Math.random().toString(36).slice(2);
        // Secret shared only with this room page. Pages loaded inside it (Shared page mode)
        // never receive it, so they can't fake input. Checking e.source isn't reliable here
        // because Tampermonkey may wrap \`window\`.
        const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const sendTabInfo = (v) => {
            if (!v || typeof v !== 'object')
                return;
            const info = v;
            window.postMessage({ bt: 'tabinfo', key, url: String(info.url || ''), title: String(info.title || '') }, '*');
        };
        const ready = () => {
            window.postMessage({ bt: 'bridge-ready', key, version: typeof GM_info !== 'undefined' ? GM_info.script.version : '' }, '*');
            setTimeout(() => sendTabInfo(GM_getValue('bt-tabinfo', null)), 50);
        };
        GM_addValueChangeListener('bt-tabinfo', (_n, _o, v) => sendTabInfo(v));
        let seq = 0;
        let writeQueued = false;
        const queue = [];
        const flush = () => { writeQueued = false; GM_setValue('bt-input', { w: writer, seq, items: queue.slice() }); };
        window.addEventListener('message', e => {
            if (!e.data || typeof e.data !== 'object')
                return;
            const d = e.data;
            if (d.bt === 'ping') {
                ready();
                return;
            }
            if (d.key !== key)
                return;
            if (d.bt === 'offer') {
                const roomCode = String(d.room || '').slice(0, 12);
                if (d.any === true)
                    GM_setValue('bt-offer', { any: true, room: roomCode, t: Date.now() });
                else if (typeof d.handle === 'string' && d.handle.startsWith('bt:') && d.handle.length < 80)
                    GM_setValue('bt-offer', { handle: d.handle, room: roomCode, t: Date.now() });
                return;
            }
            if (d.bt === 'state') {
                GM_setValue('bt-state', { room: String(d.room || ''), control: !!d.control, t: Date.now() });
            }
            else if (d.bt === 'in') {
                queue.push({ seq: ++seq, t: Date.now(), msg: d.msg });
                if (queue.length > 60)
                    queue.shift();
                if (!writeQueued) {
                    writeQueued = true;
                    setTimeout(flush, 0);
                }
            }
        });
        window.addEventListener('beforeunload', () => {
            GM_setValue('bt-state', { room: '', control: false, t: 0 });
        });
        ready();
    }
    // Chrome loads some pages invisibly in the background (e.g. Google's search
    // "warmup" page, or pages it pre-renders). They must never become the controlled tab.
    const isHelperPage = /(^|\.)google\.[a-z.]+$/.test(location.hostname) && location.pathname === '/search/warmup.html';
    if (isHelperPage)
        return;
    // Menu items are registered first, on every page, so they always show up.
    if (isRoomPage) {
        GM_registerMenuCommand('ℹ️ This is your room page: open the tab to share and pick it there', () => {
            alert('Go to the tab you want friends to control, open the Tampermonkey menu there and choose "Let my room control this tab" (or press Alt+Shift+B in that tab). Keep this room page open.');
        });
    }
    else {
        GM_registerMenuCommand('🎮 Let my room control this tab (Alt+Shift+B)', choose);
        GM_registerMenuCommand('⏹ Stop room control on this tab', stop);
    }
    try {
        if (isRoomPage)
            startBridge();
        else if (document.prerendering) {
            // Wait until Chrome actually shows this page.
            document.addEventListener('prerenderingchange', () => startTarget(), { once: true });
        }
        else
            startTarget();
    }
    catch (err) {
        console.error('[Browse Together] failed to start', err);
    }
})();
