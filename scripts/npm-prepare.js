const ju = require("../jakeutil");
const webapps = require("../cli/webapps-config.json").webapps;

(async () => {
    for (const app of webapps) {
        console.log(`Installing ${app.name}...`);
        await ju.exec(`cd ${app.name} && npm install --no-update-notifier && cd ..`, true);
    }
})();
