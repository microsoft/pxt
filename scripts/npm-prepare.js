const ju = require("../jakeutil");

const apps = [
    'skillmap',
    'authcode',
    'multiplayer',
    'kiosk',
    'teachertool'
];

(async () => {
    for (const app of apps) {
        console.log(`Installing ${app}...`);
        await ju.exec(`cd ${app} && npm install --no-update-notifier && cd ..`, true);
    }
})();
