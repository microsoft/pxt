import * as data from "./data";
import * as React from "react";

import { MenuBar } from "../../react-common/components/controls/MenuBar";
import { Button } from "../../react-common/components/controls/Button";

type ISettingsProps = pxt.editor.ISettingsProps;

interface ExtensionsState {
    visible?: boolean;
}

export class ExtensionsBrowser extends data.Component<ISettingsProps, ExtensionsState>{

    constructor(props: ISettingsProps) {
        super(props)

        this.state = {
            visible: false
        }

        this.showExtensions = this.showExtensions.bind(this);
        this.onBackClicked = this.onBackClicked.bind(this);

    }

    showExtensions() {
        this.setState({
            ...this.state,
            visible: true
        })
    }

    onBackClicked() {
        this.setState({
            ...this.state,
            visible: false
        })
    }

    renderCore() {
        const { visible } = this.state;
        return <div className={`extensionsBrowser ${visible ? "" : "hide"}`} >
            <MenuBar className="extensionsHeader" ariaLabel={lf("Extentions")}>
                <div className="header-left">
                    <Button className="menu-button" leftIcon="fas fa-arrow-left large" title={lf("Back")} label={lf("Back")} onClick={this.onBackClicked}/>
                </div>
            </MenuBar>

        </div>
    }
}