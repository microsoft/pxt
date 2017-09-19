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
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.Map<pxt.CodeCard[]> = {};
    private galleryFetchErrors: { [tab: string]: boolean } = {};

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
        tab = (!tab || !gals[tab]) ? WELCOME : tab;
        this.setState({ visible: true, tab: tab || WELCOME });
    }

    showOpenTutorials() {
        const gals = Object.keys(pxt.appTarget.appTheme.galleries || {});
        this.setState({ visible: true, tab: gals[0] || WELCOME });
    }

    fetchGallery(tab: string, path: string): pxt.CodeCard[] {
        if (this.state.tab != tab) return [];

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
        const {hasGettingStarted} = this.props;

        const theme = pxt.appTarget.appTheme;
        const galleries = theme.galleries || {};

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
            pxt.tickEvent(tab == WELCOME ? "projects.welcome.resume" : "projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            if (!scr.youTubeId || scr.url) this.hide();
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
        const gettingStarted = () => {
            pxt.tickEvent("projects.welcome.gettingstarted");
            this.hide();
            this.props.parent.gettingStarted();
        }

        const seeAll = (gal: string) => {
            this.setState({ tab: gal });
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

        const hadFetchError = this.galleryFetchErrors[tab];
        const isLoading = tab != WELCOME && tab != MYSTUFF && !hadFetchError && !gals[tab].length;

        const tabClasses = sui.cx([
            isLoading ? 'loading' : '',
            'ui segment bottom attached tab active tabsegment'
        ]);

        const tabName = tab == WELCOME ? lf("Home") : tab == MYSTUFF ? lf("My Stuff") : Util.rlf(tab);
        const tabIcon = tab == WELCOME ? "home large" : undefined;

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" onClose={() => this.hide(/* closeOnly */ true) } dimmer={true} closeOnDimmerClick>
                <div id="menubar" role="banner">
                    <div className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
                        <div className="left menu">
                            <span className="ui item logo brand">
                                {targetTheme.logo || targetTheme.portraitLogo
                                    ? <a className="ui image landscape only" target="_blank" rel="noopener" href={targetTheme.logoUrl}><img className={`ui logo ${targetTheme.portraitLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo) } alt={`${targetTheme.boardName} Logo`} /></a>
                                    : <span className="name">{targetTheme.name}</span>}
                                {targetTheme.portraitLogo ? (<a className="ui portrait only" target="_blank" rel="noopener" href={targetTheme.logoUrl}><img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.portraitLogo) } alt={`${targetTheme.boardName} Logo`} /></a>) : null}
                            </span>
                        </div>
                        <div className="ui item">{tabIcon ? <i className={`icon ${tabIcon}`} aria-hidden={true}/> : undefined} {tabName}</div>
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
                    {hasGettingStarted ?
                        <div className="ui segment getting-started-segment" style={{backgroundImage: `url(${pxt.webConfig.commitCdnUrl + encodeURI(targetTheme.homeScreenHero)})`}}>
                            <div className="ui stackable grid equal width padded">
                                <div className="column" />
                                <div className="column right aligned">
                                    <div className="getting-started">
                                        <h2>{lf("First time here?") }</h2>
                                        <div className="ui huge primary button" onClick={gettingStarted}>{lf("Get Started") }<i className="right arrow icon"></i></div>
                                    </div>
                                </div>
                            </div>
                        </div> : undefined }
                    <div className="ui segment gallerysegment">
                        <div className="ui grid equal width padded stackable">
                            <div className="column">
                                <h2 className="ui header">{lf("My Stuff") } </h2>
                            </div>
                            <div className="column right aligned">
                                {pxt.appTarget.compile ?
                                    <sui.Button key="importfile" icon="upload" class="secondary tiny" textClass="landscape only" text={lf("Import File") } title={lf("Open files from your computer") } onClick={() => importHex() } /> : undefined}
                                {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                                    <sui.Button key="importurl" icon="cloud download" class="secondary tiny" textClass="landscape only" text={lf("Import URL") } title={lf("Open a shared project URL") } onClick={() => importUrl() } /> : undefined}
                            </div>
                        </div>
                        <div className="content">
                            <ProjectsCarousel key={`${MYSTUFF}_carousel`} parent={this.props.parent} name={'recent'} hide={() => this.hide() } onClick={(scr: any) => chgHeader(scr) }/>
                        </div>
                    </div>
                    {Object.keys(galleries).map(galleryName =>
                        <div>
                            <div className="ui divider"></div>
                            <div className="ui segment gallerysegment">
                                <div className="ui grid equal width padded stackable">
                                    <div className="column">
                                        <h2 className="ui header">{Util.rlf(galleryName) } </h2>
                                    </div>
                                </div>
                                <div className="content">
                                    <ProjectsCarousel  key={`${galleryName}_carousel`} parent={this.props.parent} name={galleryName} path={galleries[galleryName]} hide={() => this.hide() } onClick={(scr: any) => chgGallery(scr) }/>
                                </div>
                            </div>
                        </div>
                    ) }
                    {targetTheme.organizationUrl || targetTheme.organizationUrl || targetTheme.privacyUrl ? <div className="ui horizontal small divided link list homefooter">
                        {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                        {targetTheme.termsOfUseUrl ? <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener">{lf("Terms of Use") }</a> : undefined }
                        {targetTheme.privacyUrl ? <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener">{lf("Privacy") }</a> : undefined }
                    </div> : undefined }
                </div> : undefined }
                {tab == MYSTUFF ? <div className={tabClasses} id={`tab${tab}`} role="tabpanel" aria-labelledby={`${tab}tab`} aria-hidden="false">
                    <div className="group">
                        <div className="ui cards">
                            <codecard.CodeCardView
                                ariaLabel={lf("Creates a new empty project") }
                                role="button"
                                key={'newproject'}
                                icon="file outline"
                                iconColor="primary"
                                name={lf("New Project...") }
                                description={lf("Creates a new empty project") }
                                onClick={() => newProject() }
                                />
                            {pxt.appTarget.compile ?
                                <codecard.CodeCardView
                                    ariaLabel={lf("Open files from your computer") }
                                    role="button"
                                    key={'import'}
                                    icon="upload"
                                    iconColor="secondary"
                                    name={lf("Import File...") }
                                    description={lf("Open files from your computer") }
                                    onClick={() => importHex() }
                                    /> : undefined }
                            {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                                <codecard.CodeCardView
                                    ariaLabel={lf("Open a shared project URL") }
                                    role="button"
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
                            <div className="ui cards" role={headerGroup.headers.length ? "listbox" : undefined}>
                                {headerGroup.headers.map(scr =>
                                    <codecard.CodeCardView
                                        ariaLabel={scr.name}
                                        role="option"
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
                        <div className="ui cards" role={urldata.length ? "listbox" : undefined}>
                            {urldata.map(scr =>
                                <codecard.CodeCardView
                                    ariaLabel={scr.name}
                                    role="option"
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
                {tab != MYSTUFF && tab != WELCOME ? <div className={tabClasses} id={`tab${tab}`} role="tabpanel" aria-labelledby={`${tab}tab`} aria-hidden="false">
                    {hadFetchError ?
                        <p className="ui red inverted segment">{lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.") }</p>
                        : <div className="ui cards centered" role={gals[tab].length ? "listbox" : undefined}>
                            {gals[tab].map(scr => <codecard.CodeCardView
                                ariaLabel={scr.name}
                                role="option"
                                key={tab + scr.name}
                                name={scr.name}
                                description={scr.description}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                onClick={() => chgGallery(scr) }
                                />
                            ) }
                        </div>}
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
    path?: string;
    cardWidth?: number;
    hide: Function;
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

    constructor(props: ProjectsCarouselProps) {
        super(props)
        this.state = {
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

    newProject() {
        pxt.tickEvent("projects.carousel.new");
        this.props.hide();
        this.props.parent.newProject();
    }

    showDetails(index: number, src: any) {
        this.setState({ expanded: true, slickGoTo: index });
    }

    renderCore() {
        const {name, path} = this.props;
        const theme = pxt.appTarget.appTheme;

        // Fetch the gallery
        this.hasFetchErrors = false;
        let cards: pxt.CodeCard[];
        let headers: pxt.workspace.Header[];
        if (path) {
            cards = this.fetchGallery(path);
        } else {
            headers = this.fetchLocalData();
            headers.unshift({
                id: 'new',
                name: lf("New Project")
            } as any)
        }

        const sliderSettings = this.getCarouselOptions();
        const responsiveOptions = [
            {
                breakpoint: 1300,
                settings: {
                    slidesToShow: 4,
                    slidesToScroll: 4,
                    infinite: false
                }
            }, {
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

        let sliding = false;
        const beforeChange = () => {
            sliding = true;
        }

        const afterChange = () => {
            sliding = false;
        }

        const onClick = (scr: any) => {
            if (!sliding) {
                this.props.onClick(scr);
            }
        }

        return <div className="ui dimmable">
            {this.hasFetchErrors ?
                <p className="ui red inverted segment">{lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.") }</p>
                :
                <Slider dots={false} infinite={false} slidesToShow={5} slidesToScroll={5} responsive={responsiveOptions} beforeChange={beforeChange} afterChange={afterChange} >
                    {cards ? cards.map((scr, index) =>
                        <div key={path + scr.name}>
                            <codecard.CodeCardView
                                className="example"
                                key={'gallery' + scr.name}
                                name={scr.name}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                onClick={() => onClick(scr) }
                                />
                        </div>
                    ) : headers.map((scr, index) =>
                        <div>
                            {scr.id == 'new' ?
                                <div className="ui card newprojectcard" tabIndex={1} title={lf("Creates a new empty project") } onClick={() => this.newProject() }>
                                    <div className="content">
                                        <i className="icon huge add circle"></i>
                                        <span className="header">{scr.name}</span>
                                    </div>
                                </div>
                                :
                                <codecard.CodeCardView
                                    cardType="file"
                                    className="file"
                                    key={'local' + scr.id}
                                    name={scr.name}
                                    time={scr.recentUse}
                                    url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                    onClick={() => onClick(scr) }
                                    />
                            }
                        </div>
                    ) }
                </Slider>
            }
        </div>;
    }
}