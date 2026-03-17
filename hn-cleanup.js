// ==UserScript==
// @name        HN Cleanup
// @namespace   Violentmonkey Scripts
// @match       https://news.ycombinator.com/*
// @grant       none
// @version     1.2
// @author      https://github.com/devshane
// @description Custom styling, comment collapsing, and low-engagement post filtering for Hacker News
// @updateURL   https://raw.githubusercontent.com/devshane/user-scripts/main/hn-cleanup.js
// @downloadURL https://raw.githubusercontent.com/devshane/user-scripts/main/hn-cleanup.js
// ==/UserScript==
(function () {
    console.log('[ViolentMonkey] HN Cleanup');

    const s = document.createElement('style');
    s.innerHTML = `
table {
  font-family: system-ui !important;
}

#hnes-comments {
  font-family: system-ui !important;
  font-size: 1.1em;
  line-height: 20px !important;
}

#hnes-comments > div {
  border-top: 3px solid black;
}

#hnes-comments .replies {
  margin: 8px 0 0 10px;
}

.hnes-comment:last-child {
  margin-bottom: 1em !important;
}

.hnes-comment section.body {
  margin-left: 14px;
}

.hnes-comment header {
  font-size: 14px !important;
}

.hnes-comment p {
  line-height: 1.5em;
}

tr.athing > td {
  height: 40px;
}

tr.athing > td > a.comments {
  padding-top: 12px !important;
}

.subline {
  padding-top: 12px !important;
}

div.votearrow {
  margin-top: 10px;
}

span.author {
  font-weight: bold;
}

section.body > div.text > p > a {
  text-decoration: underline !important;
  color: #000 !important;
}

body {
  max-width: 1200px !important;
  margin: 0 auto !important;
  background-color: rgb(246, 246, 239);
}

.title {
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text {
  font-size: 15px;
}

.collapser {
  margin-right: .5em !important;
}

.toptext {
  color: #202020;
  font-family: system-ui !important;
  font-size: 15px;
  line-height: 1.5em;
}

a:visited:not(.pagetop) {
  color: rgb(218, 144, 102) !important;
}

#top-navigation a {
  color: black !important;
}

#top-navigation a.nav-active-link {
  color: white !important;
}

td.title > a,
td.title > a:visited {
  color: rgb(255, 102, 0) !important;
}

.hidden { display: none; }

#index-body #content table tr.odd {
  background-color: #ddd !important;
}
#index-body #content table tr.even {
  background-color: #f6f6ef !important;
}

.titleline > a:visited {
  color: darkgreen !important;
}

#index-body #content table td:first-child {
  width: 100px !important;
  max-width: 100px !important;
}
  `;
    document.head.appendChild(s);

    if (document.location.pathname.includes('/item')) {
        // Collapse all comments except new ones (requires HN Enhancement Suite)
        setTimeout(() => {
            console.log('[hn-boost] collapsing comments');
            const newComments = document.querySelectorAll('.hnes-new, .hnes-new-parent');
            if (newComments.length > 0) {
                document
                    .querySelectorAll('.hnes-comment:not(.hn-boost-touched)')
                    .forEach((a) => a.classList.add('collapsed'));
            }
        }, 850);

        const commentsContainer =
            document.getElementById('hnes-comments') ||
            document.getElementById('hnmain');
        if (commentsContainer) {
            const observer = new MutationObserver((mutationsList) => {
                for (const m of mutationsList) {
                    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                    const classes = m.target.classList;
                    if (
                        (classes.contains('hnes-new-parent') || classes.contains('hnes-new')) &&
                        !classes.contains('hn-boost-touched') &&
                        classes.contains('collapsed')
                    ) {
                        m.target.classList.remove('collapsed');
                        m.target.classList.add('hn-boost-touched');
                    }
                }
            });
            observer.observe(commentsContainer, {
                attributes: true,
                childList: false,
                subtree: true,
            });
        }
    }

    const pathname = document.location.pathname;
    if (pathname === '/news' || pathname === '/active' ||
        pathname === '/news/' || pathname === '/active/' ||
        pathname === '/' ) {
        setTimeout(() => {
            const rows = document.getElementsByClassName('athing');
            for (let i = 0; i < rows.length; i++) {
                const commentsEl = rows[i].getElementsByClassName('comments')[0];
                if (!commentsEl) {
                    rows[i].classList.add('hidden');
                    continue;
                }
                let commentsText = commentsEl.innerText;
                if (commentsText.includes('/')) {
                    commentsText = commentsText.split('/').reverse()[0].trim();
                }
                const count = parseInt(commentsText, 10);
                if (!count || count < 10) {
                    rows[i].classList.add('hidden');
                }
            }

            const visibleRows = document.querySelectorAll('.athing:not(.hidden)');
            for (let i = 0; i < visibleRows.length; i++) {
                visibleRows[i].classList.add(i % 2 === 0 ? 'even' : 'odd');
            }
        }, 350);
    }
})();
