// ==UserScript==
// @name        Clean up reddit.com
// @namespace   Violentmonkey Scripts
// @match       https://old.reddit.com/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_setClipboard
// @version     1.2
// @author      https://github.com/devshane
// @description Clean up reddit by filtering posts by subreddit and title keywords
// ==/UserScript==
(function () {
    // Storage keys
    const STORAGE_KEY = "clean-up-reddit-enabled";
    const STORAGE_KEY_SUBS = "clean-up-reddit-subs";
    const STORAGE_KEY_TITLES = "clean-up-reddit-titles";
    const STORAGE_KEY_HIGHLIGHT = "clean-up-reddit-highlight";

    let enabled = GM_getValue(STORAGE_KEY, true); // default to enabled

    function getSubName(href) {
        const match = href.match(/\/r\/([^/]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    function normalizeSubFilter(sub) {
        return sub.replace(/^r\//i, "").toLowerCase();
    }

    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
.highlighted {
  background-color: aliceblue !important;
}
.clean-up-reddit-status {
  font-size: 12px;
  padding: 4px;
  margin-left: 4px;
  background-color: #efefef;
}
.clean-up-reddit-toggle {
  font-size: 12px;
  padding: 4px 8px;
  margin-left: 8px;
  background-color: #efefef;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
}
.clean-up-reddit-toggle:hover {
  background-color: #e0e0e0;
}
.clean-up-reddit-toggle.disabled {
  background-color: #ffcccc;
  border-color: #cc9999;
}
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
.clean-up-reddit-dropdown {
  position: relative;
  display: inline-block;
  margin-left: 8px;
}
.clean-up-reddit-dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 3px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 120px;
  margin-top: 2px;
}
.clean-up-reddit-dropdown.open .clean-up-reddit-dropdown-menu {
  display: block;
}
.clean-up-reddit-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 6px 12px;
  font-size: 12px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.clean-up-reddit-dropdown-menu button:hover {
  background: #e0e0e0;
}
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

    const status = document.createElement("div");
    status.className = "spacer";

    const toggle = document.createElement("button");
    toggle.className = "clean-up-reddit-toggle" + (enabled ? "" : " disabled");
    toggle.innerText = enabled ? "✓ Filter ON" : "✗ Filter OFF";
    toggle.addEventListener("click", () => {
        enabled = !enabled;
        GM_setValue(STORAGE_KEY, enabled);
        toggle.innerText = enabled ? "✓ Filter ON" : "✗ Filter OFF";
        toggle.classList.toggle("disabled", !enabled);
        location.reload();
    });
    status.appendChild(toggle);

    // Filters dropdown (Edit / Export / Import)
    const dropdown = document.createElement("div");
    dropdown.className = "clean-up-reddit-dropdown";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "clean-up-reddit-toggle";
    dropdownBtn.innerText = "Filters ▾";
    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    });
    dropdown.appendChild(dropdownBtn);

    const menu = document.createElement("div");
    menu.className = "clean-up-reddit-dropdown-menu";

    const editItem = document.createElement("button");
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
            subs: JSON.parse(GM_getValue(STORAGE_KEY_SUBS, "[]")),
            titles: JSON.parse(GM_getValue(STORAGE_KEY_TITLES, "[]")),
            highlight: JSON.parse(GM_getValue(STORAGE_KEY_HIGHLIGHT, "[]")),
        };
        const json = JSON.stringify(data, null, 2);
        try {
            GM_setClipboard(json, "text");
        } catch (_) {
            navigator.clipboard.writeText(json);
        }
        exportItem.textContent = "Copied!";
        setTimeout(() => {
            exportItem.textContent = "Export";
            dropdown.classList.remove("open");
        }, 1500);
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
            if (data.subs) GM_setValue(STORAGE_KEY_SUBS, JSON.stringify(data.subs));
            if (data.titles) GM_setValue(STORAGE_KEY_TITLES, JSON.stringify(data.titles));
            if (data.highlight) GM_setValue(STORAGE_KEY_HIGHLIGHT, JSON.stringify(data.highlight));
            location.reload();
        } catch (e) {
            alert("Invalid JSON: " + e.message);
        }
    });
    menu.appendChild(importItem);

    dropdown.appendChild(menu);
    status.appendChild(dropdown);

    // Close dropdown when clicking outside
    document.addEventListener("click", () => dropdown.classList.remove("open"));

    // Open/Close All Images toggle
    let imagesOpen = false;
    const toggleImagesBtn = document.createElement("button");
    toggleImagesBtn.className = "clean-up-reddit-toggle";
    toggleImagesBtn.innerText = "Open All Images";
    toggleImagesBtn.addEventListener("click", () => {
        if (imagesOpen) {
            const expandos = document.querySelectorAll("div.expando-button.expanded");
            expandos.forEach((btn) => btn.click());
            toggleImagesBtn.innerText = "Open All Images";
        } else {
            const expandos = document.querySelectorAll("div.expando-button.collapsed");
            expandos.forEach((btn) => btn.click());
            toggleImagesBtn.innerText = "Close All Images";
        }
        imagesOpen = !imagesOpen;
    });
    status.appendChild(toggleImagesBtn);

    // Modal functions
    function openModal() {
        const storedSubs = JSON.parse(GM_getValue(STORAGE_KEY_SUBS, "[]"));
        const storedTitles = JSON.parse(GM_getValue(STORAGE_KEY_TITLES, "[]"));
        const storedHighlight = JSON.parse(
            GM_getValue(STORAGE_KEY_HIGHLIGHT, "[]"),
        );

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
        highlightHint.textContent = "One per line (e.g., r/baseball)";
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
            GM_setValue(STORAGE_KEY_SUBS, JSON.stringify(newSubs));
            GM_setValue(STORAGE_KEY_TITLES, JSON.stringify(newTitles));
            GM_setValue(STORAGE_KEY_HIGHLIGHT, JSON.stringify(newHighlight));
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

    const span = document.createElement("span");
    span.className = "clean-up-reddit-status dropdown-title lightdrop";
    span.innerText = "";
    status.appendChild(span);
    if (anchor === menuArea) {
        menuArea.after(status);
    } else {
        anchor.parentNode.insertBefore(status, anchor);
    }

    const setStatusMessage = (msg) => (span.innerText = msg);

    function addSubToFilter(subName) {
        const storedSubs = JSON.parse(GM_getValue(STORAGE_KEY_SUBS, "[]"));
        if (
            !storedSubs.some((entry) => entry.toLowerCase() === subName.toLowerCase())
        ) {
            storedSubs.push(subName);
            GM_setValue(STORAGE_KEY_SUBS, JSON.stringify(storedSubs));
        }
        location.reload();
    }

    setTimeout(() => {
        if (!enabled) {
            setStatusMessage("Filter disabled");
            return;
        }

        // Load filter lists from storage (only when enabled)
        const subsToExclude = JSON.parse(GM_getValue(STORAGE_KEY_SUBS, "[]"));
        const titlesToExclude = JSON.parse(GM_getValue(STORAGE_KEY_TITLES, "[]")).map(
            (keyword) =>
                new RegExp(
                    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                    "i",
                ),
        );
        const subsToHighlight = JSON.parse(
            GM_getValue(STORAGE_KEY_HIGHLIGHT, "[]"),
        );

        let removed = 0;
        const removalCounts = {};

        function tryRemoveBySub(thing, subLink, subName) {
            for (const sub of subsToExclude) {
                if (subName === normalizeSubFilter(sub)) {
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
            }
            return false;
        }

        function tryHighlightSub(subLink, subName) {
            for (const sub of subsToHighlight) {
                if (subName === normalizeSubFilter(sub)) {
                    const entry = subLink.closest(".entry");
                    if (entry) {
                        entry.classList.add("highlighted");
                    }
                    break;
                }
            }
        }

        function tryRemoveByTitle(thing) {
            const title = thing.querySelector('a[class*="title"]');
            if (!title) return false;
            for (const regex of titlesToExclude) {
                if (title.innerText.match(regex)) {
                    console.log(
                        "[ViolentMonkey] removing thing, title matches " + regex,
                        title.innerText,
                    );
                    thing.remove();
                    removed++;
                    removalCounts[regex.source] =
                        (removalCounts[regex.source] || 0) + 1;
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

        let statusMsg =
            "CleanupReddit: removed " +
            removed +
            " post" +
            (removed !== 1 ? "s" : "");

        if (removed > 0) {
            const titleCounts = {};
            let subsTotal = 0;

            Object.entries(removalCounts).forEach(([key, count]) => {
                if (key.startsWith("sub:")) {
                    subsTotal += count;
                } else {
                    titleCounts[key] = count;
                }
            });

            const breakdown = [];
            if (subsTotal > 0) {
                breakdown.push(`subs: ${subsTotal}`);
            }

            Object.entries(titleCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([key, count]) => {
                    breakdown.push(`${key}: ${count}`);
                });

            statusMsg += " (" + breakdown.join(", ") + ")";
        }

        setStatusMessage(statusMsg);
    }, 100);
})();
