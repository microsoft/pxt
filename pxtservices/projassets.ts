/**
 * The project-asset ("projassets") messages a simulator extension exchanges
 * with the editor, and a client that wraps them in promises.
 *
 * A simulator extension registered with `allowAssetRead` can list the named
 * assets of the project open in the editor, with the project's name and its
 * visual configuration (its palette and simulator theme), and subscribe to
 * hear when any of them changes. The editor answers from the project as it
 * is when the request arrives, including edits not yet built into the
 * project's files. Assets, name and configuration are read-only through
 * this API.
 *
 * Requests are posted to the editor window; the editor replies to each request
 * once, to the requesting frame only, with the request's `id`. Change
 * notifications carry no `id` and go to the frames that subscribed.
 *
 * This module has no dependencies; a simulator extension can import or copy it
 * as-is.
 */

export const PROJASSETS_MESSAGE_TYPE = "projassets";

/** A kind of asset the editor lists. */
export type ProjassetsKind = "image";

/**
 * Why a request failed. Clients branch on the code; the message that
 * accompanies it is for people.
 */
export type ProjassetsErrorCode =
    /** The editor does not list assets of the requested kind. */
    | "UNSUPPORTED_KIND"
    /** The request is malformed. */
    | "INVALID_REQUEST"
    /**
     * No project was open when the request arrived, or the project open then
     * failed to load or was replaced before it loaded; a later request may
     * succeed.
     */
    | "PROJECT_CLOSED"
    /**
     * The requesting frame is not a simulator extension the editor serves,
     * for instance because the open project does not use the extension.
     */
    | "UNREGISTERED"
    /** The simulator extension's registration does not set `allowAssetRead`. */
    | "PERMISSION_DENIED"
    /** The editor met an error answering the request. */
    | "FAILED"
    /**
     * The client was disposed, as when its frame is torn down, before the
     * editor replied (raised by the client).
     */
    | "DISPOSED";

interface ProjassetsMessage {
    type: "projassets";
    /** Chosen by the requester; the reply carries the same `id`. */
    id: string;
}

/** Lists the project's named assets of one kind. The reply is a {@link ProjassetsAssetsReply}. */
export interface ProjassetsListRequest extends ProjassetsMessage {
    subtype: "list";
    kind: ProjassetsKind;
}

/**
 * Subscribes the requesting extension to {@link ProjassetsNotification}s. The
 * reply is a {@link ProjassetsAckReply}. An extension holds one subscription:
 * subscribing again replaces it. A subscription ends when the project open
 * when it was made closes.
 */
export interface ProjassetsSubscribeRequest extends ProjassetsMessage {
    subtype: "subscribe";
}

export type ProjassetsRequest = ProjassetsListRequest | ProjassetsSubscribeRequest;

/** An image asset of the project. */
export interface ProjassetsImage {
    kind: "image";
    /**
     * The key of the image's entry in the project's asset file
     * (`images.g.jres`), e.g. `image1`. It identifies the image among the
     * project's images and stays the same when the image is renamed.
     */
    id: string;
    /** The name the user gave the image; absent if it has none. */
    displayName?: string;
    /** Width in pixels. */
    width: number;
    /** Height in pixels. */
    height: number;
    /**
     * The pixels in pxt's image encoding (MIME type `image/x-mkcd-f4`),
     * base64-encoded, as the project's asset file stores them.
     */
    data: string;
}

/** An asset of the project; `kind` tells which. */
export type ProjassetsAsset = ProjassetsImage;

/**
 * The project's visual configuration: how the editor draws the project's
 * images and shows its simulator.
 */
export interface ProjassetsVisualConfig {
    /**
     * The project's palette, as the editor draws the project's images: the
     * project's own palette if its pxt.json sets one, else the target's. Each
     * entry is a color as `#rrggbb`; a pixel value is an index into it. Any
     * length, including empty for a target without a palette.
     */
    palette: string[];
    /**
     * The simulator theme the project shows, as the editor resolves it: the
     * project's own theme if its pxt.json declares one, resolved over the
     * user's, else the user's. Maps each token (e.g. `background-color`) to
     * its value, a color as `#rrggbb`, and `layout` to the simulator layout's
     * id. Absent if the target offers no simulator themes.
     */
    theme?: { [token: string]: string };
}

/**
 * The project's configuration the editor lists beside its assets: its name
 * and its visual configuration.
 */
export interface ProjassetsProjectConfig extends ProjassetsVisualConfig {
    /** The project's name, as the user gave it and as its pxt.json holds it. */
    name: string;
}

export interface ProjassetsAssetsReply extends ProjassetsMessage, ProjassetsProjectConfig {
    subtype: "assets";
    /** The kind the request asked for. */
    kind: ProjassetsKind;
    /**
     * Every named asset of that kind in the project, including any the editor
     * created itself, in no guaranteed order.
     */
    assets: ProjassetsAsset[];
}

/** What {@link ProjassetsClient.list} resolves with: the listed assets, the project's name, and its visual configuration. */
export interface ProjassetsListing extends ProjassetsProjectConfig {
    /** Every named asset of the listed kind in the project, in no guaranteed order. */
    assets: ProjassetsAsset[];
}

export interface ProjassetsAckReply extends ProjassetsMessage {
    subtype: "ack";
}

export interface ProjassetsErrorReply extends ProjassetsMessage {
    subtype: "error";
    code: ProjassetsErrorCode;
    message: string;
}

export type ProjassetsReply = ProjassetsAssetsReply | ProjassetsAckReply | ProjassetsErrorReply;

/**
 * Tells a subscribed extension that the project's assets, its name, or its
 * visual configuration may have changed. Several changes in quick succession
 * lead to one notification; list the assets again to see them.
 */
export interface ProjassetsNotification {
    type: "projassets";
    subtype: "changed";
}

/** A refused or unanswered request. */
export class ProjassetsError extends Error {
    constructor(public readonly code: ProjassetsErrorCode, message: string) {
        super(message);
        this.name = "ProjassetsError";
        // keeps instanceof working when compiled to ES5
        Object.setPrototypeOf(this, ProjassetsError.prototype);
    }
}

/** The window a {@link ProjassetsClient} posts requests to. */
export interface ProjassetsTargetWindow {
    postMessage(message: any, targetOrigin: string): void;
}

/** The window a {@link ProjassetsClient} receives replies and notifications on. */
export interface ProjassetsListenerWindow {
    addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
    removeEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}

export interface ProjassetsClientOptions {
    /** The editor window; defaults to `window.parent`. Messages from any other window are ignored. */
    target?: ProjassetsTargetWindow;
    /** The window replies and notifications arrive on; defaults to `window`. */
    listener?: ProjassetsListenerWindow;
    /** The origin requests may be delivered to; defaults to `"*"`. */
    targetOrigin?: string;
    /** How long a request waits for its reply before {@link onSlowReply} hears of it; defaults to 10 seconds. */
    slowReplyMs?: number;
    /**
     * Called once for each request still waiting for its reply after
     * {@link slowReplyMs}. The request keeps waiting, and a reply that comes
     * later settles it as usual.
     */
    onSlowReply?: (request: ProjassetsRequest) => void;
}

interface PendingRequest {
    resolve: (reply: ProjassetsReply) => void;
    reject: (error: ProjassetsError) => void;
    // fires the slow-reply notice; undefined when no one listens for it
    timer: ReturnType<typeof setTimeout> | undefined;
}

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

const DEFAULT_SLOW_REPLY_MS = 10000;

/**
 * Lists the open project's assets, name and visual configuration from a
 * simulator extension and hears when they change. Each method resolves with
 * the editor's reply, or rejects with a {@link ProjassetsError} carrying the
 * editor's error code.
 *
 * A request waits for its reply however long that takes; a reply slower than
 * {@link ProjassetsClientOptions.slowReplyMs} is reported to
 * {@link ProjassetsClientOptions.onSlowReply} and never fails the request.
 * Only {@link dispose} ends the wait, failing the request with `DISPOSED`.
 */
export class ProjassetsClient {
    protected readonly target: ProjassetsTargetWindow;
    protected readonly listener: ProjassetsListenerWindow;
    protected readonly targetOrigin: string;
    protected readonly slowReplyMs: number;
    protected readonly onSlowReply: ((request: ProjassetsRequest) => void) | undefined;
    protected readonly idPrefix = Math.random().toString(36).slice(2);
    protected nextId = 0;
    protected pending: { [id: string]: PendingRequest } = {};
    // called on each change notification once a subscription is acknowledged
    protected changeListeners: (() => void)[] = [];

    constructor(options: ProjassetsClientOptions = {}) {
        this.target = options.target || window.parent;
        this.listener = options.listener || window;
        this.targetOrigin = options.targetOrigin || "*";
        this.slowReplyMs = options.slowReplyMs || DEFAULT_SLOW_REPLY_MS;
        this.onSlowReply = options.onSlowReply;
        this.listener.addEventListener("message", this.onMessage);
    }

    /**
     * Lists the project's named assets of one kind, with the project's name
     * and visual configuration.
     * @param kind the kind of asset to list
     */
    async list(kind: ProjassetsKind): Promise<ProjassetsListing> {
        const reply = await this.requestAsync({ subtype: "list", kind }, "assets") as ProjassetsAssetsReply;
        const listing: ProjassetsListing = { assets: reply.assets, name: reply.name, palette: reply.palette };
        if (reply.theme) listing.theme = reply.theme;
        return listing;
    }

    /**
     * Subscribes this extension to change notifications, and calls `onChange`
     * on each one once the editor has acknowledged the subscription. List the
     * assets again from `onChange` to see the change.
     * @param onChange called when the project's assets, name, or visual configuration may have changed
     */
    async subscribe(onChange: () => void): Promise<void> {
        await this.requestAsync({ subtype: "subscribe" }, "ack");
        this.changeListeners.push(onChange);
    }

    /**
     * Stops listening for replies and notifications, and fails every pending
     * request with `DISPOSED`.
     */
    dispose() {
        this.listener.removeEventListener("message", this.onMessage);
        this.changeListeners = [];
        for (const id of Object.keys(this.pending)) {
            this.settle(id)?.reject(new ProjassetsError("DISPOSED", "The client was disposed before the editor replied."));
        }
    }

    protected requestAsync(body: DistributiveOmit<ProjassetsRequest, "type" | "id">, expected: ProjassetsReply["subtype"]): Promise<ProjassetsReply> {
        const id = `${this.idPrefix}-${this.nextId++}`;
        const request = { ...body, type: PROJASSETS_MESSAGE_TYPE, id } as ProjassetsRequest;
        return new Promise<ProjassetsReply>((resolve, reject) => {
            const onSlowReply = this.onSlowReply;
            const timer = onSlowReply && setTimeout(() => onSlowReply(request), this.slowReplyMs);
            this.pending[id] = { resolve, reject, timer };
            this.target.postMessage(request, this.targetOrigin);
        }).then(reply => {
            if (reply.subtype === "error") throw new ProjassetsError(reply.code, reply.message);
            if (reply.subtype !== expected) throw new ProjassetsError("FAILED", `Unexpected ${reply.subtype} reply to a ${body.subtype} request.`);
            return reply;
        });
    }

    protected onMessage = (ev: MessageEvent) => {
        if (ev.source !== this.target) return;
        const message = ev.data as ProjassetsReply | ProjassetsNotification;
        if (message?.type !== PROJASSETS_MESSAGE_TYPE) return;
        if (message.subtype === "changed") {
            this.changeListeners.forEach(listener => listener());
            return;
        }
        if (typeof message.id !== "string") return;
        this.settle(message.id)?.resolve(message);
    }

    protected settle(id: string): PendingRequest | undefined {
        const request = this.pending[id];
        if (!request) return undefined;
        delete this.pending[id];
        clearTimeout(request.timer);
        return request;
    }
}
