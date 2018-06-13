/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as compiler from "./compiler";

import * as codecard from "./codecard"
import * as gallery from "./gallery";
import * as carousel from "./carousel";
import { showAboutDialogAsync } from "./dialogs";

type ISettingsProps = pxt.editor.ISettingsProps;

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    selectedCategory?: string;
    selectedIndex?: number;
}

export class Projects extends data.Component<ISettingsProps, ProjectsState> {

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false
        }
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor
            || this.state.selectedCategory != nextState.selectedCategory
            || this.state.selectedIndex != nextState.selectedIndex;
    }

    setSelected(category: string, index: number) {
        if (index == undefined || this.state.selectedCategory == category && this.state.selectedIndex == index) {
            this.setState({ selectedCategory: undefined, selectedIndex: undefined });
        } else {
            this.setState({ selectedCategory: category, selectedIndex: index });
        }
    }

    componentDidUpdate(prevProps: ISettingsProps, prevState: ProjectsState) {
        if (this.state.selectedCategory !== prevState.selectedCategory) {
            this.ensureSelectedItemVisible();
        }
    }

    ensureSelectedItemVisible() {
        let activeCarousel = this.refs['activeCarousel'];
        if (activeCarousel) {
            let domNode = (activeCarousel as ProjectsCarousel).getCarouselDOM();
            this.scrollElementIntoViewIfNeeded(domNode);
        }
    }

    scrollElementIntoViewIfNeeded(domNode: Element) {
        let containerDomNode = ReactDOM.findDOMNode(this.refs['homeContainer']);
        // Determine if `domNode` fully fits inside `containerDomNode`.
        // If not, set the container's scrollTop appropriately.
        const domTop = (domNode as HTMLElement).getBoundingClientRect().top;
        const delta = domTop;
        const offset = 30;
        containerDomNode.parentElement.scrollTop = containerDomNode.parentElement.scrollTop + delta - offset;
    }

    renderCore() {
        const { selectedCategory, selectedIndex } = this.state;

        const targetTheme = pxt.appTarget.appTheme;
        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        const lang = pxt.Util.userLanguage();
        // collect localized and unlocalized galleries
        let galleries: pxt.Map<string> = {};
        if (targetConfig && targetConfig.localizedGalleries && targetConfig.localizedGalleries[lang])
            pxt.Util.jsonCopyFrom(galleries, targetConfig.localizedGalleries[lang]);
        if (targetConfig && targetConfig.galleries)
            pxt.Util.jsonCopyFrom(galleries, targetConfig.galleries);

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent("projects.header");
            core.showLoading("changeheader", lf("loading..."));
            this.props.parent.loadHeaderAsync(hdr)
                .done(() => {
                    core.hideLoading("changeheader");
                })
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            switch (scr.cardType) {
                case "template":
                    const prj = pxt.Util.clone(pxt.appTarget.blocksprj);
                    prj.config.dependencies = {}; // clear all dependencies
                    chgCode(scr, true, prj); break;
                case "example": chgCode(scr, true); break;
                case "codeExample": chgCode(scr, false); break;
                case "side":
                    this.props.parent.newEmptyProject(scr.name, scr.url);
                    break;
                case "tutorial": this.props.parent.startTutorial(scr.url, scr.name); break;
                default:
                    const m = /^\/#tutorial:([a-z0A-Z0-9\-\/]+)$/.exec(scr.url); // Tutorial
                    if (m) this.props.parent.startTutorial(m[1]);
                    else {
                        if (scr.youTubeId && !scr.url) // Youtube video
                            window.open('https://youtu.be/' + scr.youTubeId, 'yt');
                        else if (/^https:\/\//i.test(scr.url)) // External video
                            window.open(scr.url, '_blank');
                        else if (scr.url) // Docs url, open in new tab
                            if (/^\//i.test(scr.url))
                                window.open(scr.url, '_blank');
                            else
                                core.errorNotification(lf("Sorry, the project url looks invalid."));
                        else
                            this.props.parent.newEmptyProject(scr.name.toLowerCase());
                    }
            }
        }

        const chgCode = (scr: pxt.CodeCard, loadBlocks: boolean, prj?: pxt.ProjectTemplate) => {
            core.showLoading("changingcode", lf("loading..."));
            const name = scr.name.toLowerCase().replace(/\W/, '');
            gallery.loadExampleAsync(name, scr.url)
                .done(opts => {
                    if (opts) {
                        if (prj) opts.prj = prj;
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
                                        })
                                })
                                .done(() => {
                                    core.hideLoading("changingcode");
                                })
                        } else {
                            opts.tsOnly = true
                            return this.props.parent.createProjectAsync(opts)
                                .then(() => Promise.delay(500))
                                .done(() => core.hideLoading("changingcode"));
                        }
                    }
                    core.hideLoading("changingcode");
                });
        }
        const importProject = () => {
            pxt.tickEvent("projects.importdialog", undefined, { interactiveConsent: true });
            this.props.parent.importProjectDialog();
        }

        const showLanguagePicker = () => {
            pxt.tickEvent("projects.langpicker");
            this.props.parent.showLanguagePicker();
        }

        const showHeroBanner = !!targetTheme.homeScreenHero;

        const tabClasses = sui.cx([
            'ui segment bottom attached tab active tabsegment'
        ]);

        return <div ref="homeContainer" className={tabClasses}>
            {showHeroBanner ?
                <div className="ui segment getting-started-segment" style={{ backgroundImage: `url(${encodeURI(targetTheme.homeScreenHero)})` }} /> : undefined}
            <div key={`mystuff_gallerysegment`} className="ui segment gallerysegment mystuff-segment">
                <div className="ui grid equal width padded heading">
                    <div className="column">
                        <h2 className="ui header">{lf("My Projects")} </h2>
                    </div>
                    <div className="column right aligned">
                        {pxt.appTarget.compile || (pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing) ?
                            <sui.Button key="import" icon="upload" className="mini import-dialog-btn" textClass="landscape only" text={lf("Import")} title={lf("Import a project")} onClick={() => importProject()} /> : undefined}
                    </div>
                </div>
                <div className="content">
                    <ProjectsCarousel key={`mystuff_carousel`} parent={this.props.parent} name={'recent'} onClick={(scr: any) => chgHeader(scr)} />
                </div>
            </div>
            {Object.keys(galleries).map(galleryName =>
                <div key={`${galleryName}_gallerysegment`} className="ui segment gallerysegment">
                    <h2 className="ui header heading">{pxt.Util.rlf(galleryName)} </h2>
                    <div className="content">
                        <ProjectsCarousel ref={`${selectedCategory == galleryName ? 'activeCarousel' : ''}`} key={`${galleryName}_carousel`} parent={this.props.parent} name={galleryName} path={galleries[galleryName]} onClick={(scr: any) => chgGallery(scr)} setSelected={(index: number) => this.setSelected(galleryName, index)} selectedIndex={selectedCategory == galleryName ? selectedIndex : undefined} />
                    </div>
                </div>
            )}
            {targetTheme.organizationUrl || targetTheme.organizationUrl || targetTheme.privacyUrl ? <div className="ui horizontal small divided link list homefooter">
                {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                {targetTheme.selectLanguage ? <sui.Link className="item" text={lf("Language")} onClick={() => showLanguagePicker()} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener">{lf("Terms of Use")}</a> : undefined}
                {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener">{lf("Privacy")}</a> : undefined}
                {pxt.appTarget.versions ? <sui.Link className="item" text={`v${pxt.appTarget.versions.target}`} onClick={() => showAboutDialogAsync()} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {targetTheme.copyrightText ? <div className="ui item copyright">{targetTheme.copyrightText}</div> : undefined}
            </div> : undefined}
        </div>;
    }
}

export class ProjectsMenu extends data.Component<ISettingsProps, {}> {

    brandIconClick() {
        pxt.tickEvent("projects.brand", undefined, { interactiveConsent: true });
    }

    orgIconClick() {
        pxt.tickEvent("projects.org", undefined, { interactiveConsent: true });
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return false;
    }

    renderCore() {
        const targetTheme = pxt.appTarget.appTheme;

        return <div id="homemenu" className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
            <div className="left menu">
                <a href={targetTheme.logoUrl} aria-label={lf("{0} Logo", targetTheme.boardName)} role="menuitem" target="blank" rel="noopener" className="ui item logo brand" onClick={() => this.brandIconClick()}>
                    {targetTheme.logo || targetTheme.portraitLogo
                        ? <img className={`ui logo ${targetTheme.logo ? " portrait hide" : ''}`} src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />
                        : <span className="name">{targetTheme.boardName}</span>}
                    {targetTheme.portraitLogo ? (<img className='ui mini image portrait only' src={targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />) : null}
                </a>
            </div>
            <div className="ui item"><sui.Icon icon={`icon home large`} /> <span>{lf("Home")}</span></div>
            <div className="right menu">
                <a href={targetTheme.organizationUrl} target="blank" rel="noopener" className="ui item logo organization" onClick={() => this.orgIconClick()}>
                    {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                        ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={targetTheme.organizationWideLogo || targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />
                        : <span className="name">{targetTheme.organization}</span>}
                    {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />) : null}
                </a>
            </div>
            {targetTheme.betaUrl ? <a href={`${targetTheme.betaUrl}`} className="ui red mini corner top left attached label betalabel" role="menuitem">{lf("Beta")}</a> : undefined}
        </div>;
    }
}

interface ProjectsCarouselProps extends ISettingsProps {
    name: string;
    path?: string;
    cardWidth?: number;
    onClick: (src: any) => void;
    selectedIndex?: number;
    setSelected?: (index: number) => void;
}

interface ProjectsCarouselState {
}

export class ProjectsCarousel extends data.Component<ProjectsCarouselProps, ProjectsCarouselState> {
    private prevGalleries: pxt.CodeCard[] = [];
    private hasFetchErrors = false;
    private latestProject: codecard.CodeCardView

    constructor(props: ProjectsCarouselProps) {
        super(props)
        this.state = {
        }

        this.closeDetailOnEscape = this.closeDetailOnEscape.bind(this);
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
                this.prevGalleries = pxt.Util.concat(res.map(g => g.cards));
            }
        }
        return this.prevGalleries || [];
    }

    fetchLocalData(): pxt.workspace.Header[] {
        let headers: pxt.workspace.Header[] = this.getData("header:*")
        return headers;
    }

    newProject() {
        pxt.tickEvent("projects.new", undefined, { interactiveConsent: true });
        this.props.parent.newProject();
    }

    closeDetail() {
        pxt.tickEvent("projects.detail.close");
        this.props.setSelected(undefined);
    }

    getCarouselDOM() {
        let carouselDom = ReactDOM.findDOMNode(this.refs["carousel"]);
        return carouselDom;
    }

    getDetailDOM() {
        let detailDom = ReactDOM.findDOMNode(this.refs["detailView"]);
        return detailDom;
    }

    closeDetailOnEscape(e: KeyboardEvent) {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode != core.ESC_KEY) return;
        this.closeDetail();

        document.removeEventListener('keydown', this.closeDetailOnEscape);
        e.preventDefault();
    }

    componentWillReceiveProps(nextProps?: ProjectsCarouselProps) {
        if (nextProps.selectedIndex != undefined) {
            document.addEventListener('keydown', this.closeDetailOnEscape);
        }
    }

    renderCore() {
        const { path, selectedIndex } = this.props;

        const onClick = (scr: any, index?: number) => {
            if (this.props.setSelected) {
                // Set this item as selected
                pxt.tickEvent("projects.detail.open");
                this.props.setSelected(index);
            } else {
                this.props.onClick(scr);
            }
        }

        if (path) {
            // Fetch the gallery
            this.hasFetchErrors = false;

            const cards = this.fetchGallery(path);
            if (this.hasFetchErrors) {
                return <div className="ui carouselouter">
                    <div className="carouselcontainer" tabIndex={0} onClick={() => this.setState({})}>
                        <p className="ui grey inverted segment">{lf("Oops, please connect to the Internet and try again.")}</p>
                    </div>
                </div>
            } else {
                return <div>
                    <carousel.Carousel ref="carousel" bleedPercent={20} selectedIndex={selectedIndex}>
                        {cards.map((scr, index) =>
                            <codecard.CodeCardView
                                className="example"
                                key={path + scr.name}
                                name={scr.name}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                label={scr.label}
                                labelClass={scr.labelClass}
                                onClick={() => onClick(scr, index)}
                            />
                        )}
                    </carousel.Carousel>
                    <div ref="detailView" className={`detailview ${cards.filter((scr, index) => index == selectedIndex).length > 0 ? 'visible' : ''}`}>
                        {cards.filter((scr, index) => index == selectedIndex).length > 0 ?
                            <div className="close">
                                <sui.Icon tabIndex={0} icon="remove circle" onClick={() => this.closeDetail()} />
                            </div> : undefined}
                        {cards.filter((scr, index) => index == selectedIndex).map(scr =>
                            <ProjectsDetail parent={this.props.parent}
                                name={scr.name}
                                key={'detail' + scr.name}
                                description={scr.description}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                largeImageUrl={scr.largeImageUrl}
                                youTubeId={scr.youTubeId}
                                onClick={() => this.props.onClick(scr)}
                                cardType={scr.cardType}
                            />
                        )}
                    </div>
                </div>
            }
        } else {
            const headers = this.fetchLocalData();
            const showNewProject = pxt.appTarget.appTheme && !pxt.appTarget.appTheme.hideNewProjectButton;
            return <carousel.Carousel bleedPercent={20}>
                {showNewProject ? <div className="ui card link newprojectcard" title={lf("Creates a new empty project")} onClick={() => this.newProject()} onKeyDown={sui.fireClickOnEnter} >
                    <div className="content">
                        <sui.Icon icon="huge add circle" />
                        <span className="header">{lf("New Project")}</span>
                    </div>
                </div> : undefined}
                {headers.map((scr, index) =>
                    <codecard.CodeCardView
                        key={'local' + scr.id + scr.recentUse}
                        ref={(view) => { if (index === 1) this.latestProject = view }}
                        cardType="file"
                        className="file"
                        name={scr.name}
                        time={scr.recentUse}
                        url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                        onClick={() => onClick(scr)}
                    />
                )}
            </carousel.Carousel>
        }
    }
}

export interface ProjectsDetailProps extends ISettingsProps {
    name: string;
    description?: string;
    imageUrl?: string;
    largeImageUrl?: string;
    youTubeId?: string;
    url?: string;
    onClick: () => void;
    cardType: string;
}

export interface ProjectsDetailState {

}

export class ProjectsDetail extends data.Component<ProjectsDetailProps, ProjectsDetailState> {

    renderCore() {
        const { name, description, imageUrl, largeImageUrl, youTubeId, onClick, cardType } = this.props;

        const image = largeImageUrl || imageUrl || (youTubeId ? `https://img.youtube.com/vi/${youTubeId}/0.jpg` : undefined);

        let clickLabel = lf("Show Instructions");
        if (cardType == "tutorial") clickLabel = lf("Start Tutorial");
        else if (cardType == "codeExample" || cardType == "example") clickLabel = lf("Open Example");
        else if (cardType == "template") clickLabel = lf("New Project");
        else if (youTubeId) clickLabel = lf("Play Video");

        const actions = [{
            label: clickLabel,
            onClick: onClick,
            icon: '',
            className: 'huge positive'
        }]

        return <div className="ui grid stackable padded">
            {image ? <div className="imagewrapper"><div className="image" style={{ backgroundImage: `url("${image}")` }} /></div> : undefined}
            <div className="column eight wide">
                <div className="segment">
                    <div className="header"> {name} </div>
                    <p className="detail">
                        {description}
                    </p>
                    <div className="actions">
                        {actions.map(action =>
                            <sui.Button
                                key={`action_${action.label}`}
                                icon={action.icon}
                                text={action.label}
                                className={`approve ${action.icon ? 'icon right labeled' : ''} ${action.className || ''}`}
                                onClick={() => {
                                    action.onClick();
                                }}
                                onKeyDown={sui.fireClickOnEnter} />
                        )}
                    </div>
                </div>
            </div>
        </div>;
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
            pxt.tickEvent("projects.import", undefined, { interactiveConsent: true });
            this.hide();
            this.props.parent.showImportFileDialog();
        }
        const importUrl = () => {
            pxt.tickEvent("projects.importurl", undefined, { interactiveConsent: true });
            this.hide();
            this.props.parent.showImportUrlDialog();
        }

        return (
            <sui.Modal isOpen={visible} className="importdialog" size="small"
                onClose={() => this.close()} dimmer={true}
                closeIcon={true} header={lf("Import")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                <div className="ui two cards">
                    {pxt.appTarget.compile ?
                        <codecard.CodeCardView
                            ariaLabel={lf("Open files from your computer")}
                            role="button"
                            key={'import'}
                            icon="upload"
                            iconColor="secondary"
                            name={lf("Import File...")}
                            description={lf("Open files from your computer")}
                            onClick={() => importHex()}
                        /> : undefined}
                    {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing ?
                        <codecard.CodeCardView
                            ariaLabel={lf("Open a shared project URL")}
                            role="button"
                            key={'importurl'}
                            icon="cloud download"
                            iconColor="secondary"
                            name={lf("Import URL...")}
                            description={lf("Open a shared project URL")}
                            onClick={() => importUrl()}
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

    modalDidOpen(ref: HTMLElement) {
        // Save on enter typed
        let dialogInput = document.getElementById('projectNameInput') as HTMLInputElement;
        if (dialogInput) {
            dialogInput.setSelectionRange(0, 9999);
            dialogInput.onkeydown = (e: KeyboardEvent) => {
                const charCode = core.keyCodeFromEvent(e);
                if (charCode === core.ENTER_KEY) {
                    e.preventDefault();
                    const approveButton = ref.getElementsByClassName("approve positive").item(0) as HTMLElement;
                    if (approveButton) approveButton.click();
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
            if (this.props.parent.state.projectName != newName) pxt.tickEvent("exitandsave.projectrename", undefined, { interactiveConsent: true });
            this.props.parent.updateHeaderNameAsync(newName)
                .done(() => {
                    this.props.parent.openHome();
                })
        }
        const cancel = () => {
            pxt.tickEvent("exitandsave.cancel", undefined, { interactiveConsent: true });
            this.hide();
        }
        const onChange = (name: string) => {
            newName = name;
        };

        const actions: sui.ModalButton[] = [{
            label: lf("Done"),
            onclick: save,
            icon: 'check',
            className: 'approve positive'
        }, {
            label: lf("Cancel"),
            icon: 'cancel',
            onclick: cancel
        }]

        return (
            <sui.Modal isOpen={visible} className="exitandsave" size="tiny"
                onClose={() => this.hide()} dimmer={true} buttons={actions}
                closeIcon={true} header={lf("Exit Project")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
                modalDidOpen={this.modalDidOpen}
            >
                <div className="ui form">
                    <sui.Input autoFocus id={"projectNameInput"} label={lf("Project Name")} ariaLabel={lf("Type a name for your project")} value={projectName} onChange={onChange} />
                </div>
            </sui.Modal>
        )
    }
}