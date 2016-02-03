/// <reference path="../typings/bluebird/bluebird.d.ts"/>

namespace Util {
    export interface StringMap<T> {
        [index: string]: T;
    }
    export function assert(cond: boolean, msg = "Assertion failed") {
        if (!cond) {
            throw new Error(msg)
        }
    }

    export function oops(msg = "OOPS"): Error {
        throw new Error(msg)
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }

    export function iterStringMap<T>(m: StringMap<T>, f: (k: string, v: T) => void) {
        Object.keys(m).forEach(k => f(k, m[k]))
    }

    export function mapStringMap<T, S>(m: StringMap<T>, f: (k: string, v: T) => S) {
        let r: StringMap<S> = {}
        Object.keys(m).forEach(k => r[k] = f(k, m[k]))
        return r
    }

    export function mapStringMapAsync<T, S>(m: StringMap<T>, f: (k: string, v: T) => Promise<S>) {
        let r: StringMap<S> = {}
        return Promise.all(Object.keys(m).map(k => f(k, m[k]).then(v => r[k] = v)))
            .then(() => r)
    }

    export function values<T>(m: StringMap<T>) {
        return Object.keys(m || {}).map(k => m[k])
    }

    export function pushRange<T>(trg: T[], src: T[]) {
        for (let i = 0; i < src.length; ++i)
            trg.push(src[i])
    }

    export function concat<T>(arrays: T[][]): T[] {
        let r: T[] = []
        for (let i = 0; i < arrays.length; ++i) {
            pushRange(r, arrays[i])
        }
        return r
    }

    export function strcmp(a: string, b: string) {
        if (a == b) return 0;
        if (a < b) return -1;
        else return 1;
    }

    export function sortObjectFields<T>(o: T): T {
        let keys = Object.keys(o)
        keys.sort(strcmp)
        let r: any = {}
        keys.forEach(k => r[k] = (<any>o)[k])
        return r
    }

    export function memoizeString<T>(createNew: (id: string) => T): (id: string) => T {
        return memoize(s => s, createNew)
    }

    export function memoize<S, T>(getId: (v: S) => string, createNew: (v: S) => T): (id: S) => T {
        let cache: Util.StringMap<T> = {}
        return (v: S) => {
            let id = getId(v)
            if (cache.hasOwnProperty(id))
                return cache[id]
            return (cache[id] = createNew(v))
        }
    }

    export var isNodeJS = false;

    export interface HttpRequestOptions {
        url: string;
        method?: string; // default to GET
        data?: any;
        headers?: StringMap<string>;
        allowHttpErrors?: boolean; // don't treat non-200 responses as errors
    }

    export interface HttpResponse {
        statusCode: number;
        headers: StringMap<string>;
        buffer?: any;
        text?: string;
        json?: any;
    }

    export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
        return httpRequestCoreAsync(options)
            .then(resp => {
                if (resp.statusCode != 200 && !options.allowHttpErrors)
                    throw new Error("Bad HTTP status code: " + resp.statusCode + " at " + options.url)
                if (resp.text && /application\/json/.test(resp.headers["content-type"]))
                    resp.json = JSON.parse(resp.text)
                return resp
            })
    }

    export function httpGetJsonAsync(url: string) {
        return requestAsync({ url: url }).then(resp => resp.json)
    }

    export function httpPostJsonAsync(url: string, data: any) {
        return requestAsync({ url: url, data: data || {} }).then(resp => resp.json)
    }

    export function userError(msg: string): Error {
        let e = new Error(msg);
        (<any>e).isUserError = true;
        throw e
    }

    // this will take lower 8 bits from each character
    export function stringToUint8Array(input: string) {
        var len = input.length;
        var res = new Uint8Array(len)
        for (var i = 0; i < len; ++i)
            res[i] = input.charCodeAt(i) & 0xff;
        return res;
    }

    export function uint8ArrayToString(input: Uint8Array) {
        var len = input.length;
        var res = ""
        for (var i = 0; i < len; ++i)
            res += String.fromCharCode(input[i]);
        return res;
    }


    export function fromUTF8(binstr: string) {
        if (!binstr) return ""

        // escape function is deprecated
        var escaped = ""
        for (var i = 0; i < binstr.length; ++i) {
            var k = binstr.charCodeAt(i) & 0xff
            if (k == 37 || k > 0x7f) {
                escaped += "%" + k.toString(16);
            } else {
                escaped += binstr.charAt(i)
            }
        }

        // decodeURIComponent does the actual UTF8 decoding
        return decodeURIComponent(escaped)
    }

    export function toUTF8(str: string) {
        var res = "";
        if (!str) return res;
        for (var i = 0; i < str.length; ++i) {
            var code = str.charCodeAt(i);
            if (code <= 0x7f) res += str.charAt(i);
            else if (code <= 0x7ff) {
                res += String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                if (0xd800 <= code && code <= 0xdbff) {
                    var next = str.charCodeAt(++i);
                    if (!isNaN(next))
                        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                }

                if (code <= 0xffff)
                    res += String.fromCharCode(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                else
                    res += String.fromCharCode(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }

        }
        return res;
    }

    export function randomUint32() {
        let buf = new Uint8Array(4)
        getRandomBuf(buf)
        return new Uint32Array(buf.buffer)[0]
    }

    export function guidGen() {
        function f() { return (randomUint32() | 0x10000).toString(16).slice(-4); }
        return f() + f() + "-" + f() + "-4" + f().slice(-3) + "-" + f() + "-" + f() + f() + f();
    }

    export var httpRequestCoreAsync: (options: HttpRequestOptions) => Promise<HttpResponse>;
    export var sha256: (hashData: string) => string;
    export var getRandomBuf: (buf: Uint8Array) => void;
}

namespace BrowserImpl {
    Util.httpRequestCoreAsync = httpRequestCoreAsync;
    Util.sha256 = sha256string;
    Util.getRandomBuf = buf => window.crypto.getRandomValues(buf);

    function httpRequestCoreAsync(options: Util.HttpRequestOptions) {
        return new Promise<Util.HttpResponse>((resolve, reject) => {
            var client: XMLHttpRequest;
            var resolved = false

            let headers = Util.clone(options.headers) || {}

            client = new XMLHttpRequest();

            client.onreadystatechange = () => {
                if (resolved) return // Safari/iOS likes to call this thing more than once

                if (client.readyState == 4) {
                    resolved = true
                    let res: Util.HttpResponse = {
                        statusCode: client.status,
                        headers: {},
                        buffer: client.responseBody,
                        text: client.responseText,
                    }
                    client.getAllResponseHeaders().split('\r\n').forEach(l => {
                        let m = /^([^:]+): (.*)/.exec(l)
                        if (m) res.headers[m[1].toLowerCase()] = m[2]
                    })
                    resolve(res)
                }
            }

            let data = options.data
            let method = options.method || (data == null ? "GET" : "POST");

            let buf: any;

            if (data == null) {
                buf = null
            } else if (data instanceof Uint8Array) {
                buf = data
            } else if (typeof data == "object") {
                buf = JSON.stringify(data)
                headers["content-type"] = "application/json; charset=utf8"
            } else if (typeof data == "string") {
                buf = data
            } else {
                Util.oops("bad data")
            }

            client.open(method, options.url);

            Object.keys(headers).forEach(k => {
                client.setRequestHeader(k, headers[k])
            })

            if (data == null)
                client.send();
            else
                client.send(data);
        })
    }

    var sha256_k = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ])

    function rotr(v: number, b: number) {
        return (v >>> b) | (v << (32 - b));
    }

    function sha256round(hs: Uint32Array, w: Uint32Array) {
        Util.assert(hs.length == 8);
        Util.assert(w.length == 64);

        for (var i = 16; i < 64; ++i) {
            var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }

        var a = hs[0];
        var b = hs[1];
        var c = hs[2];
        var d = hs[3];
        var e = hs[4];
        var f = hs[5];
        var g = hs[6];
        var h = hs[7];

        for (var i = 0; i < 64; ++i) {
            var s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            var ch = (e & f) ^ (~e & g)
            var temp1 = (h + s1 + ch + sha256_k[i] + w[i]) | 0
            var s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            var maj = (a & b) ^ (a & c) ^ (b & c)
            var temp2 = (s0 + maj) | 0

            h = g
            g = f
            f = e
            e = (d + temp1) | 0
            d = c
            c = b
            b = a
            a = (temp1 + temp2) | 0
        }

        hs[0] += a
        hs[1] += b
        hs[2] += c
        hs[3] += d
        hs[4] += e
        hs[5] += f
        hs[6] += g
        hs[7] += h
    }

    export function sha256buffer(buf: Uint8Array) {
        var h = new Uint32Array(8);
        h[0] = 0x6a09e667
        h[1] = 0xbb67ae85
        h[2] = 0x3c6ef372
        h[3] = 0xa54ff53a
        h[4] = 0x510e527f
        h[5] = 0x9b05688c
        h[6] = 0x1f83d9ab
        h[7] = 0x5be0cd19

        var work = new Uint32Array(64);

        var chunkLen = 16 * 4;

        function addBuf(buf: Uint8Array) {
            var end = buf.length - (chunkLen - 1)
            for (var i = 0; i < end; i += chunkLen) {
                for (var j = 0; j < 16; j++) {
                    var off = (j << 2) + i
                    work[j] = (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]
                }
                sha256round(h, work)
            }
        }

        addBuf(buf)

        var padSize = 64 - (buf.length + 9) % 64
        if (padSize == 64) padSize = 0
        var endPos = buf.length - (buf.length % chunkLen)
        var padBuf = new Uint8Array((buf.length - endPos) + 1 + padSize + 8)
        var dst = 0
        while (endPos < buf.length) padBuf[dst++] = buf[endPos++]
        padBuf[dst++] = 0x80
        while (padSize-- > 0)
            padBuf[dst++] = 0x00
        var len = buf.length * 8
        dst = padBuf.length
        while (len > 0) {
            padBuf[--dst] = len & 0xff
            len >>= 8
        }

        addBuf(padBuf)

        var res = ""
        for (var i = 0; i < h.length; ++i)
            res += ("000000000" + h[i].toString(16)).slice(-8)

        return res.toLowerCase()
    }

    export function sha256string(s: string) {
        return sha256buffer(Util.stringToUint8Array(Util.toUTF8(s)))
    }
}

namespace Cloud {
    export var apiRoot = "https://mbit.touchdevelop.com/api/";
    export var accessToken = "";

    export function privateRequestAsync(options: Util.HttpRequestOptions) {
        options.url = apiRoot + options.url
        if (accessToken) {
            if (!options.headers) options.headers = {}
            options.headers["x-td-access-token"] = accessToken
        }
        return Util.requestAsync(options)
    }

    export function privateGetAsync(path: string) {
        return privateRequestAsync({ url: path }).then(resp => resp.json)
    }

    export function downloadScriptFilesAsync(id: string) {
        return privateRequestAsync({ url: id + "/text" }).then(resp => {
            return JSON.parse(resp.text)
        })
    }

    export function privateDeleteAsync(path: string) {
        return privateRequestAsync({ url: path, method: "DELETE" }).then(resp => resp.json)
    }

    export function privatePostAsync(path: string, data: any) {
        return privateRequestAsync({ url: path, data: data || {} }).then(resp => resp.json)
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
        time: number;// time when publication was created
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


}
