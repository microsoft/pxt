import * as React from "react";

interface AssetTopbarProps {
}

export class AssetTopbar extends React.Component<AssetTopbarProps> {
    render() {
        return <div className="asset-editor-topbar">
            <button className="asset-editor-button create-new">{lf("Create New")}</button>
        </div>
    }
}
