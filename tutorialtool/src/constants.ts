export namespace Ticks {
    export const Loaded = "tutorialtool.loaded";
    export const HomeLink = "tutorialtool.homelink";
    export const BrandLink = "tutorialtool.brandlink";
    export const OrgLink = "tutorialtool.orglink";
    export const Error = "tutorialtool.error";
}

namespace Misc {
    export const LearnMoreLink = "https://makecode.com/tutorialtool"; // TODO: Replace with golink or aka.ms link
}

export const Constants = Object.assign(Misc, { Ticks });
