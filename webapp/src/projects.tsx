/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as cloud from "./cloud";
import * as cloudsync from "./cloudsync";

import * as codecard from "./codecard"
import * as carousel from "./carousel";
import { showAboutDialogAsync } from "./dialogs";

type ISettingsProps = pxt.editor.ISettingsProps;

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ProjectsState {
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

        this.showLanguagePicker = this.showLanguagePicker.bind(this);
        this.showAboutDialog = this.showAboutDialog.bind(this);
        this.chgHeader = this.chgHeader.bind(this);
        this.chgGallery = this.chgGallery.bind(this);
        this.chgCode = this.chgCode.bind(this);
        this.importProject = this.importProject.bind(this);
        this.showScriptManager = this.showScriptManager.bind(this);
        this.cloudSignIn = this.cloudSignIn.bind(this);
        this.setSelected = this.setSelected.bind(this);
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
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

    private showLanguagePicker() {
        pxt.tickEvent("projects.langpicker");
        this.props.parent.showLanguagePicker();
    }

    private showAboutDialog() {
        showAboutDialogAsync(this.props.parent);
    }

    chgHeader(hdr: pxt.workspace.Header) {
        pxt.tickEvent("projects.header");
        core.showLoading("changeheader", lf("loading..."));
        this.props.parent.loadHeaderAsync(hdr)
            .done(() => {
                core.hideLoading("changeheader");
            })
    }

    chgGallery(scr: pxt.CodeCard, action?: pxt.CodeCardAction) {
        let editor: string = (action && action.editor) || "blocks";
        if (editor == "js") editor = "ts";
        pxt.tickEvent("projects.gallery", { name: scr.name, cardType: scr.cardType, editor });
        const url = action ? action.url : scr.url;
        const editorPref = editor + "prj";
        switch (scr.cardType) {
            case "template":
                const prj = pxt.Util.clone(pxt.appTarget.blocksprj);
                prj.config.dependencies = {}; // clear all dependencies
                this.chgCode(scr.name, url, true, pxt.BLOCKS_PROJECT_NAME, prj); break;
            case "example": this.chgCode(scr.name, url, true, editorPref); break;
            case "codeExample": this.chgCode(scr.name, url, false, editorPref); break;
            case "side":
                this.props.parent.newEmptyProject(scr.name, url);
                break;
            case "tutorial":
                this.props.parent.startActivity("tutorial", url, scr.name, editorPref);
                break;
            default:
                const m = /^\/#tutorial:([a-z0A-Z0-9\-\/]+)$/.exec(url); // Tutorial
                if (m) this.props.parent.startActivity("tutorial", m[1]);
                else {
                    if (scr.youTubeId && !url) // Youtube video
                        return; // Handled by href
                    else if (/^https:\/\//i.test(url)) // External video
                        return; // Handled by href
                    else if (url) // Docs url, open in new tab
                        if (/^\//i.test(url))
                            return; // Handled by href
                        else
                            core.errorNotification(lf("Sorry, the project url looks invalid."));
                    else
                        this.props.parent.newEmptyProject(scr.name.toLowerCase());
                }
        }
    }

    chgCode(name: string, path: string, loadBlocks: boolean, preferredEditor?: string, template?: pxt.ProjectTemplate) {
        return this.props.parent.importExampleAsync({ name, path, loadBlocks, preferredEditor, prj: template });
    }

    importProject() {
        pxt.tickEvent("projects.importdialog", undefined, { interactiveConsent: true });
        this.props.parent.importProjectDialog();
    }

    showScriptManager() {
        pxt.tickEvent("projects.showall.header", undefined, { interactiveConsent: true });
        this.props.parent.showScriptManager();
    }

    cloudSignIn() {
        pxt.tickEvent("projects.signin", undefined, { interactiveConsent: true });
        this.props.parent.cloudSignInDialog();
    }

    renderCore() {
        const { selectedCategory, selectedIndex } = this.state;

        const targetTheme = pxt.appTarget.appTheme;
        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        const lang = pxt.Util.userLanguage();
        // collect localized and unlocalized galleries
        let galleries: pxt.Map<string | pxt.GalleryProps> = {};
        if (targetConfig && targetConfig.localizedGalleries && targetConfig.localizedGalleries[lang])
            pxt.Util.jsonCopyFrom(galleries, targetConfig.localizedGalleries[lang]);
        if (targetConfig && targetConfig.galleries)
            pxt.Util.jsonCopyFrom(galleries, targetConfig.galleries);

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const showHeroBanner = !!targetTheme.homeScreenHero;

        const tabClasses = sui.cx([
            'ui segment bottom attached tab active tabsegment'
        ]);

        return <div ref="homeContainer" className={tabClasses} role="main">
            {showHeroBanner ?
                <div className="ui segment getting-started-segment" style={{ backgroundImage: `url(${encodeURI(targetTheme.homeScreenHero)})` }} /> : undefined}
            <div key={`mystuff_gallerysegment`} className="ui segment gallerysegment mystuff-segment" role="region" aria-label={lf("My Projects")}>
                <div className="ui heading">
                    <div className="column" style={{ zIndex: 1 }}>
                        {targetTheme.scriptManager ? <h2 role="button" className="ui header myproject-header"
                            onClick={this.showScriptManager} onKeyDown={sui.fireClickOnEnter}>
                            {lf("My Projects")}
                            <span className="view-all-button" tabIndex={0} title={lf("View all projects")}>
                                {lf("View All")}
                            </span>
                        </h2> : <h2 className="ui header">{lf("My Projects")}</h2>}
                    </div>
                    <div className="column right aligned" style={{ zIndex: 1 }}>
                        {pxt.appTarget.compile || (pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing) ?
                            <sui.Button key="import" icon="upload" className="import-dialog-btn" textClass="landscape only" text={lf("Import")} title={lf("Import a project")} onClick={this.importProject} /> : undefined}
                    </div>
                </div>
                <div className="content">
                    <ProjectsCarousel key={`mystuff_carousel`} parent={this.props.parent} name={'recent'} onClick={this.chgHeader} />
                </div>
            </div>
            {Object.keys(galleries)
                .filter(galleryName => {
                    // hide galleries that are part of an experiment and that experiment is
                    // not enabled
                    const galProps = galleries[galleryName] as pxt.GalleryProps | string
                    if (typeof galProps === "string")
                        return true
                    // filter categories by experiment
                    const exp = galProps.experimentName;
                    if (exp && !(pxt.appTarget.appTheme as any)[exp])
                        return false; // experiment not enabled
                    const locales = galProps.locales;
                    if (locales && locales.indexOf(pxt.Util.userLanguage()) < 0)
                        return false; // locale not supported
                    // test if blocked
                    const testUrl = galProps.testUrl || (!!galProps.youTube && "https://www.youtube.com/favicon.ico");
                    if (testUrl) {
                        const ping = this.getData(`ping:${testUrl.replace('@random@', Math.random().toString())}`);
                        if (ping !== true) // still loading or can't ping
                            return false;
                    }
                    // show the gallery
                    return true;
                })
                .map(galleryName => {
                    const galProps = galleries[galleryName] as pxt.GalleryProps | string
                    const url = typeof galProps === "string" ? galProps : galProps.url
                    const shuffle: pxt.GalleryShuffle = typeof galProps === "string" ? undefined : galProps.shuffle;
                    return <div key={`${galleryName}_gallerysegment`} className="ui segment gallerysegment" role="region" aria-label={pxt.Util.rlf(galleryName)}>
                        <h2 className="ui header heading">{pxt.Util.rlf(galleryName)} </h2>
                        <div className="content">
                            <ProjectsCarousel ref={`${selectedCategory == galleryName ? 'activeCarousel' : ''}`}
                                key={`${galleryName}_carousel`} parent={this.props.parent}
                                name={galleryName}
                                path={url}
                                onClick={this.chgGallery} setSelected={this.setSelected}
                                shuffle={shuffle}
                                selectedIndex={selectedCategory == galleryName ? selectedIndex : undefined} />
                        </div>
                    </div>
                }
                )}
            {targetTheme.organizationUrl || targetTheme.organizationUrl || targetTheme.privacyUrl || targetTheme.copyrightText ? <div className="ui horizontal small divided link list homefooter">
                {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener noreferrer" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                {targetTheme.selectLanguage ? <sui.Link className="item" icon="xicon globe" text={lf("Language")} onClick={this.showLanguagePicker} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a> : undefined}
                {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a> : undefined}
                {pxt.appTarget.versions ? <sui.Link className="item" text={`v${pxt.appTarget.versions.target}`} onClick={this.showAboutDialog} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {targetTheme.copyrightText ? <div className="ui item copyright">{targetTheme.copyrightText}</div> : undefined}
            </div> : undefined}
        </div>;
    }
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface ProjectSettingsMenuProps extends ISettingsProps {
    highContrast: boolean;
}
export interface ProjectSettingsMenuState {
    highContrast?: boolean;
}

export class ProjectSettingsMenu extends data.Component<ProjectSettingsMenuProps, ProjectSettingsMenuState> {

    constructor(props: ProjectSettingsMenuProps) {
        super(props);
        this.state = {
            highContrast: props.highContrast
        }

        this.showLanguagePicker = this.showLanguagePicker.bind(this);
        this.toggleHighContrast = this.toggleHighContrast.bind(this);
        this.showResetDialog = this.showResetDialog.bind(this);
        this.showReportAbuse = this.showReportAbuse.bind(this);
        this.showAboutDialog = this.showAboutDialog.bind(this);
        this.signOutGithub = this.signOutGithub.bind(this);
    }

    showLanguagePicker() {
        pxt.tickEvent("home.langpicker", undefined, { interactiveConsent: true });
        this.props.parent.showLanguagePicker();
    }

    toggleHighContrast() {
        pxt.tickEvent("home.togglecontrast", undefined, { interactiveConsent: true });
        this.props.parent.toggleHighContrast();
        this.setState({ highContrast: !this.state.highContrast });
    }

    toggleGreenScreen() {
        pxt.tickEvent("home.togglegreenscreen", undefined, { interactiveConsent: true });
        this.props.parent.toggleGreenScreen();
    }

    toggleAccessibleBlocks() {
        pxt.tickEvent("home.toggleaccessibleblocks", undefined, { interactiveConsent: true });
        this.props.parent.toggleAccessibleBlocks();
    }

    showResetDialog() {
        pxt.tickEvent("home.reset", undefined, { interactiveConsent: true });
        this.props.parent.showResetDialog();
    }

    showReportAbuse() {
        pxt.tickEvent("home.reportabuse", undefined, { interactiveConsent: true });
        this.props.parent.showReportAbuse();
    }


    showAboutDialog() {
        pxt.tickEvent("home.about");
        this.props.parent.showAboutDialog();
    }

    signOutGithub() {
        pxt.tickEvent("home.github.signout");
        const githubProvider = cloudsync.githubProvider();
        if (githubProvider) {
            githubProvider.logout();
            this.props.parent.forceUpdate();
            core.infoNotification(lf("Signed out from GitHub"))
        }
    }

    renderCore() {
        const { highContrast } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const githubUser = this.getData("github:user") as pxt.editor.UserInfo;
        const reportAbuse = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing;
        const showDivider = targetTheme.selectLanguage || targetTheme.highContrast || githubUser;

        // tslint:disable react-a11y-anchors
        return <sui.DropdownMenu role="menuitem" icon={'setting large'} title={lf("More...")} className="item icon more-dropdown-menuitem">
            {targetTheme.selectLanguage && <sui.Item icon='xicon globe' role="menuitem" text={lf("Language")} onClick={this.showLanguagePicker} />}
            {targetTheme.highContrast && <sui.Item role="menuitem" text={highContrast ? lf("High Contrast Off") : lf("High Contrast On")} onClick={this.toggleHighContrast} />}
            {githubUser && <div className="ui divider"></div>}
            {githubUser && <div className="ui item" title={lf("Sign out {0} from GitHub", githubUser.name)} role="menuitem" onClick={this.signOutGithub}>
                <div className="avatar" role="presentation">
                    <img className="ui circular image" src={githubUser.photo} alt={lf("User picture")} />
                </div>
                {lf("Sign out")}
            </div>}
            {showDivider && <div className="ui divider"></div>}
            {reportAbuse ? <sui.Item role="menuitem" icon="warning circle" text={lf("Report Abuse...")} onClick={this.showReportAbuse} /> : undefined}
            <sui.Item role="menuitem" icon='sign out' text={lf("Reset")} onClick={this.showResetDialog} />
            <sui.Item role="menuitem" text={lf("About...")} onClick={this.showAboutDialog} />
            {targetTheme.feedbackUrl ? <a className="ui item" href={targetTheme.feedbackUrl} role="menuitem" title={lf("Give Feedback")} target="_blank" rel="noopener noreferrer" >{lf("Give Feedback")}</a> : undefined}
        </sui.DropdownMenu>;
    }
}

export class ProjectsMenu extends data.Component<ISettingsProps, {}> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.brandIconClick = this.brandIconClick.bind(this);
        this.orgIconClick = this.orgIconClick.bind(this);
    }

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

        // only show cloud head if a configuration is available
        const showCloudHead = this.hasCloud();

        return <div id="homemenu" className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
            <div className="left menu">
                <a href={targetTheme.logoUrl} aria-label={lf("{0} Logo", targetTheme.boardName)} role="menuitem" target="blank" rel="noopener" className="ui item logo brand" onClick={this.brandIconClick}>
                    {targetTheme.logo || targetTheme.portraitLogo
                        ? <img className={`ui ${targetTheme.logoWide ? "small" : ""} logo ${targetTheme.logo ? " portrait hide" : ''}`} src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />
                        : <span className="name">{targetTheme.boardName}</span>}
                    {targetTheme.portraitLogo ? (<img className={`ui ${targetTheme.logoWide ? "small" : "mini"} image portrait only`} src={targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />) : null}
                </a>
            </div>
            <div className="ui item home mobile hide"><sui.Icon icon={`icon home large`} /> <span>{lf("Home")}</span></div>
            <div className="right menu">
                {!showCloudHead ? undefined : <cloud.UserMenu parent={this.props.parent} />}
                <ProjectSettingsMenu parent={this.props.parent} highContrast={this.props.parent.state.highContrast} />
                <a href={targetTheme.organizationUrl} target="blank" rel="noopener" className="ui item logo organization" onClick={this.orgIconClick}>
                    {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                        ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={targetTheme.organizationWideLogo || targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />
                        : <span className="name">{targetTheme.organization}</span>}
                    {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />) : null}
                </a>
            </div>
        </div>;
    }
}

interface ProjectsCarouselProps extends ISettingsProps {
    name: string;
    path?: string;
    cardWidth?: number;
    onClick: (src: any, action?: pxt.CodeCardAction) => void;
    selectedIndex?: number;
    setSelected?: (name: string, index: number) => void;
    shuffle?: pxt.GalleryShuffle;
}

interface ProjectsCarouselState {
}

export class ProjectsCarousel extends data.Component<ProjectsCarouselProps, ProjectsCarouselState> {
    private prevGalleries: pxt.CodeCard[] = [];
    private hasFetchErrors = false;
    private latestProject: codecard.CodeCardView;

    private static NUM_PROJECTS_HOMESCREEN = 8;

    constructor(props: ProjectsCarouselProps) {
        super(props)
        this.state = {
        }

        this.closeDetail = this.closeDetail.bind(this);
        this.closeDetailOnEscape = this.closeDetailOnEscape.bind(this);
        this.reload = this.reload.bind(this);
        this.newProject = this.newProject.bind(this);
        this.showScriptManager = this.showScriptManager.bind(this);
        this.handleCardClick = this.handleCardClick.bind(this);
    }

    componentDidMount() {
        if (this.props.parent.state.header) {
            if (this.latestProject && this.latestProject.element) {
                this.latestProject.element.focus()
            }
        }
    }

    fetchGallery(path: string): pxt.CodeCard[] {
        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as pxt.gallery.Gallery[];
        if (res) {
            if (res instanceof Error) {
                this.hasFetchErrors = true;
            } else {
                this.prevGalleries = pxt.Util.concat(res.map(g => g.cards));
                const shuffle = this.props.shuffle
                if (shuffle) {
                    // keep last one
                    const last = this.prevGalleries.pop();
                    // shuffle array
                    const now = new Date();
                    const seed = now.toDateString();
                    this.prevGalleries.sort((l, r) =>
                        ts.pxtc.Util.codalHash16(l.name + seed)
                        - ts.pxtc.Util.codalHash16(r.name + seed)
                    );
                    // add last back
                    if (last)
                        this.prevGalleries.push(last);
                }
            }
        }
        return this.prevGalleries || [];
    }

    fetchLocalData(): pxt.workspace.Header[] {
        const headers: pxt.workspace.Header[] = this.getData("header:*")
        return headers;
    }

    newProject() {
        pxt.tickEvent("projects.new", undefined, { interactiveConsent: true });
        if (pxt.appTarget.appTheme.nameProjectFirst || pxt.appTarget.appTheme.chooseLanguageRestrictionOnNewProject) {
            this.props.parent.askForProjectCreationOptionsAsync()
                .then(projectSettings => {
                    const { name, languageRestriction } = projectSettings
                    this.props.parent.newProject({ name, languageRestriction });
                })
        } else {
            this.props.parent.newProject({ name });
        }
    }

    showScriptManager() {
        pxt.tickEvent("projects.showscriptmanager", undefined, { interactiveConsent: true });
        this.props.parent.showScriptManager();
    }

    closeDetail() {
        const { name } = this.props;
        pxt.tickEvent("projects.detail.close");
        this.props.setSelected(name, undefined);
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

    reload() {
        this.setState({})
    }

    handleCardClick(e: any, scr: any, index?: number) {
        const { name } = this.props;
        if (this.props.setSelected) {
            // Set this item as selected
            pxt.tickEvent("projects.detail.open");
            this.props.setSelected(name, index);
        } else {
            this.props.onClick(scr);
        }
    }

    renderCore() {
        const { name, path, selectedIndex } = this.props;
        const targetTheme = pxt.appTarget.appTheme;

        if (path) {
            // Fetch the gallery
            this.hasFetchErrors = false;

            const cards = this.fetchGallery(path);
            if (this.hasFetchErrors) {
                return <div className="ui carouselouter">
                    <div role="button" className="carouselcontainer" tabIndex={0} onClick={this.reload}>
                        <p className="ui grey inverted segment">{lf("Oops, please connect to the Internet and try again.")}</p>
                    </div>
                </div>
            } else {
                const selectedElement = cards[selectedIndex];
                return <div>
                    <carousel.Carousel ref="carousel" bleedPercent={20} selectedIndex={selectedIndex}>
                        {cards.map((scr, index) =>
                            <ProjectsCodeCard
                                className="example"
                                key={path + (scr.youTubeId || scr.name || scr.url)}
                                name={scr.name}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                youTubePlaylistId={scr.youTubePlaylistId}
                                buttonLabel={scr.buttonLabel}
                                label={scr.label}
                                labelClass={scr.labelClass}
                                tags={scr.tags}
                                scr={scr} index={index}
                                onCardClick={this.handleCardClick}
                                cardType={scr.cardType}
                                tutorialStep={scr.tutorialStep}
                                tutorialLength={scr.tutorialLength}
                            />
                        )}
                    </carousel.Carousel>
                    {selectedElement && <div ref="detailView" className={`detailview`}>
                        <sui.CloseButton onClick={this.closeDetail} />
                        <ProjectsDetail parent={this.props.parent}
                            name={selectedElement.name}
                            key={'detail' + selectedElement.name}
                            description={selectedElement.description}
                            url={selectedElement.url}
                            imageUrl={selectedElement.imageUrl}
                            largeImageUrl={selectedElement.largeImageUrl}
                            videoUrl={selectedElement.videoUrl}
                            youTubeId={selectedElement.youTubeId}
                            youTubePlaylistId={selectedElement.youTubePlaylistId}
                            buttonLabel={selectedElement.buttonLabel}
                            scr={selectedElement}
                            onClick={this.props.onClick}
                            cardType={selectedElement.cardType}
                            tags={selectedElement.tags}
                            otherActions={selectedElement.otherActions}
                        />
                    </div>}
                </div>
            }
        } else {
            const headers = this.fetchLocalData()
            const showNewProject = pxt.appTarget.appTheme && !pxt.appTarget.appTheme.hideNewProjectButton;
            const showScriptManagerCard = targetTheme.scriptManager && headers.length > ProjectsCarousel.NUM_PROJECTS_HOMESCREEN;
            return <carousel.Carousel bleedPercent={20}>
                {showNewProject ? <div role="button" className="ui card link buttoncard newprojectcard" title={lf("Creates a new empty project")}
                    onClick={this.newProject} onKeyDown={sui.fireClickOnEnter} >
                    <div className="content">
                        <sui.Icon icon="huge add circle" />
                        <span className="header">{lf("New Project")}</span>
                    </div>
                </div> : undefined}
                {headers.slice(0, ProjectsCarousel.NUM_PROJECTS_HOMESCREEN).map((scr, index) => {
                    const tutorialStep =
                        scr.tutorial ? scr.tutorial.tutorialStep
                            : scr.tutorialCompleted ? scr.tutorialCompleted.steps - 1
                                : undefined;
                    const tutoriallength =
                        scr.tutorial ? scr.tutorial.tutorialStepInfo.length
                            : scr.tutorialCompleted ? scr.tutorialCompleted.steps
                                : undefined;
                    const ghid = pxt.github.parseRepoId(scr.githubId);
                    return <ProjectsCodeCard
                        key={'local' + scr.id + scr.recentUse}
                        // ref={(view) => { if (index === 1) this.latestProject = view }}
                        cardType="file"
                        name={(ghid && ghid.project) || scr.name}
                        time={scr.recentUse}
                        url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                        scr={scr} index={index}
                        onCardClick={this.handleCardClick}
                        tutorialStep={tutorialStep}
                        tutorialLength={tutoriallength}
                    />;
                })}
                {showScriptManagerCard ? <div role="button" className="ui card link buttoncard scriptmanagercard" title={lf("See all projects")}
                    onClick={this.showScriptManager} onKeyDown={sui.fireClickOnEnter} >
                    <div className="content">
                        <sui.Icon icon="huge right angle" />
                        <span className="header">{lf("See all projects")}</span>
                    </div>
                </div> : undefined}
            </carousel.Carousel>
        }
    }
}

interface ProjectsCodeCardProps extends pxt.CodeCard {
    scr: any;
    index?: number;
    onCardClick: (e: any, scr: any, index?: number) => void;
    onLabelClick?: (e: any, scr: any, index?: number) => void;
}

export class ProjectsCodeCard extends sui.StatelessUIElement<ProjectsCodeCardProps> {

    constructor(props: ProjectsCodeCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleLabelClick = this.handleLabelClick.bind(this);
    }

    handleClick(e: any) {
        this.props.onCardClick(e, this.props.scr, this.props.index);
    }

    handleLabelClick(e: any) {
        this.props.onLabelClick(e, this.props.scr, this.props.index);
    }

    renderCore() {
        let { scr, onCardClick, onLabelClick, onClick, cardType, imageUrl, className, ...rest } = this.props;

        className = className || "";
        // compute icon
        if (scr && cardType == "file") {
            if (scr.githubId)
                className = 'file github ' + className;
            else if (scr.extensionUnderTest)
                className = 'file test ' + className;
            else if (scr.board) {
                className = 'file board ' + className;
                imageUrl = pxt.bundledSvg(scr.board)
            } else if (scr.editor) {
                className = 'file ' + scr.editor;
            }
            else
                className = 'file ' + className;
        }
        return <codecard.CodeCardView className={className} imageUrl={imageUrl} cardType={cardType} {...rest} onClick={this.handleClick}
            onLabelClicked={onLabelClick ? this.handleLabelClick : undefined} />
    }
}

export interface ProjectsDetailProps extends ISettingsProps {
    name: string;
    description?: string;
    imageUrl?: string;
    largeImageUrl?: string;
    videoUrl?: string;
    youTubeId?: string;
    youTubePlaylistId?: string;
    buttonLabel?: string;
    url?: string;
    scr?: any;
    onClick: (scr: any, action?: pxt.CodeCardAction) => void;
    cardType: pxt.CodeCardType;
    tags?: string[];
    otherActions?: pxt.CodeCardAction[];
}

export interface ProjectsDetailState {
}

export class ProjectsDetail extends data.Component<ProjectsDetailProps, ProjectsDetailState> {
    private linkRef: React.RefObject<HTMLAnchorElement>;

    constructor(props: ProjectsDetailProps) {
        super(props);
        this.state = {
        }

        this.handleDetailClick = this.handleDetailClick.bind(this);
        this.handleOpenForumUrlInEditor = this.handleOpenForumUrlInEditor.bind(this);
        this.linkRef = React.createRef<HTMLAnchorElement>();
    }

    protected isLink() {
        const { cardType, url, youTubeId, youTubePlaylistId } = this.props;

        return isCodeCardWithLink(cardType) && (youTubeId || youTubePlaylistId || url);

        function isCodeCardWithLink(value: string) {
            switch (value) {
                case "file":
                case "example":
                case "codeExample":
                case "tutorial":
                case "side":
                case "template":
                case "package":
                case "hw":
                    return false;
                case "forumUrl":
                default:
                    return true;
            }
        }
    }

    protected getUrl() {
        const { url, youTubeId, youTubePlaylistId } = this.props;
        return ((youTubeId || youTubePlaylistId) && !url)
            ? pxt.youtube.watchUrl(youTubeId, youTubePlaylistId)
            : ((/^https:\/\//i.test(url)) || (/^\//i.test(url)) ? url : '');
    }

    protected getClickLabel(cardType: string) {
        const { youTubeId, youTubePlaylistId } = this.props;
        let clickLabel = lf("Show Instructions");
        if (cardType == "tutorial")
            clickLabel = lf("Start Tutorial");
        else if (cardType == "codeExample" || cardType == "example")
            clickLabel = lf("Open Example");
        else if (cardType == "forumUrl")
            clickLabel = lf("Open in Forum");
        else if (cardType == "template")
            clickLabel = lf("New Project");
        else if (youTubeId)
            clickLabel = lf("Watch Video");
        else if (youTubePlaylistId)
            clickLabel = lf("Watch Playlist");
        return clickLabel;
    }

    protected getActionEditor(type: string, action?: pxt.CodeCardAction): pxt.CodeCardEditorType {
        switch (type) {
            case "tutorial":
            case "example":
                if (action && action.editor) return action.editor;
                return "blocks";
            case "codeExample":
                if (action && action.editor) return action.editor;
                return "js";
            default:
                return null;
        }
    }

    protected getActionIcon(onClick: any, type: string, editor?: pxt.CodeCardEditorType): JSX.Element {
        const { youTubeId, youTubePlaylistId } = this.props;
        let icon = "file text";
        switch (type) {
            case "tutorial":
            case "example":
                icon = "xicon blocks"
                if (editor) icon = `xicon ${editor}`;
                break;
            case "codeExample":
                icon = `xicon ${editor || "js"}`;
                break;
            case "forumUrl":
                icon = "comments"
                break;
            case "template":
            default:
                if (youTubeId || youTubePlaylistId) icon = "youtube";
                break;
        }
        return this.isLink() && type != "example" // TODO (shakao)  migrate forumurl to otherAction json in md
            ? <sui.Link role="button" className="link button attached" icon={icon} href={this.getUrl()} target="_blank" tabIndex={-1} />
            : <sui.Item role="button" className="button attached" icon={icon} onClick={onClick} tabIndex={-1} />
    }

    protected getActionTitle(editor: pxt.CodeCardEditorType): string {
        switch (editor) {
            case "py":
                return "Python";
            case "js":
                return "JavaScript";
            case "blocks":
                return lf("Blocks");
            default:
                return null;
        }
    }

    protected getActionCard(text: string, type: string, onClick: any, autoFocus?: boolean, action?: pxt.CodeCardAction, key?: string): JSX.Element {
        const editor = this.getActionEditor(type, action);
        const title = this.getActionTitle(editor);
        return <div className={`card-action ui items ${editor || ""}`} key={key}>
            {this.getActionIcon(onClick, type, editor)}
            {title && <div className="card-action-title">{title}</div>}
            {this.isLink() && type != "example" ? // TODO (shakao)  migrate forumurl to otherAction json in md
                <sui.Link
                    href={this.getUrl()}
                    refCallback={autoFocus ? this.linkRef : undefined}
                    target={'_blank'}
                    text={text}
                    className={`button attached approve large`}
                    title={lf("Open link in new window")}
                    autoFocus={autoFocus}
                />
                : <sui.Button
                    text={text}
                    className={`approve attached large`}
                    onClick={onClick}
                    onKeyDown={sui.fireClickOnEnter}
                    autoFocus={autoFocus}
                    title={lf("Open in {0}", title)}
                />}
        </div>
    }

    handleDetailClick() {
        const { scr, onClick } = this.props;
        onClick(scr);
    }

    handleActionClick(action?: pxt.CodeCardAction) {
        const { scr, onClick } = this.props;
        return () => onClick(scr, action);
    }

    handleOpenForumUrlInEditor() {
        pxt.tickEvent('projects.actions.forum', undefined, { interactiveConsent: true });
        const { url } = this.props;
        pxt.discourse.extractSharedIdFromPostUrl(url)
            .then(projectId => {
                // if we have a projectid, load it
                if (projectId)
                    window.location.hash = "pub:" + projectId; // triggers reload
                else {
                    core.warningNotification(lf("Oops, we could not find the program in the forum."));
                }
            })
            .catch(core.handleNetworkError)
    }

    isYouTubeOnline(): boolean {
        const { youTubeId, youTubePlaylistId } = this.props;
        // check that youtube is reachable
        return (youTubeId || youTubePlaylistId) &&
            this.getData("ping:https://www.youtube.com/favicon.ico");
    }

    componentDidMount() {
        // autofocus on linked action
        if (this.linkRef && this.linkRef.current) {
            this.linkRef.current.focus();
        }
    }

    renderCore() {
        const { name, description, largeImageUrl, videoUrl,
            youTubeId, youTubePlaylistId, buttonLabel, cardType, tags, otherActions } = this.props;

        const tagColors: pxt.Map<string> = pxt.appTarget.appTheme.tagColors || {};
        const descriptions = description && description.split("\n");
        const image = largeImageUrl || (youTubeId && `https://img.youtube.com/vi/${youTubeId}/0.jpg`);
        const video = !pxt.BrowserUtils.isElectron() && videoUrl;
        const showVideoOrImage = !pxt.appTarget.appTheme.hideHomeDetailsVideo;
        const youTubeWatchUrl = pxt.youtube.watchUrl(youTubeId, youTubePlaylistId)

        let clickLabel: string;
        if (buttonLabel)
            clickLabel = ts.pxtc.Util.rlf(buttonLabel);
        else
            clickLabel = this.getClickLabel(cardType);

        return <div className="ui grid stackable padded">
            {showVideoOrImage && (video || image) && <div className="imagewrapper">
                {video ? <video className="video" src={video} autoPlay={true} controls={false} loop={true} playsInline={true} />
                    : <div className="image" style={{ backgroundImage: `url("${image}")` }} />}
            </div>}
            <div className="column six wide">
                <div className="segment">
                    <div className="header"> {name} </div>
                    {tags && <div className="ui labels">
                        {tags.map(tag => <div className={`ui ${tagColors[tag] || ''} label`}>{pxt.Util.rlf(tag)}
                        </div>)}</div>}
                    {descriptions && descriptions.map((desc, index) => {
                        return <p key={`line${index}`} className="detail">
                            {desc}
                        </p>
                    })}
                    {!!cardType && youTubeWatchUrl && this.isYouTubeOnline() &&
                        // show youtube card
                        // thumbnail url `https://img.youtube.com/vi/${youTubeId}/default.jpg`
                        <sui.Link
                            href={youTubeWatchUrl}
                            target="_blank"
                            icon="play"
                            text={lf("Play Video Lesson")}
                            className={`yt-button button attached approve large inverted`}
                            title={lf("Open YouTube video in new window")}
                        />}
                </div>
            </div>
            <div className="actions column ten wide">
                <div className="segment">
                    {this.getActionCard(clickLabel, cardType, this.handleDetailClick, true)}
                    {otherActions && otherActions.map((el, i) => {
                        let onClick = this.handleActionClick(el);
                        return this.getActionCard(clickLabel, el.cardType || cardType, onClick, false, el, `action${i}`);
                    })}
                    {cardType === "forumUrl" &&
                        // TODO (shakao) migrate forumurl to otherAction json in md
                        this.getActionCard(lf("Open in Editor"), "example", this.handleOpenForumUrlInEditor)
                    }
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

        this.close = this.close.bind(this);
        this.importHex = this.importHex.bind(this);
        this.importUrl = this.importUrl.bind(this);
        this.cloneGithub = this.cloneGithub.bind(this);
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

    private importHex() {
        pxt.tickEvent("projects.import", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.showImportFileDialog();
    }

    private importUrl() {
        pxt.tickEvent("projects.importurl", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.showImportUrlDialog();
    }

    private async cloneGithub() {
        pxt.tickEvent("github.projects.clone", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.showImportGithubDialog();
    }

    renderCore() {
        const { visible } = this.state;
        const disableFileAccessinMaciOs = pxt.appTarget.appTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac());
        const showImport = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing;
        const showCreateGithubRepo = pxt.appTarget?.cloud?.cloudProviders?.github;
        /* tslint:disable:react-a11y-anchors */
        return (
            <sui.Modal isOpen={visible} className="importdialog" size="small"
                onClose={this.close} dimmer={true}
                closeIcon={true} header={lf("Import")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                <div className={pxt.github.token ? "ui three cards" : "ui two cards"}>
                    {pxt.appTarget.compile && !disableFileAccessinMaciOs ?
                        <codecard.CodeCardView
                            ariaLabel={lf("Open files from your computer")}
                            role="button"
                            key={'import'}
                            icon="upload"
                            iconColor="secondary"
                            name={lf("Import File...")}
                            description={lf("Open files from your computer")}
                            onClick={this.importHex}
                        /> : undefined}
                    {showImport &&
                        <codecard.CodeCardView
                            ariaLabel={lf("Open a shared project URL or GitHub repo")}
                            role="button"
                            key={'importurl'}
                            icon="cloud download"
                            iconColor="secondary"
                            name={lf("Import URL...")}
                            description={lf("Open a shared project URL or GitHub repo")}
                            onClick={this.importUrl}
                        />}
                    {showCreateGithubRepo &&
                        <codecard.CodeCardView
                            ariaLabel={lf("Clone or create your own GitHub repository")}
                            role="button"
                            key={'importgithub'}
                            icon="github"
                            iconColor="secondary"
                            name={lf("Your GitHub Repo...")}
                            description={lf("Clone or create your own GitHub repository")}
                            onClick={this.cloneGithub}
                        />}
                </div>
            </sui.Modal>
        )
    }
}

export interface ExitAndSaveDialogState {
    visible?: boolean;
    emoji?: string;
    projectName?: string;
}

export class ExitAndSaveDialog extends data.Component<ISettingsProps, ExitAndSaveDialogState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            emoji: ""
        }

        this.hide = this.hide.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.save = this.save.bind(this);
        this.skip = this.skip.bind(this);
    }

    hide() {
        this.setState({ visible: false });
    }

    show() {
        pxt.tickEvent('exitandsave.show', undefined, { interactiveConsent: false });
        this.setState({
            projectName: this.props.parent.state.projectName,
            visible: true
        });
    }

    handleChange(name: string) {
        this.setState({
            projectName: name,
            emoji: projectNameToEmoji(name)
        });
    }

    skip() {
        pxt.tickEvent("exitandsave.skip", undefined, { interactiveConsent: true });
        this.hide();
        this.props.parent.openHome();
    }

    save() {
        const { projectName: newName } = this.state;
        this.hide();
        let p = Promise.resolve();
        // save project name if valid change
        if (newName && this.props.parent.state.projectName != newName) {
            pxt.tickEvent("exitandsave.projectrename", { length: newName && newName.length }, { interactiveConsent: true });
            p = p.then(() => this.props.parent.updateHeaderNameAsync(newName));
        }
        p.done(() => {
            this.props.parent.openHome();
        })
    }

    renderCore() {
        const { visible, projectName } = this.state;

        const mobile = pxt.BrowserUtils.isMobile();
        const actions = [
            {
                label: lf("Save"),
                onclick: this.save,
                icon: 'check',
                className: 'approve positive'
            },
            {
                label: lf("Skip"),
                onclick: this.skip
            }
        ];

        return (
            <sui.Modal isOpen={visible} className="exitandsave" size="tiny"
                onClose={this.hide} dimmer={true} buttons={actions}
                closeIcon={true} header={lf("Project has no name {0}", this.state.emoji)}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                <div>
                    <p>{lf("Give your project a name.")}</p>
                    <div className="ui form">
                        <sui.Input ref="filenameinput" id={"projectNameInput"}
                            ariaLabel={lf("Type a name for your project")} autoComplete={false}
                            value={projectName || ''} onChange={this.handleChange} onEnter={this.save}
                            selectOnMount={!mobile} autoFocus={!mobile} />
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

export interface NewProjectDialogState {
    name?: string;
    languageRestriction?: pxt.editor.LanguageRestriction;
    emoji?: string;
    visible?: boolean;
}

export class NewProjectDialog extends data.Component<ISettingsProps, NewProjectDialogState> {
    private createProjectCb: (projectState: pxt.editor.ProjectCreationOptions) => void;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            emoji: "",
            languageRestriction: pxt.editor.LanguageRestriction.Standard
        }
    }

    hide = () => {
        this.setState({ visible: false });
    }

    show = () => {
        pxt.tickEvent('newprojectdialog.show', undefined, { interactiveConsent: false });
        this.setState({
            name: "",
            emoji: "",
            visible: true,
            languageRestriction: pxt.editor.LanguageRestriction.Standard
        });
    }

    handleTextChange = (name: string) => {
        this.setState({
            name,
            emoji: projectNameToEmoji(name)
        });
    }

    handleLanguageChange = (lang: string) => {
        this.setState({
            languageRestriction: lang as pxt.editor.LanguageRestriction
        });
    }

    promptUserAsync() {
        this.show();
        return new Promise<pxt.editor.ProjectCreationOptions>(resolve => {
            this.createProjectCb = resolve;
        });
    }

    save = () => {
        const { name, languageRestriction } = this.state;

        this.hide();
        if (this.createProjectCb) {
            this.createProjectCb({
                name,
                languageRestriction
            });
        }

        pxt.tickEvent(
            'newprojectdialog.projectcreate',
            { language: languageRestriction },
            { interactiveConsent: true }
        );
        this.createProjectCb = null;
    }

    onExpandedMenuHide = () => {
        pxt.tickEvent('newprojectdialog.codeoptions.hide');
        // reset language restrictions when user closes the options menu;
        // it's an 'advanced' feature that we want an easy escape hatch for.
        this.setState({
            languageRestriction: pxt.editor.LanguageRestriction.Standard
        });
    }

    onExpandedMenuShow = () => {
        pxt.tickEvent('newprojectdialog.codeoptions.show');
    }

    renderCore() {
        const { visible, name, emoji } = this.state;
        const { python, chooseLanguageRestrictionOnNewProject } = pxt.appTarget.appTheme;

        const actions: sui.ModalButton[] = [
            {
                label: lf("Create"),
                onclick: this.save,
                icon: 'check',
                className: 'approve positive'
            }
        ];

        const mobile = pxt.BrowserUtils.isMobile();
        const langOpts: sui.SelectItem[] = [
            {
                value: pxt.editor.LanguageRestriction.Standard,
                display: python ? lf("Blocks, {0}, and {1}", "JavaScript", "Python") : lf("Blocks and {0}", "JavaScript")
            },
            python && {
                value: pxt.editor.LanguageRestriction.PythonOnly,
                display: lf("{0} Only", "Python")
            },
            {
                value: pxt.editor.LanguageRestriction.JavaScriptOnly,
                display: lf("{0} Only", "JavaScript")
            }
        ];


        return <sui.Modal isOpen={visible} className="newproject" size="tiny"
            onClose={this.hide} dimmer={true} buttons={actions}
            closeIcon={true} header={lf("Create a Project {0}", emoji)}
            closeOnDimmerClick closeOnDocumentClick closeOnEscape
        >
            <div>
                <p>{lf("Give your project a name.")}</p>
                <div className="ui form">
                    <sui.Input ref="filenameinput" id={"projectNameInput"}
                        ariaLabel={lf("Type a name for your project")} autoComplete={false}
                        value={name || ''} onChange={this.handleTextChange} onEnter={this.save}
                        selectOnMount={!mobile} autoFocus={!mobile} />
                </div>
            </div>
            {chooseLanguageRestrictionOnNewProject && <div>
                <br />
                <sui.ExpandableMenu title={lf("Code options")} onShow={this.onExpandedMenuShow} onHide={this.onExpandedMenuHide}>
                    <sui.Select options={langOpts} onChange={this.handleLanguageChange} aria-label={lf("Select Language")} />
                </sui.ExpandableMenu>
            </div>}
        </sui.Modal>
    }
}

function projectNameToEmoji(name: string) {
    const untitled = lf("Untitled");

    let emoji = "";
    if (name && untitled.indexOf(name) === -1) {
        const emojis = ["😌", "😄", "😃", "😍"];
        emoji = emojis[Math.min(name.length, emojis.length) - 1];
        const n = name.length >> 1;
        if (n > emojis.length) {
            for (let i = 0; i < Math.min(2, n - emojis.length); ++i) {
                emoji += emojis[emojis.length - 1];
            }
        }
    }

    return emoji;
}


export interface ChooseHwDialogState {
    visible?: boolean;
    skipDownload?: boolean;
}

export class ChooseHwDialog extends data.Component<ISettingsProps, ChooseHwDialogState> {
    private prevGalleries: pxt.CodeCard[] = [];

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            skipDownload: false
        }
        this.close = this.close.bind(this);
    }

    hide() {
        this.setState({ visible: false });
    }

    close() {
        this.setState({ visible: false });
    }

    show(skipDownload?: boolean) {
        this.setState({ visible: true, skipDownload: !!skipDownload });
    }

    fetchGallery(): pxt.CodeCard[] {
        const path = "/hardware";
        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as pxt.gallery.Gallery[];
        if (res) {
            if (res instanceof Error) {
                // ignore
            } else {
                this.prevGalleries = pxt.Util.concat(res.map(g => g.cards))
                    .filter(c => !!c.variant);
            }
        }
        return this.prevGalleries || [];
    }

    private setHwVariant(cfg: pxt.PackageConfig, card: pxt.CodeCard) {
        pxt.tickEvent("projects.choosehwvariant", {
            hwid: cfg.name,
            card: card ? card.name : cfg.name
        }, { interactiveConsent: true });
        this.hide()

        pxt.setHwVariant(cfg.name, card ? card.name : (cfg.description || cfg.name))
        let editor = this.props.parent
        editor.reloadHeaderAsync()
            .then(() => !this.state.skipDownload && editor.compile())
            .done()
    }

    renderCore() {
        const { visible } = this.state;
        if (!visible) return <div />;

        const variants = pxt.getHwVariants();
        for (const v of variants) {
            if (!v.card)
                v.card = {
                    name: v.description
                }
            const savedV = v
            v.card.onClick = () => this.setHwVariant(savedV, null)
        }
        let cards = this.fetchGallery();
        for (const card of cards) {
            const savedV = variants.find(variant => variant.name == card.variant);
            const savedCard = card;
            if (savedV)
                card.onClick = () => this.setHwVariant(savedV, savedCard);
            else {
                pxt.reportError("hw", "invalid variant");
            }
        }
        cards = cards.filter(card => !!card.onClick);

        /* tslint:disable:react-a11y-anchors */
        return (
            <sui.Modal isOpen={visible} className="hardwaredialog" size="large"
                onClose={this.close} dimmer={true}
                closeIcon={true} header={lf("Choose your hardware")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                <div className="group">
                    <div className="ui cards centered" role="listbox">
                        {cards.map(card =>
                            <codecard.CodeCardView
                                key={'card' + card.name}
                                name={card.name}
                                ariaLabel={card.name}
                                description={card.description}
                                imageUrl={card.imageUrl}
                                learnMoreUrl={card.url}
                                onClick={card.onClick}
                            />
                        )}
                        {variants.map(cfg =>
                            <codecard.CodeCardView
                                key={'variant' + cfg.name}
                                name={cfg.card.name}
                                ariaLabel={cfg.card.name}
                                description={cfg.card.description}
                                imageUrl={cfg.card.imageUrl}
                                learnMoreUrl={cfg.card.learnMoreUrl}
                                onClick={cfg.card.onClick}
                            />
                        )}
                    </div>
                </div>
                <p>
                    <br /><br />
                    {lf("No hardware? Or want to add some?")}
                    {" "}
                    <a className="small" href={`/hardware`} target="_blank" rel="noopener noreferrer"
                        aria-label={lf("Learn more about hardware")}>{lf("Learn more!")}</a>
                </p>
            </sui.Modal>
        )
    }
}
