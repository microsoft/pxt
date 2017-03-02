namespace pxt.Cloud {
    import Util = pxtc.Util;

    export var apiRoot = "https://www.pxt.io/api/";
    export var accessToken = "";
    export var localToken = "";
    let _isOnline = true;
    export var onOffline = () => { };

    function offlineError(url: string) {
        let e: any = new Error(Util.lf("Cannot access {0} while offline", url));
        e.isOffline = true;
        return Promise.delay(1000).then(() => Promise.reject(e))
    }

    export function hasAccessToken() {
        return !!accessToken
    }

    export function isLocalHost(): boolean {
        try {
            return /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(window.location.href)
                && !/nolocalhost=1/.test(window.location.href)
                && !pxt.webConfig.isStatic;
        } catch (e) { return false; }
    }

    export function privateRequestAsync(options: Util.HttpRequestOptions) {
        options.url = apiRoot + options.url
        options.allowGzipPost = true
        if (!Cloud.isOnline()) {
            return offlineError(options.url);
        }
        if (accessToken) {
            if (!options.headers) options.headers = {}
            options.headers["x-td-access-token"] = accessToken
        }
        return Util.requestAsync(options)
            .catch(e => {
                if (e.statusCode == 0) {
                    if (_isOnline) {
                        _isOnline = false;
                        onOffline();
                    }
                    return offlineError(options.url)
                } else {
                    return Promise.reject(e)
                }
            })
    }

    export function privateGetTextAsync(path: string): Promise<string> {
        return privateRequestAsync({ url: path }).then(resp => resp.text)
    }

    export function privateGetAsync(path: string): Promise<any> {
        return privateRequestAsync({ url: path }).then(resp => resp.json)
    }

    export function downloadScriptFilesAsync(id: string) {
        return privateRequestAsync({ url: id + "/text" }).then(resp => {
            return JSON.parse(resp.text)
        })
    }

    export function downloadMarkdownAsync(docid: string, locale?: string, live?: boolean): Promise<string> {
        docid = docid.replace(/^\//, "");
        let url = `md/${pxt.appTarget.id}/${docid}`;
        if (locale != "en") {
            url += `?lang=${encodeURIComponent(Util.userLanguage())}`
            if (live) url += "&live=1"
        }
        if (Cloud.isLocalHost() && !live)
            return Util.requestAsync({
                url: "/api/" + url,
                headers: { "Authorization": Cloud.localToken },
                method: "GET",
                allowHttpErrors: true
            }).then(resp => {
                if (resp.statusCode == 404)
                    return privateGetTextAsync(url);
                else return resp.json as string;
            });
        else return privateGetTextAsync(url);
    }

    export function privateDeleteAsync(path: string) {
        return privateRequestAsync({ url: path, method: "DELETE" }).then(resp => resp.json)
    }

    export function privatePostAsync(path: string, data: any) {
        return privateRequestAsync({ url: path, data: data || {} }).then(resp => resp.json)
    }

    export function isLoggedIn() { return !!accessToken }
    export function isOnline() { return _isOnline; }

    export function getServiceUrl() {
        return apiRoot.replace(/\/api\/$/, "")
    }

    export function getUserId() {
        let m = /^0(\w+)\./.exec(accessToken)
        if (m) return m[1]
        return null
    }

    export function parseScriptId(uri: string): string {
        const target = pxt.appTarget;
        if (!uri || !target.appTheme || !target.appTheme.embedUrl) return undefined;

        let embedUrl = Util.escapeForRegex(Util.stripUrlProtocol(target.appTheme.embedUrl));
        let m = new RegExp(`^((https:\/\/)?${embedUrl})?(api\/oembed\?url=.*%2F([^&]*)&.*?|(.+))$`, 'i').exec(uri.trim());
        let scriptid = m && (m[3] || m[4]) ? (m[3] ? m[3].toLowerCase() : m[4].toLowerCase()) : null
        return scriptid;
    }

    //
    // Interfaces used by the cloud
    //

    // TODO: remove unused interfaces
    // TODO: remove unused fields

    export interface JsonProgress {
        kind: string;
        userid: string;
        progressid: string;
        //guid?: string;
        index: number;
        completed?: number;
    }

    export interface JsonProgressStep {
        index: number;
        text: string;
        count: number;
        minDuration?: number;
        medDuration?: number;
        medModalDuration?: number;
        medPlayDuration?: number;
    }

    export interface JsonProgressStats {
        kind: string; // progressstats
        publicationId: string;
        count: number;
        steps: JsonProgressStep[];
    }

    export interface JsonCapability {
        name: string;
        iconurl: string;
    }

    export interface JsonIdObject {
        kind: string;
        id: string; // id
        url: string; // website for human consumption
    }

    export interface JsonPublication extends JsonIdObject {
        time: number; // time when publication was created
        userid: string; // user id of user who published
        userscore: number;
        username: string;
        userhaspicture: boolean;
    }

    // lite only
    export interface JsonNotification extends JsonPubOnPub {
        notificationkind: string;

        // if publicationkind == 'review', this will hold the script data
        supplementalid: string;
        supplementalkind: string;
        supplementalname: string;
    }

    export interface JsonDocument {
        url: string; // website for human consumption
        kind: string;
        name: string;  // document name
        abstract: string; // document description
        mimetype: string; // mimetype of document given by url
        views: number; // approximate number of document views
        thumburl: string;
    }

    export interface JsonArt extends JsonPublication {
        name: string;
        description: string;
        // if picture
        pictureurl: string;
        mediumthumburl: string;
        thumburl: string;
        flags: string[];
        // if sound
        wavurl: string;
        aacurl: string;
        bloburl?: string;
        arttype?: string;
    }

    export interface JsonUser extends JsonIdObject {
        name: string; // user name
        about: string; // user's about-me text
        features: number; // number of features used by that user
        receivedpositivereviews: number; // number of ♥ given to this user's scripts and comments
        activedays: number;
        subscribers: number; // number of users subscribed to this user
        score: number; // overall score of this user
        haspicture: boolean; // whether this use has a picture
        isadult?: boolean;
    }

    export interface JsonScore {
        points: number;
    }

    export interface JsonReceivedPositiveReviewsScore extends JsonScore {
        scripts: JsonScript[];
    }

    export interface JsonFeature {
        name: string;
        title: string;
        text: string;
        count: number;
    }

    export interface JsonLanguageFeaturesScore extends JsonScore {
        features: JsonFeature[];
    }

    export interface JsonUserScore {
        receivedPositiveReviews: JsonReceivedPositiveReviewsScore;
        receivedSubscriptions: JsonScore;
        languageFeatures: JsonLanguageFeaturesScore;
        activeDays: JsonScore;
    }

    export interface JsonGroup extends JsonPublication {
        name: string;
        description: string;
        isrestricted: boolean;
        isclass: boolean;
        pictureid: string;
        comments: number;
        positivereviews: number;
        subscribers: number;
    }

    export interface JsonCode {
        kind: string; // “code”
        time: number; // creation time in seconds since 1970
        expiration: number; // in seconds since 1970
        userid: string; // creator
        username: string;
        userscore: number;
        userhaspicture: boolean;
        verb: string; // “JoinGroup” for group invitation codes
        data: string; // groupid for group invitation codes
        credit?: number;
    }

    export interface JsonScriptMeta {
        youtube?: string;
        instagram?: string;
        blocksWidth?: number;
        blocksHeight?: number;
    }

    export interface JsonScript extends JsonPublication {
        name: string;
        description: string;
        icon: string; // script icon name
        iconbackground: string; // script icon background color in HTML notation
        iconurl: string; // script icon picture url (obsolete)
        iconArtId?: string; // art id for script icon
        splashArtId?: string; // art id for script splash screen
        positivereviews: number; // number of users who added ♥ to this script
        cumulativepositivereviews: number;
        comments: number; // number of discussion threads
        subscribers: number;
        capabilities: JsonCapability[]; // array of capabilities used by this script; each capability has two fields: name, iconurl
        flows: any[]; // ???
        haserrors: boolean; // whether this script has any compilation errors
        rootid: string; // refers to the earliest script along the chain of script bases
        baseid?: string; // lite
        updateid: string; // refers to the latest published successor (along any path) of that script with the same name and from the same user
        updatetime: number;
        ishidden: boolean; // whether the user has indicated that this script should be hidden
        islibrary: boolean; // whether the user has indicated that this script is a reusable library
        useCppCompiler: boolean; // whether th euser has indicated that this script requires to use the C++ compiler
        installations: number; // an approximation of how many TouchDevelop users have currently installed this script
        runs: number; // an estimate of how often users have run this script
        platforms: string[];
        userplatform?: string[];
        screenshotthumburl: string;
        screenshoturl: string;
        mergeids: string[];
        editor?: string; // convention where empty means touchdevelop, for backwards compatibility
        target?: string;
        meta?: JsonScriptMeta; // only in lite, bag of metadata
        updateroot: string; // lite-only
        unmoderated?: boolean;
        noexternallinks?: boolean;
        promo?: any;
        lastpointer?: string;
    }

    export interface JsonHistoryItem {
        kind: string; // InstalledScriptHistory
        time: number; // seconds since 1970; indicates when code was backed up
        historyid: string; // identifier of this item
        scriptstatus: string; // “published”, “unpublished”
        scriptname: string; // script name, mined from the script code
        scriptdescription: string; // script description, mined from the script code
        scriptid: string; // publication id if scriptstatus==”published”
        scriptsize?: number;
        isactive: boolean; // whether this history item is the currently active backup
        meta: any;

        entryNo?: number; // assigned when the thing is displayed
    }

    export interface JsonPubOnPub extends JsonPublication {
        publicationid: string; // script id that is being commented on
        publicationname: string; // script name
        publicationkind: string; //
    }


    export interface JsonPointer extends JsonPublication {
        path: string; // "td/contents"
        scriptid: string; // where is it pointing to
        artid: string; // where is it pointing to
        releaseid: string;
        redirect: string; // full URL or /something/on/the/same/host
        description: string; // set to script title from the client        
        htmlartid: string;

        scriptname: string;
        scriptdescription: string;
        breadcrumbtitle: string;
        parentpath: string;
        oldscriptid?: string;
    }


    export interface JsonComment extends JsonPubOnPub {
        text: string; // comment text
        nestinglevel: number; // 0 or 1
        positivereviews: number; // number of users who added ♥ to this comment
        comments: number; // number of nested replies available for this comment
        assignedtoid?: string;
        resolved?: string;
    }

    export interface JsonAbuseReport extends JsonPubOnPub {
        text: string; // report text
        resolution: string;
        publicationuserid: string;

        // this are available to moderators only
        usernumreports?: number;
        publicationnumabuses?: number;
        publicationusernumabuses?: number;
    }

    export interface JsonChannel extends JsonPublication {
        name: string;
        description: string;
        pictureid: string;
        comments: number;
        positivereviews: number;
    }

    export interface JsonReview extends JsonPubOnPub {
        ispositive: boolean;
    }

    export interface JsonRelease extends JsonPublication {
        name: string;
        releaseid: string;
        labels: JsonReleaseLabel[];
        buildnumber: number;
        version: string;
        commit: string;
        branch: string;
        cdnUrl: string;
    }

    export interface JsonReleaseLabel {
        name: string;
        userid: string;
        time: number;
        releaseid: string;
    }

    export interface JsonEtag {
        id: string;
        kind: string;
        ETag: string;
    }

    export interface JsonList {
        items: JsonIdObject[];
        etags: JsonEtag[];
        continuation: string;
    }

    export interface JsonTag extends JsonIdObject {
        time: number;
        name: string;
        category: string;
        description: string;
        instances: number;
        topscreenshotids: string[];
    }

    export interface JsonScreenShot extends JsonPubOnPub {
        pictureurl: string; // screenshot picture url
        thumburl: string; // screenshot picture thumb url
    }

    export interface JsonVideoSource {
        // poster to display the video
        poster?: string;
        // locale of this video source
        srclang: string;
        // video url
        src: string;
        // video mime type
        type: string;
    }

    export interface JsonVideoTrack {
        // local of this track
        srclang: string;
        // url of the track
        src: string;
        // kind, by default subtitles
        kind?: string;
        // label shown to user
        label?: string;
    }

    // information to create a localized video with cc
    export interface JsonVideo {
        // poster to display the video
        poster: string;
        // closed caption tracks
        tracks?: JsonVideoTrack[];
        // localized video streams
        sources: JsonVideoSource[];
    }

    export interface CanDeleteResponse {
        publicationkind: string;
        publicationname: string;
        publicationuserid: string;
        candelete: boolean;
        candeletekind: boolean;
        canmanage: boolean;
        hasabusereports: boolean;
    }

    export interface UserSettings {
        nickname?: string;
        aboutme?: string;
        website?: string;
        notifications?: boolean;
        notifications2?: string;
        picturelinkedtofacebook?: boolean;
        realname?: string;
        gender?: string;
        howfound?: string;
        culture?: string;
        yearofbirth?: number;
        programmingknowledge?: string;
        occupation?: string;
        emailnewsletter2?: string;
        emailfrequency?: string;
        email?: string;
        emailverified?: boolean;
        previousemail?: string;
        location?: string;
        twitterhandle?: string;
        githubuser?: string;
        minecraftuser?: string;
        editorMode?: string;
        school?: string;
        wallpaper?: string;
        permissions?: string;
        credit?: number;
    }


}
