import {
    PROJASSETS_MESSAGE_TYPE,
    ProjassetsAsset,
    ProjassetsErrorCode,
    ProjassetsImage,
    ProjassetsKind,
    ProjassetsNotification,
    ProjassetsReply,
    ProjassetsRequest,
} from "../../pxtservices/projassets";

/**
 * Returns the image assets of `project` as simulator extensions see them: every
 * image in the project's own assets, named by the key of its entry in the
 * project's asset file. Images supplied by extensions are not included.
 */
export function getImageAssets(project: pxt.TilemapProject): ProjassetsImage[] {
    return project.getAssets(pxt.AssetType.Image).map(image => {
        const listed: ProjassetsImage = {
            kind: "image",
            // the key under which the project's asset file stores the image
            id: image.id.substr(image.id.lastIndexOf(".") + 1),
            width: image.bitmap.width,
            height: image.bitmap.height,
            data: image.jresData,
        };
        if (image.meta.displayName) listed.displayName = image.meta.displayName;
        return listed;
    });
}

// per asset kind the host lists: returns the project's assets of that kind
const listers: { [K in ProjassetsKind]: (project: pxt.TilemapProject) => ProjassetsAsset[] } = {
    image: getImageAssets,
};

class ProjassetsRequestError extends Error {
    constructor(public readonly code: ProjassetsErrorCode, message: string) {
        super(message);
    }
}

// PR NOTE [Issue 5] -- lift into the PR description, then remove.
// The asset provider of Issue 5 (generated-docs/pxt-issue-drafts): a
// read-only, typed view of the open project's named assets for simulator
// extensions, answered from the live TilemapProject, not from the asset
// files (images.g.jres), which are rebuilt only at build time. It rides the
// projfs plumbing: the driver attests the requesting frame's key and refuses
// frames whose registration lacks allowAssetRead before a request reaches
// this host. Change notifications ride the TilemapProject's project-wide
// change listener, deferred and merged: a burst of edits yields one
// notification, sent after the edits have applied.
/**
 * Serves the project-asset requests of simulator extensions: lists the named
 * assets of the open project by kind, and notifies subscribed extensions when
 * those assets change. Every request gets one reply. A request applies to the
 * project open when it arrives; a subscription ends when that project closes.
 *
 * The host listens to one project at a time, the one its subscriptions were
 * made in. Changes are merged: subscribers get one notification, sent from a
 * later task, for all the changes made before it is sent.
 */
export class ProjassetsHost {
    // per extension key: delivers change notifications to the extension's subscribed frame
    protected subscriptions: pxt.Map<(msg: ProjassetsNotification) => void> = {};
    // the project every subscription was made in, which the host listens to; undefined while there is none
    protected watched: pxt.TilemapProject | undefined;
    // true while a notification is scheduled
    protected notifyScheduled = false;

    /**
     * @param getProject returns the asset project of the open project, or undefined if none is open
     */
    constructor(protected readonly getProject: () => pxt.TilemapProject | undefined) {
    }

    /**
     * Answers a request from the simulator extension with the given key. A
     * subscribe request also makes `reply` the extension's channel for change
     * notifications, replacing any channel it had.
     * @param key the extension key the requesting frame was created for
     * @param msg the request, as received
     * @param reply delivers a reply or notification to the requesting frame
     */
    handleMessage(key: string, msg: unknown, reply: (msg: ProjassetsReply | ProjassetsNotification) => void): void {
        const request = msg as ProjassetsRequest;
        const id = typeof request?.id === "string" ? request.id : undefined;
        let answer: ProjassetsReply;
        try {
            answer = { ...this.apply(key, request, reply), type: PROJASSETS_MESSAGE_TYPE, id } as ProjassetsReply;
        } catch (e) {
            const code: ProjassetsErrorCode = e instanceof ProjassetsRequestError ? e.code : "FAILED";
            answer = { type: PROJASSETS_MESSAGE_TYPE, id, subtype: "error", code, message: e?.message || String(e) };
        }
        reply(answer);
    }

    protected apply(key: string, request: ProjassetsRequest, reply: (msg: ProjassetsNotification) => void): ProjassetsReplyBody {
        switch (request?.subtype) {
            case "list": {
                const kind: unknown = request.kind;
                if (typeof kind !== "string")
                    throw new ProjassetsRequestError("INVALID_REQUEST", "The kind must be a string.");
                const project = this.openProjectOrThrow();
                if (!Object.prototype.hasOwnProperty.call(listers, kind))
                    throw new ProjassetsRequestError("UNSUPPORTED_KIND", `The editor does not list ${kind} assets.`);
                return { subtype: "assets", kind: kind as ProjassetsKind, assets: listers[kind as ProjassetsKind](project) };
            }

            case "subscribe": {
                this.watch(this.openProjectOrThrow());
                this.subscriptions[key] = reply;
                return { subtype: "ack" };
            }

            default:
                throw new ProjassetsRequestError("INVALID_REQUEST", `Unknown request ${(request as any)?.subtype}.`);
        }
    }

    /**
     * Returns the open project.
     * @throws a `PROJECT_CLOSED` refusal if no project is open
     */
    protected openProjectOrThrow(): pxt.TilemapProject {
        const project = this.getProject();
        if (!project)
            throw new ProjassetsRequestError("PROJECT_CLOSED", "No project was open when the request arrived.");
        return project;
    }

    /** Listens to `project` for changes, ending the subscriptions made in any other project. */
    protected watch(project: pxt.TilemapProject) {
        if (this.watched === project) return;
        this.unwatch();
        project.addProjectChangeListener(this.onProjectChange);
        this.watched = project;
    }

    /** Stops listening for changes and ends every subscription. */
    protected unwatch() {
        this.watched?.removeProjectChangeListener(this.onProjectChange);
        this.watched = undefined;
        this.subscriptions = {};
    }

    protected onProjectChange = () => {
        if (this.notifyScheduled) return;
        this.notifyScheduled = true;
        setTimeout(() => this.notifySubscribers(), 0);
    }

    /** Notifies every subscriber, or ends the subscriptions if their project has closed. */
    protected notifySubscribers() {
        this.notifyScheduled = false;
        if (!this.watched) return;
        if (this.getProject() !== this.watched) {
            this.unwatch();
            return;
        }
        const notification: ProjassetsNotification = { type: PROJASSETS_MESSAGE_TYPE, subtype: "changed" };
        for (const key of Object.keys(this.subscriptions)) {
            this.subscriptions[key](notification);
        }
    }
}

/** A reply without the `type` and `id` fields every reply carries. */
type ProjassetsReplyBody<R = ProjassetsReply> = R extends ProjassetsReply ? Omit<R, "type" | "id"> : never;
