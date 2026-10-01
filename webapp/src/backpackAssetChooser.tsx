import * as React from "react";
import * as ReactDOM from "react-dom";
import { BackpackAssetChoice, BackpackAssetChooser } from "./components/BackpackAssetChooser";

export async function chooseBackpackAssetAsync(choices: BackpackAssetChoice[]): Promise<string | undefined> {
    // A Blockly drop must finish restoring the dragged block before a modal takes focus.
    await Promise.resolve();
    const host = document.body.appendChild(document.createElement("div"));
    try {
        return await new Promise<string | undefined>(resolve => {
            ReactDOM.render(
                <BackpackAssetChooser
                    choices={choices}
                    onSelect={resolve}
                    onCancel={() => resolve(undefined)}
                />,
                host
            );
        });
    } finally {
        ReactDOM.unmountComponentAtNode(host);
        host.remove();
    }
}
