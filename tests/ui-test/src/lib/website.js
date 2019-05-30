const WEBSITE_URL = "https://makecode.microbit.org"

class Website {

    constructor(rootURL = WEBSITE_URL) {
        this.rootURL = rootURL;
    }

    open(path = "") {
        var fullPath = this.getUrl(path);
        console.log(`Open url $(fullPath)`);
        driver.get(fullPath);

        driver.manage().window().maximize();
    }

    getUrl(path) {
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return this.rootURL + path;
    }

    close() {
        console.info("Close webstie...");
        driver.quit();
    }

}

export let website = new Website();