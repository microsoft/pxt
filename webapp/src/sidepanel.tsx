/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import * as filelist from "./filelist";
import * as keymap from "./keymap";
import * as serialindicator from "./serialindicator"
import * as simtoolbar from "./simtoolbar";

interface SidepanelState {
}

interface SidepanelProps extends pxt.editor.ISettingsProps {
    inHome: boolean;

    showKeymap?: boolean;
    showSerialButtons?: boolean;
    showFileList?: boolean;
    showFullscreenButton?: boolean;

    collapseEditorTools?: boolean;
    simSerialActive?: boolean;
    deviceSerialActive?: boolean;

    openSerial: (isSim: boolean) => void;
    handleHardwareDebugClick: () => void;
    handleFullscreenButtonClick: () => void;
}

export class Sidepanel extends data.Component<SidepanelProps, SidepanelState> {
    protected fileListRef: HTMLDivElement;

    constructor(props: SidepanelProps) {
        super(props);
    }

    protected handleSimSerialClick = () => {
        this.props.openSerial(true);
    }

    protected handleDeviceSerialClick = () => {
        this.props.openSerial(false);
    }

    protected handleFileListRef = (c: HTMLDivElement) => {
        this.fileListRef = c;
        if (c && typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
                const scrollVisible = c.scrollHeight > c.clientHeight;
                if (scrollVisible)
                    this.fileListRef.classList.remove("invisibleScrollbar");
                else
                    this.fileListRef.classList.add("invisibleScrollbar");
            })
            observer.observe(c);
        }
    }

    renderCore() {
        const { parent, inHome, showKeymap, showSerialButtons, showFileList, showFullscreenButton,
            collapseEditorTools, simSerialActive, deviceSerialActive,
            handleHardwareDebugClick, handleFullscreenButtonClick } = this.props;

        return <div id="simulator" className="simulator">
            <div>
                <div className="sidepanelTab"></div>
                <div className="sidepanelTab"></div>
            </div>
            <div id="sidepanel">
                <div id="filelist" ref={this.handleFileListRef} className="ui items">
                    <div id="boardview" className={`ui vertical editorFloat`} role="region" aria-label={lf("Simulator")} tabIndex={inHome ? -1 : 0} />
                    <simtoolbar.SimulatorToolbar parent={parent} collapsed={collapseEditorTools} simSerialActive={simSerialActive} devSerialActive={deviceSerialActive} />
                    {showKeymap && <keymap.Keymap parent={parent} />}
                    <div className="ui item portrait hide hidefullscreen">
                        {pxt.options.debug && <sui.Button key='hwdebugbtn' className='teal' icon="xicon chip" text={"Dev Debug"} onClick={handleHardwareDebugClick} />}
                    </div>
                    {showSerialButtons && <div id="serialPreview" className="ui editorFloat portrait hide hidefullscreen">
                        <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={this.handleSimSerialClick} parent={parent} />
                        <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={this.handleDeviceSerialClick} parent={parent} />
                    </div>}
                    {showFileList && <filelist.FileList parent={parent} />}
                    {showFullscreenButton && <div id="filelistOverlay" role="button" title={lf("Open in fullscreen")} onClick={handleFullscreenButtonClick} />}
                </div>
            </div>
        </div>
    }
}