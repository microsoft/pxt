import * as React from "react";

export interface PrintPreviewIFrameProps {
    docsUrl?: string;
    projectText: pxt.Map<string>;
    ariaLabel?: string;

}

export const PrintPreviewIframe = (props: PrintPreviewIFrameProps) => {
    const { docsUrl, projectText, ariaLabel } = props;


    let preferredEditor = "blocks";

    try {
        const config = JSON.parse(projectText[pxt.CONFIG_NAME]) as pxt.PackageConfig;

        if (config.preferredEditor === pxt.JAVASCRIPT_PROJECT_NAME) {
            preferredEditor = "typescript"
        }
        else if (config.preferredEditor === pxt.PYTHON_PROJECT_NAME) {
            preferredEditor = "python";
        }
    }
    catch (e) {

    }

    return <div>
        <iframe
            frameBorder="0"
            aria-label={ariaLabel || lf("Print preview")}
            sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
            src={url}
        />
    </div>
}