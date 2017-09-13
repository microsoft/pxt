/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../localtypings/react-slick.d.ts" />
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

import Slider from 'react-slick';

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

interface ProjectsProps extends ISettingsProps {
    hasGettingStarted: boolean;
}

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    tab?: string;
    isInitialStartPage?: boolean;
    resumeProject?: pxt.workspace.Header;
    welcomeDescription?: string;
}

const WELCOME = "__welcome";
const MYSTUFF = "__mystuff";

export class Projects extends data.Component<ProjectsProps, ProjectsState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];

    constructor(props: ProjectsProps) {
        super(props)
        this.state = {
            visible: false,
            tab: MYSTUFF
        }
    }

    hide(closeOnly: boolean = false) {
        if (this.state.isInitialStartPage && closeOnly) {
            // If this was the initial start page and the dialog was close without a selection being made, load the
            // previous project if available or create a new one
            pxt.tickEvent("projects.welcome.hide");
            if (this.state.resumeProject) {
                this.props.parent.loadHeaderAsync(this.state.resumeProject);
            } else {
                this.props.parent.newProject();
            }
        }
        this.setState({ visible: false, isInitialStartPage: false });
    }

    showHome(resumeProject?: pxt.workspace.Header) {
        this.setState({
            visible: true,
            tab: WELCOME,
            isInitialStartPage: true,
            resumeProject
        });
    }

    showOpenProject(tab?: string) {
        const gals = pxt.appTarget.appTheme.galleries || {};
        tab = (!tab || !gals[tab]) ? MYSTUFF : tab;
        this.setState({ visible: true, tab: tab || WELCOME });
    }

    showOpenTutorials() {
        const gals = Object.keys(pxt.appTarget.appTheme.galleries || {});
        this.setState({ visible: true, tab: gals[0] || WELCOME });
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
        if (this.state.tab != MYSTUFF) return [];

        let headers: pxt.workspace.Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.tab != nextState.tab
            || this.state.searchFor != nextState.searchFor
            || this.state.welcomeDescription != nextState.welcomeDescription;
    }

    private numDaysOld(d1: number) {
        let diff = Math.abs((Date.now() / 1000) - d1);
        return Math.floor(diff / (60 * 60 * 24));
    }

    renderCore() {
        const {visible, tab} = this.state;

        const theme = pxt.appTarget.appTheme;
        const galleries = theme.galleries || {};

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent(tab == WELCOME ? "projects.welcome.resume" : "projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            this.hide();
            switch (scr.cardType) {
                case "example": chgCode(scr, true); break;
                case "codeExample": chgCode(scr, false); break;
                case "tutorial": this.props.parent.startTutorial(scr.url); break;
                default:
                    const m = /^\/#tutorial:([a-z0A-Z0-9\-\/]+)$/.exec(scr.url);
                    if (m) this.props.parent.startTutorial(m[1]);
                    else {
                        if (scr.youTubeId && !scr.url)
                            window.open('https://youtu.be/' + scr.youTubeId, 'yt');
                        else this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
                    }
            }
        }

        const chgCode = (scr: pxt.CodeCard, loadBlocks?: boolean) => {
            core.showLoading(lf("Loading..."));
            gallery.loadExampleAsync(scr.name.toLowerCase(), scr.url)
                .done(opts => {
                    if (opts) {
                        if (loadBlocks) {
                            const ts = opts.filesOverride["main.ts"]
                            compiler.getBlocksAsync()
                                .then(blocksInfo => compiler.decompileSnippetAsync(ts, blocksInfo))
                                .then(resp => {
                                    opts.filesOverride["main.blocks"] = resp
                                    this.props.parent.newProject(opts);
                                })
                        } else {
                            this.props.parent.newProject(opts);
                        }
                    }
                });
        }
        const upd = (v: any) => {
            let str = (ReactDOM.findDOMNode(this.refs["searchInput"]) as HTMLInputElement).value
            this.setState({ searchFor: str })
        };
        const kupd = (ev: __React.KeyboardEvent) => {
            if (ev.keyCode == 13) upd(ev);
        }
        const installScript = (scr: Cloud.JsonScript) => {
            this.hide();
            core.showLoading(lf("loading project..."));
            workspace.installByIdAsync(scr.id)
                .then(r => this.props.parent.loadHeaderAsync(r))
                .done(() => core.hideLoading())
        }
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
        const newProject = () => {
            pxt.tickEvent(tab == WELCOME ? "projects.welcome.new" : "projects.new");
            this.hide();
            this.props.parent.newProject();
        }
        const renameProject = () => {
            pxt.tickEvent("projects.rename");
            this.hide();
            this.props.parent.setFile(pkg.mainEditorPkg().files[pxt.CONFIG_NAME])
        }
        const resume = () => {
            if (this.state.isInitialStartPage) {
                chgHeader(this.state.resumeProject);
            } else {
                // The msot recent project is already loaded in the editor, so this is a no-op
                this.hide();
            }
        }
        const gettingStarted = () => {
            pxt.tickEvent("projects.welcome.gettingstarted");
            this.hide();
            this.props.parent.gettingStarted();
        }
        const loadProject = () => {
            pxt.tickEvent("projects.welcome.loadproject");
            this.setState({ tab: MYSTUFF });
        }
        const projectGalleries = () => {
            pxt.tickEvent("projects.welcome.galleries");
            //this.setState({ tab: galleryNames[0] })
        }

        const isEmpty = () => {
            if (this.state.searchFor) {
                if (headers.length > 0
                    || urldata.length > 0)
                    return false;
                return true;
            }
            return false;
        }

        const targetTheme = pxt.appTarget.appTheme;

        const headersToday = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days == 0; });
        const headersYesterday = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days == 1; });
        const headersThisWeek = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 1 && days <= 7; });
        const headersLastWeek = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 7 && days <= 14; });
        const headersThisMonth = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 14 && days <= 30; });
        const headersOlder = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 30; });
        const headersGrouped: { name: string, headers: pxt.workspace.Header[] }[] = [
            { name: lf("Today"), headers: headersToday },
            { name: lf("Yesterday"), headers: headersYesterday },
            { name: lf("This Week"), headers: headersThisWeek },
            { name: lf("Last Week"), headers: headersLastWeek },
            { name: lf("This Month"), headers: headersThisMonth },
            { name: lf("Older"), headers: headersOlder },
        ];

        //const hadFetchError = this.galleryFetchErrors[tab];
        const isLoading = tab != WELCOME && tab != MYSTUFF;// && !hadFetchError && !gals[tab].length;

        const tabClasses = sui.cx([
            isLoading ? 'loading' : '',
            'ui segment bottom attached tab active tabsegment'
        ]);

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" closeIcon={false}
                onClose={() => this.hide(/* closeOnly */ true) } dimmer={true}>
                <div id="menubar" role="banner">
                    <div className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
                        <div className="left menu">
                            <span className="ui item logo brand">
                                {targetTheme.logo || targetTheme.portraitLogo
                                    ? <a className="ui image" target="_blank" rel="noopener" href={targetTheme.logoUrl}><img className={`ui logo ${targetTheme.portraitLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo) } alt={`${targetTheme.boardName} Logo`} /></a>
                                    : <span className="name">{targetTheme.name}</span>}
                                {targetTheme.portraitLogo ? (<a className="ui" target="_blank" rel="noopener" href={targetTheme.logoUrl}><img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.portraitLogo) } alt={`${targetTheme.boardName} Logo`} /></a>) : null}
                            </span>
                        </div>
                        <div className="right menu">
                            <a href={targetTheme.organizationUrl} target="blank" rel="noopener" className="ui item logo organization" onClick={() => pxt.tickEvent("menu.org") }>
                                {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                                    ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.organizationWideLogo || targetTheme.organizationLogo) } alt={`${targetTheme.organization} Logo`} />
                                    : <span className="name">{targetTheme.organization}</span>}
                                {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.organizationLogo) } alt={`${targetTheme.organization} Logo`} />) : null}
                            </a>
                        </div>
                    </div>
                </div>
                {tab == WELCOME ? <div className={tabClasses}>
                    <div className="ui segment getting-started-segment">
                        <div className="ui stackable grid equal width">
                            <div className="column" />
                            <div className="column right aligned">
                                <div className="getting-started">
                                    <h2>{lf("First time here?")}</h2>
                                    <div className="ui huge primary button" onClick={gettingStarted}>{lf("Get Started")}<i className="right arrow icon"></i></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="ui segment gallerysegment">
                        <h4 className="ui header">{lf("My Stuff") }</h4>
                        <div className="ui stackable grid">
                            <div className="four wide column">
                                <div className="ui card newprojectcard">
                                    <div className="content">
                                        <i className="icon huge add circle"></i>
                                        <span className="header">{lf("New Project...") }</span>
                                    </div>
                                </div>
                            </div>
                            <div className="twelve wide column">
                                <ProjectsCarousel parent={this.props.parent} name={'recent'}/>
                            </div>
                        </div>
                    </div>
                    {Object.keys(galleries).map(galleryName =>
                        <div>
                            <div className="ui divider"></div>
                            <div className="ui segment gallerysegment">
                                <h2 className="ui header">{galleryName}</h2>
                                <div className="content">
                                    <ProjectsCarousel parent={this.props.parent} name={galleryName} galleryEntry={galleries[galleryName]}/>
                                </div>
                            </div>
                        </div>
                    ) }
                </div> : undefined }
                {tab == MYSTUFF ? <div className={tabClasses}>
                    <div className="group">
                        <div className="ui cards">
                            <codecard.CodeCardView
                                key={'newproject'}
                                icon="file outline"
                                iconColor="primary"
                                name={lf("New Project...") }
                                description={lf("Creates a new empty project") }
                                onClick={() => newProject() }
                                />
                            {pxt.appTarget.compile ?
                                <codecard.CodeCardView
                                    key={'import'}
                                    icon="upload"
                                    iconColor="secondary"
                                    name={lf("Import File...") }
                                    description={lf("Open files from your computer") }
                                    onClick={() => importHex() }
                                    /> : undefined }
                            {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                                <codecard.CodeCardView
                                    key={'importurl'}
                                    icon="cloud download"
                                    iconColor="secondary"
                                    name={lf("Import URL...") }
                                    description={lf("Open a shared project URL") }
                                    onClick={() => importUrl() }
                                    /> : undefined }
                        </div>
                    </div>
                    {headersGrouped.filter(g => g.headers.length != 0).map(headerGroup =>
                        <div key={'localgroup' + headerGroup.name} className="group">
                            <h3 className="ui dividing header disabled">
                                {headerGroup.name}
                            </h3>
                            <div className="ui cards">
                                {headerGroup.headers.map(scr =>
                                    <codecard.CodeCardView
                                        key={'local' + scr.id}
                                        name={scr.name}
                                        time={scr.recentUse}
                                        imageUrl={scr.icon}
                                        url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                        onClick={() => chgHeader(scr) }
                                        />
                                ) }
                            </div>
                        </div>
                    ) }
                    <div className="group">
                        <div className="ui cards">
                            {urldata.map(scr =>
                                <codecard.CodeCardView
                                    name={scr.name}
                                    time={scr.time}
                                    header={'/' + scr.id}
                                    description={scr.description}
                                    key={'cloud' + scr.id}
                                    onClick={() => installScript(scr) }
                                    url={'/' + scr.id}
                                    color="blue"
                                    />
                            ) }
                        </div>
                    </div>
                </div> : undefined }
                {tab != MYSTUFF && tab != WELCOME ? <div className={tabClasses}>
                </div> : undefined }
                { isEmpty() ?
                    <div className="ui items">
                        <div className="ui item">
                            {lf("We couldn't find any projects matching '{0}'", this.state.searchFor) }
                        </div>
                    </div>
                    : undefined }
            </sui.Modal >
        );
    }
}

interface ProjectsCarouselProps extends ISettingsProps {
    name: string;
    galleryEntry?: string | pxt.GalleryEntry;
    cardWidth?: number;
}

interface ProjectsCarouselState {
    expanded?: boolean;
    slickGoTo?: number;
    slickSetOption?: any;
}

export class ProjectsCarousel extends data.Component<ProjectsCarouselProps, ProjectsCarouselState> {
    private prevGalleries: pxt.CodeCard[] = [];
    private prevHeaders: pxt.workspace.Header[] = [];
    private hasFetchErrors = false;
    private node: any;
    private carousel: any;

    constructor(props: ProjectsCarouselProps) {
        super(props)
        this.state = {
            expanded: false,
            slickGoTo: 0,
            slickSetOption: undefined
        }

        this.showDetails = this.showDetails.bind(this);
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

    componentDidMount() {
        this.updateCarousel();
    }

    componentDidUpdate(prevProps: ProjectsCarouselProps, prevState: ProjectsCarouselState) {
        this.updateCarousel();
    }

    updateCarousel() {
        if (!this.prevGalleries.length && !this.prevHeaders.length) return;
        this.carousel = $(this.node);
    }

    getCarouselOptions() {
        const isRTL = Util.isUserLanguageRtl();
        const options: any = {
            accessibility: true,
            dots: true,
            infinite: true,
            speed: 500,
            slidesToShow: 1,
            slidesToScroll: 1
        };
        return options;
    }

    showDetails(index: number, src: any) {
        this.setState({ expanded: true, slickGoTo: index });
    }

    renderCore() {
        const {expanded, slickGoTo, slickSetOption} = this.state;
        const {name, galleryEntry} = this.props;
        const theme = pxt.appTarget.appTheme;
        const isGallery = galleryEntry && !(typeof galleryEntry == "string");
        const path = isGallery ? (galleryEntry as pxt.GalleryEntry).path : (galleryEntry as string);
        const hoverIcon = isGallery ? (galleryEntry as pxt.GalleryEntry).hoverIcon : '';
        const hoverButton = isGallery ? (galleryEntry as pxt.GalleryEntry).hoverButton : '';
        const hoverButtonClass = isGallery ? (galleryEntry as pxt.GalleryEntry).hoverButtonClass : '';

        // Fetch the gallery
        this.hasFetchErrors = false;
        let cards: pxt.CodeCard[];
        let headers: pxt.workspace.Header[];
        if (path) {
            cards = this.fetchGallery(path);
        } else {
            headers = this.fetchLocalData();
        }

        const chgGallery = (src: any) => {
            console.log(src);
        }

        const chgHeader = (src: any) => {
            console.log(src);
        }

        const sliderSettings = this.getCarouselOptions();
        const responsiveOptions = [{
            breakpoint: 1024,
            settings: {
                slidesToShow: 3,
                slidesToScroll: 3,
                infinite: false
            }
        }, {
                breakpoint: 600,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 2,
                    infinite: false
                }
            }, {
                breakpoint: 300,
                settings: "unslick" // destroys slick
            }];

        return <div className="ui dimmable">
            {this.hasFetchErrors ?
                <p className="ui red inverted segment">{lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.") }</p>
                :
                <Slider slickGoTo={slickGoTo} dots={false} infinite={false} slidesToShow={4} slidesToScroll={4} responsive={responsiveOptions}>
                    {cards ? cards.map((scr, index) =>
                        <div key={path + scr.name}>
                            {expanded ? <div>{scr.name}</div> :
                                <codecard.CodeCardView
                                    name={scr.name}
                                    description={scr.description}
                                    url={scr.url}
                                    imageUrl={scr.imageUrl}
                                    youTubeId={scr.youTubeId}
                                    hoverIcon={hoverIcon}
                                    hoverButton={hoverButton}
                                    hoverButtonClass={hoverButtonClass}
                                    onClick={() => this.showDetails(index, scr) }
                                    />
                            }</div>
                    ) : headers.slice(0, 5).map(scr =>
                        <div><codecard.CodeCardView
                            cardType="file"
                            className="file"
                            key={'local' + scr.id}
                            name={scr.name}
                            time={scr.recentUse}
                            url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                            /></div>
                    ) }
                </Slider>}
            {expanded ? <div className="expanded"></div> : undefined}
        </div>;
    }
}