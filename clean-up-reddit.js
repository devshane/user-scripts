// ==UserScript==
// @name        Clean up reddit.com
// @namespace   Violentmonkey Scripts
// @match       https://old.reddit.com/*
// @grant       none
// @version     1.4
// @author      https://github.com/devshane
// @description Clean up reddit by filtering posts by subreddit and title keywords
// @updateURL   https://raw.githubusercontent.com/devshane/user-scripts/main/clean-up-reddit.js
// @downloadURL https://raw.githubusercontent.com/devshane/user-scripts/main/clean-up-reddit.js
// ==/UserScript==
(function () {
    // Storage keys
    const STORAGE_KEY = "clean-up-reddit-enabled";
    const STORAGE_KEY_SUBS = "clean-up-reddit-subs";
    const STORAGE_KEY_TITLES = "clean-up-reddit-titles";
    const STORAGE_KEY_HIGHLIGHT = "clean-up-reddit-highlight";

    function loadValue(key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        } catch (_) {}
        return defaultValue;
    }

    function storeValue(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    }

    let enabled = loadValue(STORAGE_KEY, true); // default to enabled

    function getSubName(href) {
        const match = href.match(/\/r\/([^/]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    function normalizeSubFilter(sub) {
        return sub.replace(/^r\//i, "").toLowerCase();
    }

    const collator = new Intl.Collator("en", { sensitivity: "base" });
    function sortFilters(arr) {
        return arr.sort((a, b) => collator.compare(a, b));
    }

    function parseHighlightEntry(entry) {
        const i = entry.lastIndexOf(":");
        if (i > 0) {
            const pattern = entry.slice(0, i).trim();
            const color = entry.slice(i + 1).trim();
            if (pattern && color) return { pattern, color };
        }
        return { pattern: entry.trim(), color: "aliceblue" };
    }

    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
.highlighted {
  background-color: aliceblue !important;
}

/* ── Toolbar ── */
.cur-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 12px;
  background: linear-gradient(to bottom, #fafafa, #f0f0f0);
  border: 1px solid #d4d4d4;
  border-radius: 4px;
}
.cur-brand {
  font-weight: 700;
  color: #333;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.cur-sep {
  width: 1px;
  height: 16px;
  background: #d0d0d0;
  flex-shrink: 0;
}
.cur-stat {
  position: relative;
  color: #666;
  white-space: nowrap;
  cursor: default;
}
.cur-stat-count {
  font-variant-numeric: tabular-nums;
}
.cur-stat-count.has-removals {
  border-bottom: 1px dotted #999;
}

/* Hover tooltip for breakdown */
.cur-stat-tooltip {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a2a;
  color: #e8e8e8;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 1001;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  line-height: 1.5;
}
.cur-stat-tooltip::before {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: #2a2a2a;
}
.cur-stat:hover .cur-stat-tooltip {
  display: block;
}
.cur-stat-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.cur-stat-tooltip-label {
  color: #aaa;
}
.cur-stat-tooltip-value {
  font-weight: 600;
  color: #fff;
  text-align: right;
}
.cur-stat-tooltip-divider {
  height: 1px;
  background: #555;
  margin: 4px 0;
}

.cur-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

/* ── Buttons ── */
.cur-btn {
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  background: #fff;
  border: 1px solid #c8c8c8;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
  color: #444;
  line-height: 1.4;
  transition: background 0.1s, border-color 0.1s;
}
.cur-btn:hover {
  background: #eaeaea;
  border-color: #aaa;
}
.cur-btn:active {
  background: #ddd;
}
.cur-btn-on {
  background: #e8f4e8;
  border-color: #8cb88c;
  color: #2d6e2d;
}
.cur-btn-on:hover {
  background: #d8edd8;
  border-color: #6da06d;
}
.cur-btn-off {
  background: #fce8e8;
  border-color: #d4a0a0;
  color: #993333;
}
.cur-btn-off:hover {
  background: #f8d8d8;
  border-color: #c08080;
}

/* ── Dropdown ── */
.cur-dropdown {
  position: relative;
}
.cur-dropdown-menu {
  display: none;
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  background: #fff;
  border: 1px solid #c8c8c8;
  border-radius: 4px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 110px;
  overflow: hidden;
}
.cur-dropdown.open .cur-dropdown-menu {
  display: block;
}
.cur-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 5px 12px;
  font-family: inherit;
  font-size: 11px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  color: #444;
}
.cur-dropdown-menu button:hover {
  background: #f0f0f0;
}
.cur-dropdown-menu button.cur-dropdown-sep {
  border-top: 1px solid #eee;
}

/* ── Modal ── */
.clean-up-reddit-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.clean-up-reddit-modal {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 20px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
.clean-up-reddit-modal h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
}
.clean-up-reddit-modal label {
  display: block;
  font-weight: bold;
  margin-bottom: 4px;
  color: #444;
  font-size: 13px;
}
.clean-up-reddit-modal .hint {
  font-size: 11px;
  color: #888;
  margin-bottom: 6px;
}
.clean-up-reddit-modal textarea {
  width: 100%;
  height: 150px;
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  box-sizing: border-box;
  margin-bottom: 16px;
  resize: vertical;
}
.clean-up-reddit-modal textarea:focus {
  outline: none;
  border-color: #5f99cf;
}
.clean-up-reddit-modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.clean-up-reddit-modal-buttons button {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 3px;
  cursor: pointer;
}
.clean-up-reddit-modal-buttons .save-btn {
  background: #5f99cf;
  color: white;
  border: 1px solid #4a7faa;
}
.clean-up-reddit-modal-buttons .save-btn:hover {
  background: #4a7faa;
}
.clean-up-reddit-modal-buttons .cancel-btn {
  background: #efefef;
  border: 1px solid #ccc;
}
.clean-up-reddit-modal-buttons .cancel-btn:hover {
  background: #e0e0e0;
}

/* ── Toast ── */
.cur-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(0);
  background: #2a2a2a;
  color: #e8e8e8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 13px;
  padding: 10px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}
.cur-toast.visible {
  opacity: 1;
}

/* ── Inline hide button ── */
.clean-up-reddit-hide-sub {
  font-size: 10px;
  color: #888;
  margin-left: 4px;
  cursor: pointer;
  text-decoration: none;
}
.clean-up-reddit-hide-sub:hover {
  color: #c00;
}`;
    document.head.appendChild(styleEl);

    function showToast(message, duration = 2000) {
        const toast = document.createElement("div");
        toast.className = "cur-toast";
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("visible"));
        setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    if (location.pathname.includes("/comments/")) {
        return;
    }

    const isSubredditPage = /^\/r\/[^/]+\/?/.test(location.pathname);

    const menuArea = document.querySelector("div.menuarea");
    const anchor =
        menuArea ||
        document.querySelector("#siteTable") ||
        document.querySelector(".content");
    if (!anchor) {
        // No usable anchor on this page (e.g., user profiles, settings)
        return;
    }

    // ── Build toolbar ──
    const status = document.createElement("div");
    status.className = "spacer";

    const toolbar = document.createElement("div");
    toolbar.className = "cur-toolbar";

    // Brand label
    const brand = document.createElement("span");
    brand.className = "cur-brand";
    brand.textContent = "CleanUpReddit";
    toolbar.appendChild(brand);

    // Separator
    const sep1 = document.createElement("span");
    sep1.className = "cur-sep";
    toolbar.appendChild(sep1);

    // Status area (count + hover tooltip)
    const stat = document.createElement("div");
    stat.className = "cur-stat";

    const statCount = document.createElement("span");
    statCount.className = "cur-stat-count";
    statCount.textContent = "";
    stat.appendChild(statCount);

    const statTooltip = document.createElement("div");
    statTooltip.className = "cur-stat-tooltip";
    stat.appendChild(statTooltip);

    toolbar.appendChild(stat);

    // Actions (pushed to the right)
    const actions = document.createElement("div");
    actions.className = "cur-actions";

    // Filters dropdown (ON/OFF toggle + Edit / Export / Import)
    const dropdown = document.createElement("div");
    dropdown.className = "cur-dropdown";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "cur-btn " + (enabled ? "cur-btn-on" : "cur-btn-off");
    dropdownBtn.textContent = enabled ? "Filters ON \u25BE" : "Filters OFF \u25BE";
    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    });
    dropdown.appendChild(dropdownBtn);

    const menu = document.createElement("div");
    menu.className = "cur-dropdown-menu";

    const toggleItem = document.createElement("button");
    toggleItem.textContent = enabled ? "Turn Off" : "Turn On";
    toggleItem.addEventListener("click", () => {
        enabled = !enabled;
        storeValue(STORAGE_KEY, enabled);
        location.reload();
    });
    menu.appendChild(toggleItem);

    const editItem = document.createElement("button");
    editItem.className = "cur-dropdown-sep";
    editItem.textContent = "Edit Filters";
    editItem.addEventListener("click", () => {
        dropdown.classList.remove("open");
        openModal();
    });
    menu.appendChild(editItem);

    const exportItem = document.createElement("button");
    exportItem.textContent = "Export";
    exportItem.addEventListener("click", () => {
        const data = {
            subs: loadValue(STORAGE_KEY_SUBS, []),
            titles: loadValue(STORAGE_KEY_TITLES, []),
            highlight: loadValue(STORAGE_KEY_HIGHLIGHT, []),
        };
        const json = JSON.stringify(data, null, 2);
        dropdown.classList.remove("open");
        navigator.clipboard.writeText(json).then(() => {
            showToast("Filters copied to clipboard");
        }).catch(() => {
            showToast("Failed to copy to clipboard");
        });
    });
    menu.appendChild(exportItem);

    const importItem = document.createElement("button");
    importItem.textContent = "Import";
    importItem.addEventListener("click", () => {
        dropdown.classList.remove("open");
        const input = prompt("Paste exported JSON:");
        if (!input) return;
        try {
            const data = JSON.parse(input);
            if (data.subs) storeValue(STORAGE_KEY_SUBS, data.subs);
            if (data.titles) storeValue(STORAGE_KEY_TITLES, data.titles);
            if (data.highlight) storeValue(STORAGE_KEY_HIGHLIGHT, data.highlight);
            location.reload();
        } catch (e) {
            alert("Invalid JSON: " + e.message);
        }
    });
    menu.appendChild(importItem);

    dropdown.appendChild(menu);
    actions.appendChild(dropdown);

    document.addEventListener("click", () => dropdown.classList.remove("open"));

    // Open/Close All Images toggle
    let imagesOpen = false;
    const toggleImagesBtn = document.createElement("button");
    toggleImagesBtn.className = "cur-btn";
    toggleImagesBtn.textContent = "Open All Images";
    toggleImagesBtn.addEventListener("click", () => {
        if (imagesOpen) {
            const expandos = document.querySelectorAll("div.expando-button.expanded");
            expandos.forEach((btn) => btn.click());
            toggleImagesBtn.textContent = "Open All Images";
        } else {
            const expandos = document.querySelectorAll("div.expando-button.collapsed");
            expandos.forEach((btn) => btn.click());
            toggleImagesBtn.textContent = "Close All Images";
        }
        imagesOpen = !imagesOpen;
    });
    actions.appendChild(toggleImagesBtn);

    toolbar.appendChild(actions);
    status.appendChild(toolbar);

    // Modal functions
    function openModal() {
        const storedSubs = loadValue(STORAGE_KEY_SUBS, []);
        const storedTitles = loadValue(STORAGE_KEY_TITLES, []);
        const storedHighlight = loadValue(STORAGE_KEY_HIGHLIGHT, []);

        const backdrop = document.createElement("div");
        backdrop.className = "clean-up-reddit-modal-backdrop";

        const modal = document.createElement("div");
        modal.className = "clean-up-reddit-modal";

        const heading = document.createElement("h2");
        heading.textContent = "Edit Filters";
        modal.appendChild(heading);

        const subsLabel = document.createElement("label");
        subsLabel.setAttribute("for", "subs-textarea");
        subsLabel.textContent = "Subreddits to hide";
        modal.appendChild(subsLabel);

        const subsHint = document.createElement("div");
        subsHint.className = "hint";
        subsHint.textContent = "One per line (e.g., anime, r/AITAH)";
        modal.appendChild(subsHint);

        const subsTextarea = document.createElement("textarea");
        subsTextarea.id = "subs-textarea";
        subsTextarea.value = storedSubs.join("\n");
        modal.appendChild(subsTextarea);

        const titlesLabel = document.createElement("label");
        titlesLabel.setAttribute("for", "titles-textarea");
        titlesLabel.textContent = "Keywords to hide";
        modal.appendChild(titlesLabel);

        const titlesHint = document.createElement("div");
        titlesHint.className = "hint";
        titlesHint.textContent = "One per line (e.g., Trump, Taylor Swift)";
        modal.appendChild(titlesHint);

        const titlesTextarea = document.createElement("textarea");
        titlesTextarea.id = "titles-textarea";
        titlesTextarea.value = storedTitles.join("\n");
        modal.appendChild(titlesTextarea);

        const highlightLabel = document.createElement("label");
        highlightLabel.setAttribute("for", "highlight-textarea");
        highlightLabel.textContent = "Subreddits to highlight";
        modal.appendChild(highlightLabel);

        const highlightHint = document.createElement("div");
        highlightHint.className = "hint";
        highlightHint.textContent = "One per line, optional color after colon (e.g., r/baseball, r/nfl:lightgreen)";
        modal.appendChild(highlightHint);

        const highlightTextarea = document.createElement("textarea");
        highlightTextarea.id = "highlight-textarea";
        highlightTextarea.value = storedHighlight.join("\n");
        modal.appendChild(highlightTextarea);

        const btnContainer = document.createElement("div");
        btnContainer.className = "clean-up-reddit-modal-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "cancel-btn";
        cancelBtn.textContent = "Cancel";
        btnContainer.appendChild(cancelBtn);

        const saveBtn = document.createElement("button");
        saveBtn.className = "save-btn";
        saveBtn.textContent = "Save";
        btnContainer.appendChild(saveBtn);

        modal.appendChild(btnContainer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        function closeModal() {
            backdrop.remove();
            document.removeEventListener("keydown", escHandler);
        }

        function saveAndClose() {
            const newSubs = subsTextarea.value
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line);
            const newTitles = titlesTextarea.value
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line);
            const newHighlight = highlightTextarea.value
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line);
            storeValue(STORAGE_KEY_SUBS, sortFilters(newSubs));
            storeValue(STORAGE_KEY_TITLES, sortFilters(newTitles));
            storeValue(STORAGE_KEY_HIGHLIGHT, sortFilters(newHighlight));
            location.reload();
        }

        function escHandler(e) {
            if (e.key === "Escape") {
                closeModal();
            }
        }

        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeModal();
        });
        cancelBtn.addEventListener("click", closeModal);
        saveBtn.addEventListener("click", saveAndClose);
        document.addEventListener("keydown", escHandler);

        subsTextarea.focus();
    }

    if (anchor === menuArea) {
        menuArea.after(status);
    } else {
        anchor.parentNode.insertBefore(status, anchor);
    }

    function addSubToFilter(subName) {
        const storedSubs = loadValue(STORAGE_KEY_SUBS, []);
        if (
            !storedSubs.some((entry) => entry.toLowerCase() === subName.toLowerCase())
        ) {
            storedSubs.push(subName);
            storeValue(STORAGE_KEY_SUBS, sortFilters(storedSubs));
        }
        location.reload();
    }

    setTimeout(() => {
        if (!enabled) {
            statCount.textContent = "disabled";
            statCount.style.color = "#999";
            return;
        }

        // Load filter lists from storage (only when enabled)
        // Sub exclusion: Set for O(1) lookup, Map to recover original name for stats
        const subsRaw = loadValue(STORAGE_KEY_SUBS, []);
        const excludeSet = new Set();
        const excludeOriginal = new Map();
        for (const sub of subsRaw) {
            const norm = normalizeSubFilter(sub);
            excludeSet.add(norm);
            if (!excludeOriginal.has(norm)) excludeOriginal.set(norm, sub);
        }

        // Title keywords: combined regex for fast rejection, individual regexes to identify match
        const titleKeywords = loadValue(STORAGE_KEY_TITLES, []);
        const escapedKeywords = titleKeywords.map((kw) =>
            kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        );
        const combinedTitleRegex =
            escapedKeywords.length > 0
                ? new RegExp(`\\b(?:${escapedKeywords.join("|")})\\b`, "i")
                : null;
        const titleRegexes = escapedKeywords.map(
            (escaped) => new RegExp(`\\b${escaped}\\b`, "i"),
        );

        // Sub highlights: Map for O(1) lookup
        const highlightMap = new Map();
        for (const entry of loadValue(STORAGE_KEY_HIGHLIGHT, [])) {
            const { pattern, color } = parseHighlightEntry(entry);
            highlightMap.set(normalizeSubFilter(pattern), color);
        }

        // Inject a CSS rule for each highlight entry so colors survive DOM manipulation
        for (const [subName, color] of highlightMap) {
            styleEl.sheet.insertRule(
                `.cur-hl-${subName} { background-color: ${color} !important; }`,
            );
        }

        let removed = 0;
        const removalCounts = {};

        function tryRemoveBySub(thing, subLink, subName) {
            if (!excludeSet.has(subName)) return false;
            const sub = excludeOriginal.get(subName);
            console.log(
                "[ViolentMonkey] removing thing, it matches " + sub,
                subLink.href,
            );
            thing.remove();
            removed++;
            const key = `sub:${sub}`;
            removalCounts[key] = (removalCounts[key] || 0) + 1;
            return true;
        }

        function tryHighlightSub(subLink, subName) {
            if (!highlightMap.has(subName)) return;
            const entry = subLink.closest(".entry");
            if (entry) {
                entry.classList.add(`cur-hl-${subName}`);
            }
        }

        function tryRemoveByTitle(thing) {
            if (!combinedTitleRegex) return false;
            const title = thing.querySelector('a[class*="title"]');
            if (!title) return false;
            const text = title.innerText;
            if (!combinedTitleRegex.test(text)) return false;
            // Match found — identify which keyword for stats
            for (let i = 0; i < titleRegexes.length; i++) {
                if (titleRegexes[i].test(text)) {
                    console.log(
                        "[ViolentMonkey] removing thing, title matches " + titleRegexes[i],
                        text,
                    );
                    thing.remove();
                    removed++;
                    removalCounts[titleRegexes[i].source] =
                        (removalCounts[titleRegexes[i].source] || 0) + 1;
                    return true;
                }
            }
            return false;
        }

        function addHideButton(subLink) {
            const hideBtn = document.createElement("a");
            hideBtn.className = "clean-up-reddit-hide-sub";
            hideBtn.innerText = "[x]";
            hideBtn.title = "Hide this subreddit";
            hideBtn.addEventListener("click", (e) => {
                e.preventDefault();
                addSubToFilter(subLink.innerText);
            });
            subLink.after(hideBtn);
        }

        document.querySelectorAll('div[id^="thing"]').forEach((thing) => {
            const subLink = thing.querySelector('a[class*="subreddit"]');
            const subName = subLink ? getSubName(subLink.href) : null;

            if (subName && !isSubredditPage) {
                if (tryRemoveBySub(thing, subLink, subName)) return;
                tryHighlightSub(subLink, subName);
                addHideButton(subLink);
            }

            tryRemoveByTitle(thing);
        });

        statCount.textContent = removed > 0
            ? `${removed} removed`
            : "0 removed";

        if (removed > 0) {
            statCount.classList.add("has-removals");
            statTooltip.innerHTML = "";
            Object.entries(removalCounts)
                .sort((a, b) => {
                    const aIsSub = a[0].startsWith("sub:");
                    const bIsSub = b[0].startsWith("sub:");
                    if (aIsSub !== bIsSub) return aIsSub ? 1 : -1;
                    return b[1] - a[1];
                })
                .forEach(([key, count], i, arr) => {
                    const isSub = key.startsWith("sub:");
                    const prevIsSub = i > 0 && arr[i - 1][0].startsWith("sub:");
                    if (isSub && !prevIsSub && i > 0) {
                        const hr = document.createElement("div");
                        hr.className = "cur-stat-tooltip-divider";
                        statTooltip.appendChild(hr);
                    }
                    const label = isSub ? key.slice(4) : key;
                    const row = document.createElement("div");
                    row.className = "cur-stat-tooltip-row";
                    row.innerHTML =
                        `<span class="cur-stat-tooltip-label">${label}</span>` +
                        `<span class="cur-stat-tooltip-value">${count}</span>`;
                    statTooltip.appendChild(row);
                });
        }
    }, 100);
})();
