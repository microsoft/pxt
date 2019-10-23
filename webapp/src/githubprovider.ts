import * as dialogs from "./dialogs";
import * as cloudsync from "./cloudsync";

export class GithubProvider extends cloudsync.ProviderBase implements cloudsync.IdentityProvider {
    constructor() {
        super("github", lf("GitHub"), "icon github", "https://api.github.com");
    }

    supportsSync(): boolean {
        return false;
    }

    loginCheck() {
        super.loginCheck();
        const tok = this.token();
        if (tok)
            pxt.github.token = tok;
    }

    login(): void {
        dialogs.showGithubLoginAsync()
            .done(() => this.loginCheck());
    }

    getUserInfoAsync(): Promise<cloudsync.UserInfo> {
        // https://developer.github.com/v3/users/#get-the-authenticated-user
        return pxt.github.authenticatedUserAsync()
            .then<cloudsync.UserInfo>(ghuser => {
                return {
                    id: ghuser.login,
                    name: ghuser.name,
                    imageUrl: ghuser.avatar_url
                }
            })
    }
}

export const provider = new GithubProvider();
