/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import * as filelist from "./filelist";
import * as keymap from "./keymap";
import * as serialindicator from "./serialindicator"
import * as simtoolbar from "./simtoolbar";

import { TabContent } from "./components/core/TabContent";
import { TabPane } from "./components/core/TabPane";
import { TutorialContainer } from "./components/tutorial/TutorialContainer";

interface SidepanelState {
    activeTab?: string;
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

    tutorialOptions?: pxt.tutorial.TutorialOptions;

    showMiniSim: (visible?: boolean) => void;
    openSerial: (isSim: boolean) => void;
    handleHardwareDebugClick: () => void;
    handleFullscreenButtonClick: () => void;
}

export class Sidepanel extends data.Component<SidepanelProps, SidepanelState> {
    protected simPanelRef: HTMLDivElement;
    constructor(props: SidepanelProps) {
        super(props);
    }

    protected handleSimSerialClick = () => {
        this.props.openSerial(true);
    }

    protected handleDeviceSerialClick = () => {
        this.props.openSerial(false);
    }

    protected handleSimTabSelected = () => {
        this.props.showMiniSim(false);
    }

    protected handleTutorialTabSelected = () => {
        this.setState({ activeTab: "tab-tutorial" });
        this.props.showMiniSim(true);
    }

    protected handleSimOverlayClick = () => {
        const { tutorialOptions, handleFullscreenButtonClick } = this.props;
        if (!tutorialOptions || !pxt.BrowserUtils.isVerticalTutorial()) {
            handleFullscreenButtonClick();
        } else {
            this.setState({ activeTab: "tab-simulator" });
            this.props.showMiniSim(false);
        }
    }

    protected handleSimPanelRef = (c: HTMLDivElement) => {
        this.simPanelRef = c;
        if (c && typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
                const scrollVisible = c.scrollHeight > c.clientHeight;
                if (scrollVisible)
                    this.simPanelRef.classList.remove("invisibleScrollbar");
                else
                    this.simPanelRef.classList.add("invisibleScrollbar");
            })
            observer.observe(c);
        }
    }

    renderCore() {
        const { parent, inHome, showKeymap, showSerialButtons, showFileList, showFullscreenButton,
            collapseEditorTools, simSerialActive, deviceSerialActive, tutorialOptions,
            handleHardwareDebugClick } = this.props;

        return <div id="simulator" className="simulator">
            <TabPane id="editorSidebar" activeTabName={this.state.activeTab}>
                <TabContent name="tab-simulator" icon="game" onSelected={this.handleSimTabSelected}>
                    <div className="ui items simPanel" ref={this.handleSimPanelRef}>
                        <div id="boardview" className="ui vertical editorFloat" role="region" aria-label={lf("Simulator")} tabIndex={inHome ? -1 : 0} />
                        <simtoolbar.SimulatorToolbar parent={parent} collapsed={collapseEditorTools} simSerialActive={simSerialActive} devSerialActive={deviceSerialActive} />
                        {showKeymap && <keymap.Keymap parent={parent} />}
                        <div className="ui item portrait hide hidefullscreen">
                            {pxt.options.debug && <sui.Button key="hwdebugbtn" className="teal" icon="xicon chip" text={"Dev Debug"} onClick={handleHardwareDebugClick} />}
                        </div>
                        {showSerialButtons && <div id="serialPreview" className="ui editorFloat portrait hide hidefullscreen">
                            <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={this.handleSimSerialClick} parent={parent} />
                            <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={this.handleDeviceSerialClick} parent={parent} />
                        </div>}
                        {showFileList && <filelist.FileList parent={parent} />}
                        {showFullscreenButton && <div id="miniSimOverlay" role="button" title={lf("Open in fullscreen")} onClick={this.handleSimOverlayClick} />}
                    </div>
                </TabContent>
                {tutorialOptions && <TabContent name="tab-tutorial" icon="pencil" onSelected={this.handleTutorialTabSelected}>
                    <TutorialContainer parent={parent} steps={tutorialOptions?.tutorialStepInfo}
                        currentStep={tutorialOptions?.tutorialStep} tutorialOptions={tutorialOptions} />
                </TabContent>}
            </TabPane>
        </div>
    }
}
