// ==UserScript==
// @name        Redirect links
// @namespace   Violentmonkey Scripts
// @match       https://*/*
// @grant       none
// @version     1.1
// @author      https://github.com/devshane
// @description Redirect Twitter and YouTube links to alternative frontends
// @updateURL   https://raw.githubusercontent.com/devshane/user-scripts/main/redirect-links.js
// @downloadURL https://raw.githubusercontent.com/devshane/user-scripts/main/redirect-links.js
// ==/UserScript==
(function () {
    console.log('[ViolentMonkey] Redirecting links');

    const replacements = {
        '://twitter.com/': '://xcancel.com/',
        '://x.com/': '://xcancel.com/',
        '://www.youtube.com/': '://inv.nadeko.net/',
        '://youtube.com/': '://inv.nadeko.net/',
    };

    setTimeout(() => {
        const links = document.getElementsByTagName('a');

        for (let i = 0; i < links.length; i++) {
            for (const [from, to] of Object.entries(replacements)) {
                if (links[i].href.includes(from)) {
                    links[i].href = links[i].href.replace(from, to);
                }
            }
        }
    }, 1000);
})();
