/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler";

import * as codecard from "./codecard"
import * as gallery from "./gallery";
import * as carousel from "./carousel";

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
}

export class Projects extends data.Component<ISettingsProps, ProjectsState> {
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.Map<pxt.CodeCard[]> = {};
    private galleryFetchErrors: { [tab: string]: boolean } = {};

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false
        }
    }

    fetchGallery(tab: string, path: string): pxt.CodeCard[] {
        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as gallery.Gallery[];
        if (res) {
            if (res instanceof Error) {
                this.galleryFetchErrors[tab] = true;
            } else {
                this.prevGalleries[path] = Util.concat(res.map(g => g.cards));
            }
        }
        return this.prevGalleries[path] || [];
    }

    fetchUrlData(): Cloud.JsonScript[] {
        let scriptid = pxt.Cloud.parseScriptId(this.state.searchFor)
        if (scriptid) {
            let res = this.getData(`cloud-search:${scriptid}`)
            if (res) {
                if (res.statusCode !== 404) {
                    if (!this.prevUrlData) this.prevUrlData = [res]
                    else this.prevUrlData.push(res)
                }
            }
        }
        return this.prevUrlData;
    }

    fetchLocalData(): pxt.workspace.Header[] {
        let headers: pxt.workspace.Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor
    }

    renderCore() {
        const { visible } = this.state;

        const targetTheme = pxt.appTarget.appTheme;
        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        const galleries = (targetConfig ? targetConfig.galleries : undefined) || {};

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();
        this.galleryFetchErrors = {};
        const gals = Util.mapMap(galleries, k => this.fetchGallery(k, galleries[k]));

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent("projects.header");
            core.showLoading("changeheader", lf("Loading..."));
            this.props.parent.loadHeaderAsync(hdr)
                .done(() => {
                    core.hideLoading("changeheader");
                })
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            switch (scr.cardType) {
                case "example": chgCode(scr, true); break;
                case "codeExample": chgCode(scr, false); break;
                case "tutorial": this.props.parent.startTutorial(scr.url, scr.name); break;
                default:
                    const m = /^\/#tutorial:([a-z0A-Z0-9\-\/]+)$/.exec(scr.url);
                    if (m) this.props.parent.startTutorial(m[1]);
                    else {
                        if (scr.youTubeId && !scr.url)
                            window.open('https://youtu.be/' + scr.youTubeId, 'yt');
                        else if (/^https:\/\//i.test(scr.url))
                            window.open(scr.url, '_blank');
                        else
                            this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
                    }
            }
        }

        const chgCode = (scr: pxt.CodeCard, loadBlocks?: boolean) => {
            core.showLoading("changingcode", lf("Loading..."));
            gallery.loadExampleAsync(scr.name.toLowerCase(), scr.url)
                .done(opts => {
                    if (opts) {
                        if (loadBlocks) {
                            return this.props.parent.createProjectAsync(opts)
                                .then(() => {
                                    return compiler.getBlocksAsync()
                                        .then(blocksInfo => compiler.decompileAsync("main.ts", blocksInfo))
                                        .then(resp => {
                                            pxt.debug(`example decompilation: ${resp.success}`)
                                            if (resp.success) {
                                                this.props.parent.overrideBlocksFile(resp.outfiles["main.blocks"])
                                            }
                                            this.props.parent.setSideDoc(scr.url, loadBlocks);
                                        })
                                })
                                .done(() => {
                                    core.hideLoading("changingcode");
                                })
                        } else {
                            return this.props.parent.createProjectAsync(opts)
                                .then(() => Promise.delay(500))
                                .done(() => core.hideLoading("changingcode"));
                        }
                    }
                    core.hideLoading("changingcode");
                });
        }
        const importProject = () => {
            pxt.tickEvent("projects.importdialog");
            this.props.parent.importProjectDialog();
        }

        const showHeroBanner = !!targetTheme.homeScreenHero;
        const betaUrl = targetTheme.betaUrl;

        const tabClasses = sui.cx([
            'ui segment bottom attached tab active tabsegment'
        ]);

        return (
            <div className="ui home projectsdialog">
                <div id="menubar" role="banner">
                    <div className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
                        <div className="left menu">
                            <a href={targetTheme.logoUrl} aria-label={lf("{0} Logo", targetTheme.boardName) } role="menuitem" target="blank" rel="noopener" className="ui item logo brand" onClick={() => pxt.tickEvent("projects.brand") }>
                                {targetTheme.logo || targetTheme.portraitLogo
                                    ? <img className={`ui logo ${targetTheme.logo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo) } alt={lf("{0} Logo", targetTheme.boardName) } />
                                    : <span className="name">{targetTheme.boardName}</span>}
                                {targetTheme.portraitLogo ? (<img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.portraitLogo) } alt={lf("{0} Logo", targetTheme.boardName) } />) : null}
                            </a>
                        </div>
                        <div className="ui item"><sui.Icon icon={`icon home large`} /> {lf("Home") }</div>
                        <div className="right menu">
                            <a href={targetTheme.organizationUrl} target="blank" rel="noopener" className="ui item logo organization" onClick={() => pxt.tickEvent("projects.org") }>
                                {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                                    ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.organizationWideLogo || targetTheme.organizationLogo) } alt={lf("{0} Logo", targetTheme.organization) } />
                                    : <span className="name">{targetTheme.organization}</span>}
                                {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.organizationLogo) } alt={lf("{0} Logo", targetTheme.organization) } />) : null}
                            </a>
                        </div>
                        {betaUrl ? <a href={`${betaUrl}`} className="ui red mini corner top left attached label betalabel" role="menuitem">{lf("Beta") }</a> : undefined}
                    </div>
                </div>
                <div className={tabClasses}>
                    {showHeroBanner ?
                        <div className="ui segment getting-started-segment" style={{ backgroundImage: `url(${encodeURI(targetTheme.homeScreenHero)})` }} /> : undefined}
                    <div key={`mystuff_gallerysegment`} className="ui segment gallerysegment mystuff-segment">
                        <div className="ui grid equal width padded">
                            <div className="column">
                                <h2 className="ui header">{lf("My Projects") } </h2>
                            </div>
                            <div className="column right aligned">
                                {pxt.appTarget.compile || (pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing) ?
                                    <sui.Button key="import" icon="upload" class="mini import-dialog-btn" textClass="landscape only" text={lf("Import") } title={lf("Import a project") } onClick={() => importProject() } /> : undefined}
                            </div>
                        </div>
                        <div className="content">
                            <ProjectsCarousel key={`mystuff_carousel`} parent={this.props.parent} name={'recent'} onClick={(scr: any) => chgHeader(scr) } />
                        </div>
                    </div>
                    {Object.keys(galleries).map(galleryName =>
                        <div key={`${galleryName}_gallerysegment`} className="ui segment gallerysegment">
                            <h2 className="ui header">{Util.rlf(galleryName) } </h2>
                            <div className="content">
                                <ProjectsCarousel key={`${galleryName}_carousel`} parent={this.props.parent} name={galleryName} path={galleries[galleryName]} onClick={(scr: any) => chgGallery(scr) } />
                            </div>
                        </div>
                    ) }
                    {targetTheme.organizationUrl || targetTheme.organizationUrl || targetTheme.privacyUrl ? <div className="ui horizontal small divided link list homefooter">
                        {targetTheme.organizationUrl && targetTheme.organization ? <a className="item focused" target="_blank" rel="noopener" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                        {targetTheme.termsOfUseUrl ? <a target="_blank" className="item focused" href={targetTheme.termsOfUseUrl} rel="noopener">{lf("Terms of Use") }</a> : undefined}
                        {targetTheme.privacyUrl ? <a target="_blank" className="item focused" href={targetTheme.privacyUrl} rel="noopener">{lf("Privacy") }</a> : undefined}
                    </div> : undefined}
                </div>
            </div>
        );
    }
}

interface ProjectsCarouselProps extends ISettingsProps {
    name: string;
    path?: string;
    cardWidth?: number;
    onClick: Function;
}

interface ProjectsCarouselState {
}

export class ProjectsCarousel extends data.Component<ProjectsCarouselProps, ProjectsCarouselState> {
    private prevGalleries: pxt.CodeCard[] = [];
    private prevHeaders: pxt.workspace.Header[] = [];
    private hasFetchErrors = false;
    private node: any;
    private carousel: any;
    private latestProject: codecard.CodeCardView

    constructor(props: ProjectsCarouselProps) {
        super(props)
        this.state = {
        }
    }

    componentDidMount() {
        if (this.props.parent.state.header) {
            if (this.latestProject && this.latestProject.element) {
                this.latestProject.element.focus()
            }
        }
    }

    fetchGallery(path: string): pxt.CodeCard[] {
        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as gallery.Gallery[];
        if (res) {
            if (res instanceof Error) {
                this.hasFetchErrors = true;
            } else {
                this.prevGalleries = Util.concat(res.map(g => g.cards));
            }
        }
        return this.prevGalleries || [];
    }

    fetchLocalData(): pxt.workspace.Header[] {
        let headers: pxt.workspace.Header[] = this.getData("header:*")
        this.prevHeaders = headers || [];
        return headers;
    }

    newProject() {
        pxt.tickEvent("projects.new");
        this.props.parent.newProject();
    }

    renderCore() {
        const { name, path } = this.props;
        const theme = pxt.appTarget.appTheme;

        const onClick = (scr: any) => {
            this.props.onClick(scr);
        }

        if (path) {
            // Fetch the gallery
            this.hasFetchErrors = false;

            const cards = this.fetchGallery(path);
            if (this.hasFetchErrors) {
                return <div className="ui carouselouter">
                    <div className="carouselcontainer" tabIndex={0} onClick={() => this.setState({}) }>
                        <p className="ui grey inverted segment">{lf("Oops, please connect to the Internet and try again.") }</p>
                    </div>
                </div>
            } else {
                return <carousel.Carousel bleedPercent={20}>
                    {cards.map((scr, index) =>
                        <div key={path + scr.name}>
                            <codecard.CodeCardView
                                className="example"
                                key={'gallery' + scr.name}
                                name={scr.name}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                label={scr.label}
                                labelClass={scr.labelClass}
                                onClick={() => onClick(scr) }
                                />
                        </div>
                    ) }
                </carousel.Carousel>
            }
        } else {
            let headers = this.fetchLocalData();
            headers.unshift({
                id: 'new',
                name: lf("New Project")
            } as any);
            if (headers.length == 0) {
                return <div className="ui carouselouter">
                    <div className="carouselcontainer">
                        <p>{lf("This is where you will you find your code.") }</p>
                    </div>
                </div>
            } else {
                return <carousel.Carousel bleedPercent={20}>
                    {headers.map((scr, index) =>
                        <div key={'local' + scr.id + scr.recentUse}>
                            {scr.id == 'new' ?
                                <div className="ui card link newprojectcard focused" tabIndex={0} title={lf("Creates a new empty project") } onClick={() => this.newProject() } onKeyDown={sui.fireClickOnEnter} >
                                    <div className="content">
                                        <sui.Icon icon="huge add circle" />
                                        <span className="header">{scr.name}</span>
                                    </div>
                                </div>
                                :
                                <codecard.CodeCardView
                                    ref={(view) => { if (index === 1) this.latestProject = view } }
                                    cardType="file"
                                    className="file"
                                    name={scr.name}
                                    time={scr.recentUse}
                                    url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                    onClick={() => onClick(scr) }
                                    />}
                        </div>
                    ) }
                </carousel.Carousel>
            }
        }
    }
}

export interface ImportDialogState {
    visible?: boolean;
}

export class ImportDialog extends data.Component<ISettingsProps, ImportDialogState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    close() {
        this.setState({ visible: false });
    }

    show() {
        this.setState({ visible: true });
    }

    renderCore() {
        const { visible } = this.state;

        const importHex = () => {
            pxt.tickEvent("projects.import");
            this.hide();
            this.props.parent.importFileDialog();
        }
        const importUrl = () => {
            pxt.tickEvent("projects.importurl");
            this.hide();
            this.props.parent.importUrlDialog();
        }

        return (
            <sui.Modal open={this.state.visible} className="importdialog" header={lf("Import") } size="small"
                onClose={() => this.close() } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick closeOnDocumentClick
                >
                <div className="ui cards">
                    {pxt.appTarget.compile ?
                        <codecard.CodeCardView
                            ariaLabel={lf("Open files from your computer") }
                            className="focused"
                            role="button"
                            key={'import'}
                            icon="upload"
                            iconColor="secondary"
                            name={lf("Import File...") }
                            description={lf("Open files from your computer") }
                            onClick={() => importHex() }
                            /> : undefined}
                    {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                        <codecard.CodeCardView
                            ariaLabel={lf("Open a shared project URL") }
                            className="focused"
                            role="button"
                            key={'importurl'}
                            icon="cloud download"
                            iconColor="secondary"
                            name={lf("Import URL...") }
                            description={lf("Open a shared project URL") }
                            onClick={() => importUrl() }
                            /> : undefined}
                </div>
            </sui.Modal>
        )
    }
}


export interface ExitAndSaveDialogState {
    visible?: boolean;
}

export class ExitAndSaveDialog extends data.Component<ISettingsProps, ExitAndSaveDialogState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    show() {
        this.setState({ visible: true });
    }

    componentDidUpdate() {
        if (!this.state.visible) return;
        // Save on enter typed
        let dialogInput = document.getElementById('projectNameInput') as HTMLInputElement;
        if (dialogInput) {
            dialogInput.setSelectionRange(0, 9999);
            dialogInput.onkeyup = (e: KeyboardEvent) => {
                let charCode = (typeof e.which == "number") ? e.which : e.keyCode
                if (charCode === core.ENTER_KEY) {
                    e.preventDefault();
                    (document.getElementsByClassName("approve positive").item(0) as HTMLElement).click();
                }
            }
        }
    }

    renderCore() {
        const { visible } = this.state;
        const { projectName } = this.props.parent.state;
        let newName = projectName;

        const save = () => {
            this.hide();
            if (this.props.parent.state.projectName != newName) pxt.tickEvent("exitandsave.projectrename");
            this.props.parent.updateHeaderNameAsync(newName)
                .done(() => {
                    this.props.parent.openHome();
                })
        }
        const cancel = () => {
            pxt.tickEvent("exitandsave.cancel");
            this.hide();
        }
        const onChange = (name: string) => {
            newName = name;
        };

        const actions = [{
            label: lf("Done"),
            onClick: save,
            icon: 'check',
            className: 'positive'
        }, {
                label: lf("Cancel"),
                icon: 'cancel',
                onClick: cancel
            }]

        return (
            <sui.Modal open={visible} className="exitandsave" header={lf("Exit Project") } size="tiny"
                onClose={() => this.hide() } dimmer={true}
                actions={actions}
                closeIcon={true}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
                >
                <div className="ui form">
                    <sui.Input id={"projectNameInput"} class="focused" label={lf("Project Name") } ariaLabel={lf("Type a name for your project") } value={projectName} onChange={onChange} />
                </div>
            </sui.Modal>
        )
    }
}