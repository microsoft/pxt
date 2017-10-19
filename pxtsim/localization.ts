// Localization functions. Please port any modifications over to pxtlib/util.ts
namespace pxsim.localization {
    let _localizeStrings: Map<string> = {};

    export function setLocalizedStrings(strs: Map<string>) {
        _localizeStrings = strs || {};
    }

    export function lf(s: string): string {
        return _localizeStrings[s] || s;
    }
}