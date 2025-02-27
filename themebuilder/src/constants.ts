export namespace Ticks {
    export const Loaded = "themebuilder.loaded";
    export const HomeLink = "themebuilder.homelink";
    export const BrandLink = "themebuilder.brandlink";
    export const OrgLink = "themebuilder.orglink";
    export const Error = "themebuilder.error";
}

namespace Misc {
    export const LearnMoreLink = "https://makecode.com/themebuilder"; // TODO: Replace with golink or aka.ms link
}

export const Constants = Object.assign(Misc, { Ticks });
