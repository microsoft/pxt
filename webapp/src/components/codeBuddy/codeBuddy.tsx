import * as React from "react";
import * as data from "../../data";

import { ChatControl } from "./chatControl";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CodeBuddyProps extends ISettingsProps {
}

export class CodeBuddy extends data.PureComponent<CodeBuddyProps, any> {

    constructor(props: CodeBuddyProps) {
        super(props);
    }

    renderCore() {
        const { collapsed } = this.props;

        return <div id="codebuddy" className={collapsed ? "expanded" : "collapsed"}>
            <ChatControl />
        </div>
    }
}
