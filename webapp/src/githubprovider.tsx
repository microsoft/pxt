import * as React from "react";
import * as sui from "./sui";
import * as core from "./core";
import * as cloudsync from "./cloudsync";
import * as dialogs from "./dialogs";
import * as workspace from "./workspace";

export const PROVIDER_NAME = "github";

export class GithubProvider extends cloudsync.ProviderBase {
    constructor() {
        super(PROVIDER_NAME, lf("GitHub"), "icon github", "https://api.github.com");
        pxt.github.handleGithubNetworkError = (e: any) => {
            if (e.statusCode == 401) {
                pxt.log(`github: invalid token`)
                this.clearToken();
                return true; // retry
            } else if (e.statusCode == 403) {
                pxt.log(`github: unauthorized access`)
            }
            return false;
        }
    }

    clearToken() {
        pxt.github.token = undefined;
        super.logout();
    }

    logout() {
        pxt.github.token = undefined;
        super.logout();

        window.location.href = "https://github.com/logout";
    }

    hasSync(): boolean {
        return false;
    }

    hasToken(): boolean {
        this.loginCheck();
        return !!this.token();
    }

    loginCheck() {
        super.loginCheck();

        // update github in-memory token
        const tok = this.token();
        pxt.github.token = tok;
    }

    loginAsync(redirect?: boolean, silent?: boolean): Promise<cloudsync.ProviderLoginResponse> {
        return this.routedLoginAsync(undefined);
    }

    routedLoginAsync(route: string) {
        this.loginCheck()
        let p = Promise.resolve();
        if (!this.token()) {
            p = p.then(() => this.showLoginAsync(route));
        }
        return p.then(() => { return { accessToken: this.token() } as cloudsync.ProviderLoginResponse; });
    }

    private showLoginAsync(route: string): Promise<void> {
        pxt.tickEvent("github.login.dialog");
        // auth flow if github provider is prsent
        const oAuthSupported = pxt.appTarget
            && pxt.appTarget.cloud
            && pxt.appTarget.cloud.cloudProviders
            && !!pxt.appTarget.cloud.cloudProviders[this.name];

        let useToken = !oAuthSupported;
        let form: HTMLElement;
        return core.confirmAsync({
            header: lf("Sign in with GitHub"),
            hideCancel: true,
            hasCloseIcon: true,
            helpUrl: "/github",
            agreeLbl: lf("Sign in"),
            onLoaded: (el) => {
                form = el;
            },
            jsxd: () => <div className="ui form">
                <p>{lf("You need to sign in with GitHub to use this feature.")}</p>
                <p>{lf("You can host your code on GitHub and collaborate with friends on projects.")}</p>
                {!useToken && <p className="ui small">
                    {lf("Looking to use a Developer token instead?")}
                    <sui.Link className="link" text={lf("Use Developer token")} onClick={showToken} />
                </p>}
                {useToken && <ol>
                    <li>
                        {lf("Navigate to: ")}
                        <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer">
                            {lf("GitHub token generation page")}
                        </a>
                    </li>
                    <li>
                        {lf("Put something like 'MakeCode {0}' in description", pxt.appTarget.name)}
                    </li>
                    <li>
                        {lf("Select either '{0}' or '{1}' scope, depending which repos you want to edit from here", "repo", "public_repo")}
                    </li>
                    <li>
                        {lf("Click generate token, copy it, and paste it below.")}
                    </li>
                </ol>}
                {useToken && <div className="ui field">
                    <label id="selectUrlToOpenLabel">{lf("Paste GitHub token here:")}</label>
                    <input type="url" tabIndex={0} autoFocus aria-labelledby="selectUrlToOpenLabel" placeholder="0123abcd..." className="ui blue fluid"></input>
                </div>}
            </div>,
        }).then(res => {
            if (!res) {
                pxt.tickEvent("github.login.cancel");
                return Promise.resolve()
            } else {
                if (useToken) {
                    const input = form.querySelectorAll('input')[0] as HTMLInputElement;
                    const hextoken = input.value.trim();
                    return this.saveAndValidateTokenAsync(hextoken);
                }
                else {
                    return this.oauthRedirectAsync(route);
                }
            }
        })

        function showToken() {
            useToken = true;
            core.forceUpdate();
        }
    }

    public authorizeAppAsync(route?: string) {
        return this.oauthRedirectAsync(route || window.location.hash, true);
    }

    private oauthRedirectAsync(route: string, consent?: boolean): Promise<void> {
        core.showLoading("ghlogin", lf("Signing you into GitHub..."))
        route = (route || "").replace(/^#/, "");
        const state = cloudsync.setOauth(this.name, route ? `#github:${route}` : undefined);
        const self = window.location.href.replace(/#.*/, "")
        const login = pxt.Cloud.getServiceUrl() +
            "/oauth/login?state=" + state +
            (consent ? "&prompt=consent" : "") +
            "&response_type=token&client_id=gh-token&redirect_uri=" +
            encodeURIComponent(self)
        window.location.href = login;
        return Promise.delay(1000);
    }

    getUserInfoAsync(): Promise<pxt.editor.UserInfo> {
        if (!this.token())
            return Promise.resolve(undefined);
        return pxt.github.authenticatedUserAsync()
            .then(ghuser => {
                if (!ghuser) {
                    pxt.log(`unkown github user`)
                    return undefined;
                }
                return {
                    id: ghuser.login,
                    userName: ghuser.login,
                    name: ghuser.name,
                    photo: ghuser.avatar_url,
                    profile: `https://github.com/${ghuser.login}`
                }
            })
    }

    setNewToken(token: string) {
        super.setNewToken(token);
        pxt.github.token = token;
    }

    private saveAndValidateTokenAsync(hextoken: string): Promise<void> {
        const LOAD_ID = "githubtokensave";
        core.showLoading(LOAD_ID, lf("validating GitHub token..."));
        return Promise.resolve()
            .then(() => {
                if (hextoken.length != 40 || !/^[a-f0-9]+$/.test(hextoken)) {
                    pxt.tickEvent("github.token.invalid");
                    core.errorNotification(lf("Invalid token format"))
                    return Promise.resolve();
                } else {
                    pxt.github.token = hextoken
                    // try to create a bogus repo - it will fail with
                    // 401 - invalid token, 404 - when token doesn't have repo permission,
                    // 422 - because the request is bogus, but token OK
                    // Don't put any string in repo name - github seems to normalize these
                    return pxt.github.createRepoAsync(undefined, "")
                        .then(r => {
                            // what?!
                            pxt.reportError("github", "Succeeded creating undefined repo!")
                            core.infoNotification(lf("Something went wrong with validation; token stored"))
                            this.setNewToken(hextoken);
                            pxt.tickEvent("github.token.wrong");
                        }, err => {
                            pxt.github.token = ""
                            if (!dialogs.showGithubTokenError(err)) {
                                if (err.statusCode == 422)
                                    core.infoNotification(lf("Token validated and stored"))
                                else
                                    core.infoNotification(lf("Token stored but not validated"))
                                this.setNewToken(hextoken);
                                pxt.tickEvent("github.token.ok");
                            }
                        })
                        .then(() => cloudsync.syncAsync())
                }
            }).finally(() => core.hideLoading(LOAD_ID))
    }

    async createRepositoryAsync(projectName: string, header: pxt.workspace.Header): Promise<boolean> {
        pxt.tickEvent("github.filelist.create.start");
        await this.routedLoginAsync(`create-repository:${header.id}`)
        if (!this.token()) {
            pxt.tickEvent("github.filelist.create.notoken");
            return false;
        }

        const repoid = await dialogs.showCreateGithubRepoDialogAsync(projectName);
        if (!repoid)
            return false;

        pxt.tickEvent("github.filelist.create.export");
        const parsed = pxt.github.parseRepoId(repoid);
        core.showLoading("creategithub", lf("preparing {0} repository...", parsed.project || parsed.fullName))
        try {
            await workspace.exportToGithubAsync(header, repoid);
            return true;
        } finally {
            core.hideLoading("creategithub");
        }
    }
}
