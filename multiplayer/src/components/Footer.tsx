export default function Render() {
    const targetTheme = pxt?.appTarget?.appTheme;

    return targetTheme?.organizationUrl ||
        targetTheme?.organizationUrl ||
        targetTheme?.privacyUrl ||
        targetTheme?.copyrightText ? (
        <div
            className="ui horizontal small link list tw-text-center !tw-pb-2"
            role="contentinfo"
        >
            {targetTheme.organizationUrl && targetTheme.organization ? (
                <a
                    className="item !tw-text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={targetTheme.organizationUrl}
                >
                    {targetTheme.organization}
                </a>
            ) : undefined}
            {targetTheme.termsOfUseUrl ? (
                <a
                    target="_blank"
                    className="item !tw-text-xs"
                    href={targetTheme.termsOfUseUrl}
                    rel="noopener noreferrer"
                >
                    {lf("Terms of Use")}
                </a>
            ) : undefined}
            {targetTheme.privacyUrl ? (
                <a
                    target="_blank"
                    className="item !tw-text-xs"
                    href={targetTheme.privacyUrl}
                    rel="noopener noreferrer"
                >
                    {lf("Privacy")}
                </a>
            ) : undefined}
            {targetTheme.copyrightText ? (
                <div className="ui item copyright !tw-text-xs">
                    {targetTheme.copyrightText}
                </div>
            ) : undefined}
        </div>
    ) : null;
}
