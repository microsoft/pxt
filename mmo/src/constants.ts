export namespace Strings {
    export const AppTitle = lf("Arcade MMO");
    export const AppTitleShort = lf("Arcade MMO");
    export const WelcomeUserFmt = (name: string) => lf("Welcome {0}!", name);
    export const MissingName = lf("(Anonymous User)");
    export const PlayerJoinedFmt = (name: string) => lf("{0} joined", name);
    export const PlayerLeftFmt = (name: string) => lf("{0} left", name);
    export const Privacy = lf("Privacy");
    export const TermsOfUse = lf("Terms of Use");
    export const Settings = lf("Settings");
}

export namespace Ticks {
    export const Loaded = "mmo.loaded";
    export const HomeLink = "mmo.homelink";
    export const BrandLink = "mmo.brandlink";
    export const OrgLink = "mmo.orglink";
    export const UserMenuSignIn = "mmo.usermenu.signin";
    export const UserMenuSignout = "mmo.usermenu.signout";
    export const PrivacyStatementClicked = "mmo.privacy.clicked";
    export const TermsOfUseClicked = "mmo.termsofuse.clicked";
    export const Disconnected_Kicked = "mmo.disconnected.gotkicked";
    export const Disconnected_Ended = "mmo.disconnected.collabended";
    export const Disconnected_Left = "mmo.disconnected.leftcollab";
    export const Disconnected_Full = "mmo.disconnected.collabfull";
    export const Disconnected_Rejected = "mmo.disconnected.rejected";
    export const Disconnected_NotFound = "mmo.disconnected.collabnotfound";
    export const Disconnected_Unknown = "mmo.disconnected.unknown";
}
