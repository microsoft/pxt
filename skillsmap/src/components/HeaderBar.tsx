import * as React from "react";

interface HeaderBarProps {
}

export class HeaderBar extends React.Component<HeaderBarProps> {
    render() {
        return <div className="header">
            <div className="header-left"><i className="icon game" /></div>
            <div className="spacer" />
            <div className="header-right"><i className="icon square" />MICROSOFT</div>
        </div>
    }
}
