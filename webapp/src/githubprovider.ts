import * as dialogs from "./dialogs";
import * as cloudsync from "./cloudsync";

export class GithubProvider implements cloudsync.IdentityProvider {
    name: string;
    friendlyName: string;

    constructor() {
        this.name = "github";
        this.friendlyName = "GitHub";
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