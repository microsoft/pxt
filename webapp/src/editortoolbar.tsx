/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as simulator from "./simulator";

type ISettingsProps = pxt.editor.ISettingsProps;

export class EditorToolbar extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    saveProjectName(name: string, view?: string) {
        pxt.tickEvent("editortools.projectrename", { view: view });
        this.props.parent.updateHeaderName(name);
    }

    compile(view?: string) {
        pxt.tickEvent("editortools.download", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.compile();
    }

    saveFile(view?: string) {
        pxt.tickEvent("editortools.save", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.saveAndCompile();
    }

    undo(view?: string) {
        pxt.tickEvent("editortools.undo", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.undo();
    }

    redo(view?: string) {
        pxt.tickEvent("editortools.redo", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.redo();
    }

    zoomIn(view?: string) {
        pxt.tickEvent("editortools.zoomIn", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.zoomIn();
    }

    zoomOut(view?: string) {
        pxt.tickEvent("editortools.zoomOut", { view: view, collapsed: this.getCollapsedState() });
        this.props.parent.editor.zoomOut();
    }

    startStopSimulator(view?: string) {
        pxt.tickEvent("editortools.startStopSimulator", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() });
        this.props.parent.startStopSimulator();
    }

    restartSimulator(view?: string) {
        pxt.tickEvent("editortools.restart", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() });
        this.props.parent.restartSimulator();
    }

    toggleCollapse(view?: string) {
        pxt.tickEvent("editortools.toggleCollapse", { view: view, collapsedTo: '' + !this.props.parent.state.collapseEditorTools });
        this.props.parent.toggleSimulatorCollapse();
    }

    private getCollapsedState(): string {
        return '' + this.props.parent.state.collapseEditorTools;
    }

    private getHeadlessState(): string {
        return pxt.appTarget.simulator.headless ? "true" : "false";
    }

    render() {
        const state = this.props.parent.state;
        const sandbox = pxt.shell.isSandboxMode();
        const readOnly = pxt.shell.isReadOnly();
        const hideEditorFloats = state.hideEditorFloats;
        const collapsed = state.hideEditorFloats || state.collapseEditorTools;
        const isEditor = this.props.parent.isBlocksEditor() || this.props.parent.isTextEditor();
        if (!isEditor) return <div />;

        const targetTheme = pxt.appTarget.appTheme;
        const compile = pxt.appTarget.compile;
        const compileBtn = compile.hasHex;
        const simOpts = pxt.appTarget.simulator;
        const make = !sandbox && state.showParts && simOpts && (simOpts.instructions || (simOpts.parts && pxt.options.debug));
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const compileLoading = !!state.compiling;
        const runTooltip = state.running ? lf("Stop the simulator") : lf("Start the simulator");
        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const collapseTooltip = collapsed ? lf("Show the simulator") : lf("Hide the simulator");
        const headless = pxt.appTarget.simulator.headless;

        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();

        const run = true;
        const restart = run && !simOpts.hideRestart;

        return <div className="ui equal width grid right aligned padded">
            <div className="column mobile only">
                {collapsed ?
                    <div className="ui equal width grid">
                        <div className="left aligned column">
                            <div className="ui icon small buttons">
                                <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`collapse-button ${hideEditorFloats ? 'disabled' : ''}`} title={collapseTooltip} onClick={() => this.toggleCollapse('mobile') } />
                                {headless && run ? <sui.Button class="" key='runmenubtn' icon={state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('mobile') } /> : undefined }
                                {headless && restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('mobile') } /> : undefined }
                                {compileBtn ? <sui.Button class={`primary download-button download-button-full ${compileLoading ? 'loading' : ''}`} icon="download" title={compileTooltip} onClick={() => this.compile('mobile') } /> : undefined }
                            </div>
                        </div>
                        {readOnly ? undefined :
                            <div className="right aligned column">
                                <div className="ui icon small buttons">
                                    <sui.Button icon='save' class="editortools-btn save-editortools-btn" title={lf("Save") } onClick={() => this.saveFile('mobile') } />
                                    <sui.Button icon='undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo") } onClick={() => this.undo('mobile') } />
                                </div>
                            </div>}
                        <div className="right aligned column">
                            <div className="ui icon small buttons">
                                <sui.Button icon='zoom' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('mobile') } />
                                <sui.Button icon='zoom out' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('mobile') } />
                            </div>
                        </div>
                    </div> :
                    <div className="ui equal width grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <sui.Button class="" key='runmenubtn' icon={state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('mobile') } /> : undefined }
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('mobile') } /> : undefined }
                            </div>
                            <div className="row" style={{ paddingTop: "1rem" }}>
                                <div className="ui vertical icon small buttons">
                                    <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class="collapse-button" title={collapseTooltip} onClick={() => this.toggleCollapse('mobile') } />
                                </div>
                            </div>
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="ui grid column">
                            {readOnly ? undefined :
                                <div className="row">
                                    <div className="column">
                                        <div className="ui icon large buttons">
                                            <sui.Button icon='undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo") } onClick={() => this.undo('mobile') } />
                                        </div>
                                    </div>
                                </div>}
                            <div className="row" style={readOnly ? undefined : { paddingTop: 0 }}>
                                <div className="column">
                                    <div className="ui icon large buttons">
                                        {compileBtn ? <sui.Button class={`primary download-button download-button-full ${compileLoading ? 'loading' : ''}`} icon="download" title={compileTooltip} onClick={() => this.compile('mobile') } /> : undefined }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div> }
            </div>
            <div className="column tablet only">
                {collapsed ?
                    <div className="ui grid seven column">
                        {headless ?
                            <div className="left aligned six wide column">
                                <div className="ui icon large buttons">
                                    <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`large collapse-button ${hideEditorFloats ? 'disabled' : ''}`} title={collapseTooltip} onClick={() => this.toggleCollapse('tablet') } />
                                    {run ? <sui.Button role="menuitem" class="large" key='runmenubtn' icon={state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('tablet') } /> : undefined }
                                    {restart ? <sui.Button key='restartbtn' class={`large restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('tablet') } /> : undefined }
                                    {compileBtn ? <sui.Button class={`primary large download-button download-button-full ${compileLoading ? 'loading' : ''}`} icon="download" title={compileTooltip} onClick={() => this.compile('tablet') } /> : undefined }
                                </div>
                            </div> :
                            <div className="left aligned six wide column">
                                <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class={`large collapse-button ${hideEditorFloats ? 'disabled' : ''}`} title={collapseTooltip} onClick={() => this.toggleCollapse('tablet') } />
                                {compileBtn ? <sui.Button class={`primary large download-button download-button-full ${compileLoading ? 'loading' : ''}`} icon="download" text={ lf("Download") } title={compileTooltip} onClick={() => this.compile('tablet') } /> : undefined }
                            </div> }
                        {readOnly ? undefined :
                            <div className="column four wide">
                                <sui.Button icon='save' class="large editortools-btn save-editortools-btn" title={lf("Save") } onClick={() => this.saveFile('tablet') } />
                            </div>}
                        <div className="column six wide right aligned">
                            {readOnly ? undefined :
                                <div className="ui icon large buttons">
                                    <sui.Button icon='undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo") } onClick={() => this.undo('tablet') } />
                                    <sui.Button icon='repeat' class={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo") } onClick={() => this.redo('tablet') } />
                                </div>}
                            <div className="ui icon large buttons">
                                <sui.Button icon='zoom' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('tablet') } />
                                <sui.Button icon='zoom out' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('tablet') } />
                            </div>
                        </div>
                    </div>
                    : <div className="ui grid">
                        <div className="left aligned two wide column">
                            <div className="ui vertical icon small buttons">
                                {run ? <sui.Button role="menuitem" class="" key='runmenubtn' icon={state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('tablet') } /> : undefined }
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('tablet') } /> : undefined }
                            </div>
                            <div className="row" style={{ paddingTop: "1rem" }}>
                                <div className="ui vertical icon small buttons">
                                    <sui.Button icon={`${collapsed ? 'toggle up' : 'toggle down'}`} class="collapse-button" title={collapseTooltip} onClick={() => this.toggleCollapse('tablet') } />
                                </div>
                            </div>
                        </div>
                        <div className="three wide column">
                        </div>
                        <div className="five wide column">
                            <div className="ui grid right aligned">
                                 {compileBtn ? <div className="row">
                                    <div className="column">
                                       <sui.Button role="menuitem" class={`primary large fluid download-button download-button-full ${compileLoading ? 'loading' : ''}`} icon="download" text={lf("Download") } title={compileTooltip} onClick={() => this.compile('tablet') } />
                                    </div>
                                </div> : undefined }
                                {readOnly ? undefined :
                                    <div className="row" style={compileBtn ? { paddingTop: 0 } : {}}>
                                        <div className="column">
                                            <div className="ui item large right labeled fluid input projectname-input projectname-tablet" title={lf("Pick a name for your project") }>
                                                <input id="fileNameInput"
                                                    type="text"
                                                    placeholder={lf("Pick a name...") }
                                                    value={state.projectName || ''}
                                                    onChange={(e) => this.saveProjectName((e.target as any).value, 'tablet') }>
                                                </input>
                                                <sui.Button icon='save' class="large right attached editortools-btn save-editortools-btn" title={lf("Save") } onClick={() => this.saveFile('tablet') } />
                                            </div>
                                        </div>
                                    </div>}
                            </div>
                        </div>
                        <div className="six wide column right aligned">
                            {readOnly ? undefined :
                                <div className="ui icon large buttons">
                                    <sui.Button icon='undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo") } onClick={() => this.undo() } />
                                    <sui.Button icon='repeat' class={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo") } onClick={() => this.redo() } />
                                </div>}
                            <div className="ui icon large buttons">
                                <sui.Button icon='zoom' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn() } />
                                <sui.Button icon='zoom out' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut() } />
                            </div>
                        </div>
                    </div> }
            </div>
            <div className="column computer only">
                <div className="ui grid equal width">
                    <div id="downloadArea" className="ui column items">{headless && collapsed ?
                            <div className="ui item">
                                <div className="ui icon large buttons">
                                    <sui.Button icon={`${state.collapseEditorTools ? 'toggle right' : 'toggle left'}`} class="large collapse-button" title={collapseTooltip} onClick={() => this.toggleCollapse('computer') } />
                                    {run ? <sui.Button role="menuitem" class="large" key='runmenubtn' icon={state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator('tablet') } /> : undefined }
                                    {restart ? <sui.Button key='restartbtn' class={`large restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator('tablet') } /> : undefined }
                                    {compileBtn ? <sui.Button icon='icon download' class={`primary large download-button ${compileLoading ? 'loading' : ''}`} title={compileTooltip} onClick={() => this.compile('computer') } /> : undefined }
                                </div>
                            </div> :
                            <div className="ui item">
                                <sui.Button icon={`${state.collapseEditorTools ? 'toggle right' : 'toggle left'}`} class="large collapse-button" title={collapseTooltip} onClick={() => this.toggleCollapse('computer') } />
                                {compileBtn ? <sui.Button icon='icon download' class={`primary huge fluid download-button ${compileLoading ? 'loading' : ''}`} text={lf("Download") } title={compileTooltip} onClick={() => this.compile('computer') } /> : undefined }
                            </div>
                        }
                    </div>
                    {readOnly ? undefined :
                        <div className="column left aligned">
                            <div className={`ui large right labeled input projectname-input projectname-computer`} title={lf("Pick a name for your project") }>
                                <input id="fileNameInput"
                                    type="text"
                                    placeholder={lf("Pick a name...") }
                                    value={state.projectName || ''}
                                    onChange={(e) => this.saveProjectName((e.target as any).value, 'computer') }>
                                </input>
                                <sui.Button icon='save' class="small right attached editortools-btn save-editortools-btn" title={lf("Save") } onClick={() => this.saveFile('computer') } />
                            </div>
                        </div>}
                    <div className="column right aligned">
                        {readOnly ? undefined :
                            <div className="ui icon small buttons">
                                <sui.Button icon='undo' class={`editortools-btn undo-editortools-btn} ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo") } onClick={() => this.undo('computer') } />
                                <sui.Button icon='repeat' class={`editortools-btn redo-editortools-btn} ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo") } onClick={() => this.redo('computer') } />
                            </div>}
                        <div className="ui icon small buttons">
                            <sui.Button icon='zoom' class="editortools-btn zoomin-editortools-btn" title={lf("Zoom In") } onClick={() => this.zoomIn('computer') } />
                            <sui.Button icon='zoom out' class="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out") } onClick={() => this.zoomOut('computer') } />
                        </div>
                    </div>
                </div>
            </div>
        </div>;
    }
}