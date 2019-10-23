import * as dialogs from "./dialogs";
import * as cloudsync from "./cloudsync";

export class GithubProvider implements cloudsync.IdentityProvider {
    name: string;
    friendlyName: string;
    icon: string;

    constructor() {
        this.name = "github";
        this.friendlyName = "GitHub";
        this.icon = "icon github";
    }

    loginCheck(): void {
        if (!pxt.github.token)
            this.login();
    }

    login(): void {
        dialogs.showGithubLoginAsync().done();
    }

    loginCallback(queryString: pxt.Map<string>): void {
        ts.pxtc.Util.userError("TODO");
    }

    getUserInfoAsync(): Promise<cloudsync.UserInfo> {
        // https://developer.github.com/v3/users/#get-the-authenticated-user
        return pxt.github.authenticatedUserAsync()
            .then<cloudsync.UserInfo>(ghuser => {
                return { id: ghuser.login, name: ghuser.name }
            })
    }
}

export const provider = new GithubProvider;