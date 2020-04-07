import * as core from "./core";
import * as cloudsync from "./cloudsync";
import * as data from "./data";

const rootdir = "/me/drive/special/approot"


// Error codes: https://docs.microsoft.com/en-us/onedrive/developer/rest-api/concepts/errors?view=odsp-graph-online

import U = pxt.U

interface OneEntry {
    "@microsoft.graph.downloadUrl": string;
    "lastModifiedDateTime": string;
    "id": string;
    "name": string;
    "size": number;
    "eTag": string;
    "cTag": string;
}

export class Provider extends cloudsync.ProviderBase implements cloudsync.Provider {
    private entryCache: pxt.Map<OneEntry> = {}

    private loadFrameTimeout = 6000;

    private oauthWindow_: any;
    private oauthInterval_: any;

    private static ONEDRIVE_SCOPE = 'Files.ReadWrite User.Read';

    constructor() {
        super("onedrive", lf("Microsoft OneDrive"), "xicon onedrive", "https://graph.microsoft.com/v1.0");

        (window as any).activeRenewals = {};
        (window as any).callBackMappedToRenewStates = {};

    }

    loginAsync(redirect?: boolean, silent?: boolean): Promise<cloudsync.ProviderLoginResponse> {
        return new Promise<cloudsync.ProviderLoginResponse>((resolve, reject) => {
            const p = this.loginInner() as any;
            p.scope = Provider.ONEDRIVE_SCOPE;
            if (silent) {
                p.prompt = 'none';

                const user = pxt.storage.getLocal("cloudUser");
                if (user) p.login_hint = JSON.parse(user).loginHint;
            }

            const url = core.stringifyQueryString("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", p)

            if (silent) {
                this.silentLoginHelper(url, resolve, reject);
                return;
            }

            // It's recommended to always use redirects with Iframes and IE
            // https://docs.microsoft.com/en-us/azure/active-directory/develop/tutorial-v2-javascript-spa
            const shouldPopup = !pxt.BrowserUtils.isIFrame() && !pxt.BrowserUtils.isIE() && !p.redirect && !redirect;
            if (shouldPopup) {
                this.popupLoginHelper(url, resolve, reject);
                return;
            }

            // Redirect
            window.location.href = url
        }).then((resp) => {
            this.setNewToken(resp.accessToken, resp.expiresIn);
            return resp;
        }).finally(() => {
            this.loginCompleteInner();
        });
    }

    silentLoginHelper(url: string, resolve: Function, reject: Function) {
        // Silently refresh the token by attempting to login in a hidden iframe
        const loginIFrame = this.addAdalFrame("onedriveLogin");

        // If for whatever reason we fail to login from this iframe, try to login with silent=false
        const retryLogin = () => {

            // Delete the login iframe if it exists
            if (loginIFrame && loginIFrame.parentNode) {
                loginIFrame.parentNode.removeChild(loginIFrame);
            }

            // Try to login with popup or redirect instead
            this.loginAsync()
                .then((val) => resolve(val))
                .catch((err) => reject(err));
        }

        const reportError = (msg: string) => {
            pxt.debug("Error silently logging in: " + msg);
            retryLogin();
        }

        if (!loginIFrame) {
            // Failed to create the login frame
            retryLogin();
        }
        loginIFrame.src = url;

        const parseAccessToken = (iframeData: Event) => {
            // read the iframe href
            let frameHash = "";
            try {
                // this will throw a cross-domain error for any issue other than success
                // as the iframe will diplay the error on the login.microsoft domain
                frameHash = (iframeData.currentTarget as HTMLIFrameElement).contentWindow.location.hash;
            }
            catch (error) {
                reportError(error);
                return;
            }

            // parse iframe query string parameters
            const qs = core.parseQueryString(frameHash);

            const error = qs["error"];
            if (error) {
                const errorDescription = qs["error_description"];
                reportError(errorDescription ? decodeURIComponent(errorDescription) : error);
                return;
            }

            let accessToken = qs["access_token"];
            let expiresInSeconds = qs["expires_in"];

            if (accessToken) {
                let ex = pxt.storage.getLocal(cloudsync.OAUTH_STATE);
                if (!ex) {
                    reportError("OAuth not started");
                    return;
                }
                if (ex != qs["state"]) {
                    reportError("OAuth state mismatch");
                    return;
                }
                pxt.storage.removeLocal(cloudsync.OAUTH_STATE);
                pxt.storage.setLocal(cloudsync.OAUTH_HASH, frameHash);
            } else {
                reportError("access_token not in #");
                return;
            }

            // delete the iframe, and event handler.
            const frame = (iframeData.currentTarget as HTMLIFrameElement);
            frame.parentNode.removeChild(frame);

            resolve({
                accessToken: accessToken,
                expiresIn: expiresInSeconds
            })
        }

        // bind event handler to iframe for parse query string on load
        loginIFrame.addEventListener("load", function (iframeData) {
            parseAccessToken(iframeData);
        });
    }

    popupLoginHelper(url: string, resolve: Function, reject: Function) {
        let popUpWindow = pxt.BrowserUtils.popupWindow(url, lf("Login with Microsoft"), 483, 600);
        if (!popUpWindow) {
            // Failed to create popup, login with redirects instead
            this.loginAsync(true)
                .then((val) => resolve(val))
                .catch((err) => reject(err));
            return;
        }

        // Pop out
        const popupCallback = () => {
            const qs = core.parseQueryString(pxt.storage.getLocal(cloudsync.OAUTH_HASH) || "")
            const accessToken = qs["access_token"];
            const expiresInSeconds = parseInt(qs["expires_in"]);

            // Go back to the editor.
            // pxt.BrowserUtils.changeHash("", true);
            // window.location.reload();
            if (!accessToken || !expiresInSeconds) {
                reject(new Error("Failed to login, most likely the user closed the popup"));
                return;
            }

            resolve({
                accessToken: accessToken,
                expiresIn: expiresInSeconds
            });
        }
        let pollTimer = window.setInterval(() => {
            if (popUpWindow.closed) {
                window.clearInterval(pollTimer);
                popupCallback();
            }
        }, 1000);
    }

    login(silent?: boolean) {
        const p = this.loginInner() as any;
        p.scope = "Files.ReadWrite User.Read"
        if (silent) p.prompt = 'none';
        const url = core.stringifyQueryString("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", p)

        let loginInProgress = false;

        if (silent) {
            // Silently refresh the token by attempting to login in a hidden iframe
            const loginIFrame = this.addAdalFrame("onedriveLogin");

            // If for whatever reason we fail to login from this iframe, try to login with silent=false
            const retryLogin = () => {

                // Delete the login iframe if it exists
                if (loginIFrame && loginIFrame.parentNode) {
                    loginIFrame.parentNode.removeChild(loginIFrame);
                }

                // Try to login with popup or redirect instead
                this.login();
            }

            if (!loginIFrame) {
                // Failed to create the login frame
                retryLogin();
            }
            loginIFrame.src = "about:blank";

            const parseAccessToken = (iframeData: Event) => {
                // read the iframe href
                let frameHash = "";
                try {
                    // this will throw a cross-domain error for any issue other than success
                    // as the iframe will diplay the error on the login.microsoft domain
                    frameHash = (iframeData.currentTarget as HTMLIFrameElement).contentWindow.location.hash;
                }
                catch (error) {
                    retryLogin();
                    return;
                }

                // parse iframe query string parameters
                const qs = core.parseQueryString(frameHash);

                let accessToken = qs["access_token"];
                let expiresInSeconds = qs["expires_in"];

                if (accessToken) {
                    let ex = pxt.storage.getLocal(cloudsync.OAUTH_STATE);
                    if (!ex) {
                        pxt.debug("OAuth not started")
                        retryLogin();
                        return;
                    }
                    if (ex != qs["state"]) {
                        pxt.debug("OAuth state mismatch")
                        retryLogin();
                        return;
                    }
                    pxt.storage.removeLocal(cloudsync.OAUTH_STATE);
                    pxt.storage.setLocal(cloudsync.OAUTH_HASH, frameHash);
                } else {
                    pxt.debug("access_token not in #")
                    retryLogin();
                    return;
                }

                // delete the iframe, and event handler.
                const frame = (iframeData.currentTarget as HTMLIFrameElement);
                frame.parentNode.removeChild(frame);
            }

            // bind event handler to iframe for parse query string on load
            loginIFrame.addEventListener("load", function (iframeData) {
                parseAccessToken(iframeData);
            });

            //this.loadIframeTimeout(url, 'onedriveLogin');

            if (loginIFrame) {


                loginInProgress = true;
            }
        }

        // It's recommended to always use redirects with Iframes and IE
        // https://docs.microsoft.com/en-us/azure/active-directory/develop/tutorial-v2-javascript-spa
        const shouldPopup = !pxt.BrowserUtils.isIFrame() && !pxt.BrowserUtils.isIE() && !p.redirect && !silent;
        if (shouldPopup) {
            // Pop out
            const popupCallback = () => {
                pxt.BrowserUtils.changeHash("", true);
                window.location.reload();
            }
            const that = this;
            that.oauthWindow_ = pxt.BrowserUtils.popupWindow(url, lf("Login with Microsoft"), 483, 600);
            that.oauthInterval_ = window.setInterval(() => {
                if (that.oauthWindow_.closed) {
                    window.clearInterval(that.oauthInterval_);
                    popupCallback();
                }
            }, 1000);
            loginInProgress = !!that.oauthWindow_;
        }

        // Fall back to using redirects if popups are blocked
        if (!loginInProgress) {
            // Redirect
            window.location.href = url
        }
    }

    /*
   * Used to add the developer requested callback to the array of callbacks for the specified scopes. The updated array is stored on the window object
   * @param {string} scope - Developer requested permissions. Not all scopes are guaranteed to be included in the access token returned.
   * @param {string} expectedState - Unique state identifier (guid).
   * @param {Function} resolve - The resolve function of the promise object.
   * @param {Function} reject - The reject function of the promise object.
   * @ignore
   * @hidden
   */
    private registerCallback(expectedState: string, scope: string, resolve: Function, reject: Function): void {
        (window as any).activeRenewals[scope] = expectedState;
        if (!(window as any).callBacksMappedToRenewStates[expectedState]) {
            (window as any).callBacksMappedToRenewStates[expectedState] = [];
        }
        (window as any).callBacksMappedToRenewStates[expectedState].push({ resolve: resolve, reject: reject });
        if (!(window as any).callBackMappedToRenewStates[expectedState]) {
            (window as any).callBackMappedToRenewStates[expectedState] =
                (errorDesc: string, token: string, error: string, tokenType: string) => {
                    (window as any).activeRenewals[scope] = null;
                    for (let i = 0; i < (window as any).callBacksMappedToRenewStates[expectedState].length; ++i) {
                        try {
                            if (errorDesc || error) {
                                (window as any).callBacksMappedToRenewStates[expectedState][i].reject(errorDesc + '|' + error);
                            }
                            else if (token) {
                                (window as any).callBacksMappedToRenewStates[expectedState][i].resolve(token);
                            }
                        } catch (e) {
                            //this._logger.warning(e);
                        }
                    }
                    (window as any).callBacksMappedToRenewStates[expectedState] = null;
                    (window as any).callBackMappedToRenewStates[expectedState] = null;
                };
        }
    }

    /*
     * Calling _loadFrame but with a timeout to signal failure in loadframeStatus. Callbacks are left.
     * registered when network errors occur and subsequent token requests for same resource are registered to the pending request.
     * @ignore
     * @hidden
     */
    private loadIframeTimeout(urlNavigate: string, frameName: string, scope: string): void {
        //set iframe session to pending
        const expectedState = (window as any).activeRenewals[scope];
        pxt.debug("Set loading state to pending for: " + scope + ":" + expectedState);
        pxt.storage.setLocal("renewStatus" + expectedState, "In Progress");
        this.loadFrame(urlNavigate, frameName);
        setTimeout(() => {
            if (pxt.storage.getLocal("renewStatus" + expectedState) === "In Progress") {
                // fail the iframe session if it"s in pending state
                pxt.debug("Loading frame has timed out after: " + (this.loadFrameTimeout / 1000) + " seconds for scope " + scope + ":" + expectedState);
                if (expectedState && (window as any).callBackMappedToRenewStates[expectedState]) {
                    (window as any).callBackMappedToRenewStates[expectedState]("Token renewal operation failed due to timeout", null, "Token Renewal Failed", "access_token");
                }

                pxt.storage.setLocal("renewStatus" + expectedState, "Canceled");
            }
        }, this.loadFrameTimeout);
    }

    /*
     * Loads iframe with authorization endpoint URL
     * @ignore
     * @hidden
     */
    private loadFrame(urlNavigate: string, frameName: string): void {
        // This trick overcomes iframe navigation in IE
        // IE does not load the page consistently in iframe
        pxt.debug("LoadFrame: " + frameName);
        let frameCheck = frameName;
        setTimeout(() => {
            let frameHandle = this.addAdalFrame(frameCheck);
            if (frameHandle.src === "" || frameHandle.src === "about:blank") {
                frameHandle.src = urlNavigate;
                //pxt.debug("Frame Name : " + frameName + " Navigated to: " + urlNavigate);
            }
        },
            500);
    }

    // As per https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-core/src/UserAgentApplication.ts#L1375
    private addAdalFrame(iframeId: string): HTMLIFrameElement {
        if (typeof iframeId === "undefined") {
            return null;
        }

        let hiddenFrame = document.getElementById(iframeId) as HTMLIFrameElement;
        if (!hiddenFrame) {
            if (document.createElement &&
                document.documentElement &&
                (window.navigator.userAgent.indexOf("MSIE 5.0") === -1)) {
                const ifr = document.createElement("iframe");
                ifr.setAttribute("id", iframeId);
                ifr.style.visibility = "hidden";
                ifr.style.position = "absolute";
                ifr.style.width = ifr.style.height = "0";
                ifr.style.border = "0";
                hiddenFrame = (document.getElementsByTagName("body")[0].appendChild(ifr) as HTMLIFrameElement);
            } else if (document.body && document.body.insertAdjacentHTML) {
                document.body.insertAdjacentHTML('beforeend', '<iframe name="' + iframeId + '" id="' + iframeId + '" style="display:none"></iframe>');
            }

            if (window.frames && (window as any).frames[iframeId]) {
                hiddenFrame = (window as any).frames[iframeId];
            }
        }

        return hiddenFrame;
    }

    getUserInfoAsync() {
        return this.getJsonAsync("/me")
            .then(resp => ({
                name: resp.displayName as string || lf("{0} User", this.friendlyName),
                loginHint: resp.userPrincipalName as string,
                id: resp.id
            }));
        // .then(info => {
        //     return this.reqAsync({ url: "/me/photo/$value" })
        //         .then(resp => ({
        //             // const url = window.URL || window.webkitURL;
        //             // const blobUrl = url.createObjectURL(image.data);
        //             // document.getElementById(imageElement).setAttribute("src", blobUrl);
        //             name: info.name,
        //             id: info.id,
        //             photo: window.URL.createObjectURL(resp.buffer)
        //         }));
        // });
    }

    listAsync() {
        // ,size,cTag,eTag
        return this.getJsonAsync(rootdir + "/children?select=@microsoft.graph.downloadUrl,lastModifiedDateTime,cTag,id,name")
            .then(lst => {
                let suff = this.fileSuffix()
                let res: cloudsync.FileInfo[] = []
                for (let r of (lst.value || []) as OneEntry[]) {
                    if (!U.endsWith(r.name.toLowerCase(), suff))
                        continue
                    this.entryCache[r.id] = r
                    res.push({
                        id: r.id,
                        name: r.name,
                        version: r.cTag,
                        updatedAt: this.parseTime(r.lastModifiedDateTime)
                    })
                }
                console.log('resp', lst);
                return res
            })
    }

    async downloadAsync(id: string): Promise<cloudsync.FileInfo> {
        let cached = this.entryCache[id]
        let recent = false
        if (!cached || !cached["@microsoft.graph.downloadUrl"]) {
            cached = await this.getJsonAsync("/me/drive/items/" + id)
            this.entryCache[id] = cached
            recent = true
        }
        try {
            let resp = await U.requestAsync({ url: cached["@microsoft.graph.downloadUrl"] })
            return {
                id: id,
                // We assume the downloadUrl would be for a given cTag; eTags seem to change too often.
                version: cached.cTag,
                name: cached.name || "?",
                updatedAt: this.parseTime(resp.headers["last-modified"] as string),
                content: JSON.parse(resp.text)
            }
        } catch (e) {
            // in case of failure when using cached URL, try getting the download URL again
            if (!recent) {
                delete cached["@microsoft.graph.downloadUrl"]
                return this.downloadAsync(id)
            }
            throw e
        }
    }

    async uploadAsync(id: string, prevVersion: string, files: pxt.Map<string>): Promise<cloudsync.FileInfo> {
        console.log('1drive uploadAsync', id, prevVersion);
        let cached = this.entryCache[id || "???"]
        if (cached)
            delete cached["@microsoft.graph.downloadUrl"]

        let path = "/me/drive/items/" + id + "/content"

        if (!id) {
            let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
            path = rootdir + ":/" + encodeURIComponent(this.createFileNameWithSuffix(cfg.name)) +
                ":/content?@microsoft.graph.conflictBehavior=rename"
        }

        let resp = await this.reqAsync({
            url: path,
            method: "PUT",
            data: JSON.stringify(files, null, 1),
            headers: !prevVersion ? {} :
                {
                    "if-match": prevVersion
                }
        })

        if (resp.statusCode == 412) // Ignore uploads that are out of sync
            return undefined;

        if (resp.statusCode >= 300)
            this.syncError(lf("Can't upload file to {0}", this.friendlyName))

        cached = resp.json
        this.entryCache[cached.id] = cached

        return {
            id: cached.id,
            version: cached.cTag,
            updatedAt: U.nowSeconds(),
            name: cached.name,
        }
    }

    async updateAsync(id: string, newName: string): Promise<void> {
        const name = {
            "name": this.createFileNameWithSuffix(newName)
        }
        const resp = await this.reqAsync({
            url: "/me/drive/items/" + id,
            method: "PATCH",
            data: JSON.stringify(name),
            headers: {
                "Content-type": "application/json"
            }
        })

        if (resp.statusCode >= 400)
            this.syncError(lf("Can't rename {0} file", this.friendlyName))
    }

    async deleteAsync(id: string): Promise<void> {
        let resp = await this.reqAsync({
            url: "/me/drive/items/" + id,
            method: "DELETE",
        })

        if (resp.statusCode != 204)
            this.syncError(lf("Can't delete {0} file", this.friendlyName))

        delete this.entryCache[id]
    }
}
