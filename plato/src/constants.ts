export namespace Strings {
    export const AppTitle = lf("Play Together");
    export const AppTitleShort = lf("Play Together");
    export const WelcomeUserFmt = (name: string) => lf("Welcome {0}!", name);
    export const MissingName = lf("(Anonymous User)");
    export const PlayerJoinedFmt = (name: string) => lf("{0} joined", name);
    export const PlayerLeftFmt = (name: string) => lf("{0} left", name);
    export const Privacy = lf("Privacy");
    export const TermsOfUse = lf("Terms of Use");
    export const Settings = lf("Settings");
    export const SignInMessage = lf("Sign in to Play Together");
    export const SignUpMessage = lf("Sign up to Play Together");
    export const HostGameDescription = lf("Start a new game and invite your friends to join.");
    export const HostGameLabel = lf("Host");
    export const JoinGameDescription = lf("Enter a game code to join an existing game.");
    export const JoinGameLabel = lf("Join");
    export const BuildGameDescription = lf("Create your own game in MakeCode Arcade.");
    export const BuildGameLabel = lf("Build");
    export const GameGalleryTitle = lf("Games");
}

export namespace Ticks {
    export const Loaded = "plato.loaded";
    export const HomeLink = "plato.homelink";
    export const BrandLink = "plato.brandlink";
    export const OrgLink = "plato.orglink";
    export const UserMenuSignIn = "plato.usermenu.signin";
    export const UserMenuSignout = "plato.usermenu.signout";
    export const PrivacyStatementClicked = "plato.privacy.clicked";
    export const TermsOfUseClicked = "plato.termsofuse.clicked";
    export const Disconnected_Kicked = "plato.disconnected.gotkicked";
    export const Disconnected_Ended = "plato.disconnected.collabended";
    export const Disconnected_Left = "plato.disconnected.leftcollab";
    export const Disconnected_Full = "plato.disconnected.collabfull";
    export const Disconnected_Rejected = "plato.disconnected.rejected";
    export const Disconnected_NotFound = "plato.disconnected.collabnotfound";
    export const Disconnected_Unknown = "plato.disconnected.unknown";
}
