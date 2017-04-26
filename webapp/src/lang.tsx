import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

type ISettingsProps = pxt.editor.ISettingsProps;

const lf = pxt.Util.lf;

interface LanguagesState {
    visible?: boolean;
}

export class Languages extends React.Component<ISettingsProps, LanguagesState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }
    }
}
