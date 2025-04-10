import { AuthClient, OFFLINE } from "./auth";
import * as data from "./data";

interface IPCRenderer {
    on(event: "responseFromApp", handler: (event: any, message: string) => void): void;
    sendToHost(messageType: "sendToApp", message: IPCMessage): void;
}

interface IPCHeader {
    requestId: string;
    messagePurpose: "cloud";
    version: 1;
}

interface IPCMessage {
    header: IPCHeader;
    body:
    | CloudProxyUserRequest
    | CloudProxyListRequest
    | CloudProxyGetRequest
    | CloudProxySetRequest
    | CloudProxyDeleteRequest;
}

interface IPCResponse {
    header: IPCHeader;
    body:
    | CloudProxyUserResponse
    | CloudProxyListResponse
    | CloudProxyGetResponse
    | CloudProxySetResponse
    | CloudProxyDeleteResponse;
}

/***************************
 *        Requests         *
 ***************************/

interface CloudProxyUserRequest {
    operation: "user";
}

interface CloudProxyListRequest {
    operation: "list";
    headerIds?: string[];
}

interface CloudProxyGetRequest {
    operation: "get";
    headerId: string;
}

interface CloudProxySetRequest {
    operation: "set";
    project: pxt.editor.CloudProject;
}

interface CloudProxyDeleteRequest {
    operation: "delete";
    headerId: string;
}

/***************************
 *        Responses        *
 ***************************/

interface CloudProxyUserResponse {
    operation: "user";
    status: number;
    resp: string; // a unique string identifying the user
}

interface CloudProxyListResponse {
    operation: "list";
    status: number;
    resp: pxt.editor.CloudProject[];
}

interface CloudProxyGetResponse {
    operation: "get";
    status: number;
    resp: pxt.editor.CloudProject;
}

interface CloudProxySetResponse {
    operation: "set";
    status: number;
    resp: string;
}

interface CloudProxyDeleteResponse {
    operation: "delete";
    status: number;
    resp: undefined;
}

interface DriveDBEntry {
    id: string;
    driveItemId: string;
}

const DRIVE_ID_DB_NAME = "__minecraft_userdriveid"
const DRIVE_ID_TABLE = "userdrive";
const DRIVE_ID_KEYPATH = "id";

export class MinecraftAuthClient extends AuthClient {
    protected pendingMessages: pxt.Map<(response: pxt.editor.CloudProxyResponse) => void> = {};
    protected preferences: pxt.auth.UserPreferences = {};
    protected ipc?: IPCRenderer;

    constructor() {
        super();
        this.init();
    }

    async apiAsync<T = any>(url: string, data?: any, method?: string, authToken?: string): Promise<pxt.auth.ApiResult<T>> {
        try {
            const result = await this.apiAsyncCore(url, data, method, authToken);

            const offline = result?.statusCode === 503;

            if (pxt.auth.cachedAuthOffline !== offline) {
                pxt.auth.cachedAuthOffline = offline;
                data.invalidate(OFFLINE);
            }

            return result;
        }
        catch (e) {
            return {
                success: false,
                statusCode: 500,
                resp: undefined,
                err: e
            };
        }
    }

    protected async apiAsyncCore<T = any>(url: string, data?: any, method?: string, authToken?: string): Promise<pxt.auth.ApiResult<T>> {
        const match = /((?:\/[^\?\/]+)*)(\?.*)?/.exec(url);

        if (!match) {
            throw new Error("Bad API format");
        }

        const path = match[1];
        const query = match[2];

        if (!method) {
            if (data) {
                method = "POST";
            }
            else {
                method = "GET";
            }
        }

        if (path === "/api/user") {
            if (method === "DELETE") {
                return (
                    {
                        success: true,
                        statusCode: 200,
                        resp: undefined,
                        err: undefined
                    }
                );
            }
        }
        else if (path === "/api/user/profile") {
            return this.userAsync() as Promise<pxt.auth.ApiResult<T>>;
        }
        else if (path === "/api/user/preferences") {
            if (method === "POST") {
                this.preferences = {
                    ...this.preferences,
                    ...data
                };
            }
            return (
                {
                    success: true,
                    statusCode: 200,
                    resp: {...this.preferences} as T,
                    err: undefined
                }
            );
        }
        else if (path === "/api/auth/login") {
            return (
                {
                    success: false,
                    statusCode: 500,
                    resp: undefined,
                    err: "Not supported"
                }
            );
        }
        else if (path === "/api/auth/logout") {
            return (
                {
                    success: true,
                    statusCode: 200,
                    resp: {} as T,
                    err: undefined
                }
            );
        }
        else if (path === "/api/user/project") {
            if (method === "GET") {
                // LIST
                let headerIds: string[];

                if (query) {
                    const parsed = new URLSearchParams(query);
                    const list = parsed.get("projectIds");
                    if (list) {
                        headerIds = list.split(",");
                    }
                }

                return this.listAsync(headerIds) as Promise<pxt.auth.ApiResult<T>>;
            }
            else {
                // SET
                return this.setAsync(data) as Promise<pxt.auth.ApiResult<T>>;
            }
        }
        else if (path === "/api/user/project/share") {
            // TODO
        }
        else if (path.startsWith("/api/user/project/")) {
            const headerId = path.substring(18);

            if (method === "GET") {
                return this.getAsync(headerId) as Promise<pxt.auth.ApiResult<T>>;
            }
        }

        return (
            {
                success: false,
                statusCode: 500,
                resp: undefined,
                err: "Not supported"
            }
        );
    }

    protected postMessageAsync<U extends pxt.editor.CloudProxyResponse>(message: Partial<pxt.editor.CloudProxyRequest>): Promise<U> {
        if (this.ipc) {
            return this.postMessageToIPC(message);
        }
        else {
            return this.postMessageToParentFrame(message);
        }
    }

    protected postMessageToIPC<U extends pxt.editor.CloudProxyResponse>(message: Partial<pxt.editor.CloudProxyRequest>): Promise<U> {
        return new Promise<U>((resolve, reject) => {
            const requestId = "cloudproxy-" + crypto.randomUUID();
            const toSend: IPCMessage = {
                header: {
                    requestId: requestId,
                    messagePurpose: "cloud",
                    version: 1
                },
                body: message as pxt.editor.CloudProxyRequest
            }

            this.pendingMessages[requestId] = resolve as any;

            this.ipc.sendToHost("sendToApp", toSend);
        })
    }

    protected postMessageToParentFrame<U extends pxt.editor.CloudProxyResponse>(message: Partial<pxt.editor.CloudProxyRequest>): Promise<U> {
        return new Promise<U>((resolve, reject) => {
            if (window.parent === window) {
                reject("No IPC renderer and not embeded in iframe");
                return;
            }
            const toPost = {
                ...message,
                type: "pxthost",
                action: "cloudproxy",
                reponse: true,
                id: "cloudproxy-" + crypto.randomUUID()
            };

            this.pendingMessages[toPost.id] = resolve as any;

            // TODO: send over ipc channel
            window.parent.postMessage(toPost, "*");
        });
    }

    protected init() {
        this.ipc = (window as any).ipcRenderer;

        if (!this.ipc) {
            pxt.warn("No ipcRenderer detected. Using iframe cloud proxy instead");
            this.initIFrame();
            return;
        }

        this.ipc.on("responseFromApp", (_, message) => {
            const parsed = pxt.U.jsonTryParse(message) as IPCResponse;

            if (!parsed) return;

            if (parsed.header.messagePurpose !== "cloud") return;

            let resp = parsed.body.resp as any;
            if (parsed.body.operation === "user") {
                resp = { id: parsed.body.resp }
            }

            const response: pxt.editor.CloudProxyResponse = {
                type: "pxteditor",
                action: "cloudproxy",
                id: parsed.header.requestId,
                operation: parsed.body.operation,
                success: parsed.body.status === 200,
                resp: {
                    statusCode: parsed.body.status,
                    success: parsed.body.status === 200,
                    resp: resp,
                    err: undefined
                }
            };

            this.handleResponse(response);
        });
    }

    protected initIFrame() {
        window.addEventListener("message", ev => {
            const message = ev.data;

            if (message.action === "cloudproxy") {
                this.handleResponse(message);
            }
        });
    }

    protected handleResponse(response: pxt.editor.CloudProxyResponse) {
        if (this.pendingMessages[response.id]) {
            this.pendingMessages[response.id](response);
            delete this.pendingMessages[response.id];
        }
    }

    protected async listAsync(headerIds?: string[]): Promise<pxt.auth.ApiResult<pxt.editor.CloudProject[]>> {
        const resp = await this.postMessageAsync<pxt.editor.CloudProxyListResponse>({
            operation: "list",
            headerIds
        });

        if (resp.resp.success) {
            for (const project of resp.resp.resp) {
                await this.updateProjectDriveId(project);
            }
        }

        return resp.resp;
    }

    protected async getAsync(headerId: string): Promise<pxt.auth.ApiResult<pxt.editor.CloudProject>> {
        const resp = await this.postMessageAsync<pxt.editor.CloudProxyGetResponse>({
            operation: "get",
            headerId
        });

        if (resp.resp.success) {
            await this.updateProjectDriveId(resp.resp.resp);
        }

        return resp.resp;
    }

    protected async setAsync(project: pxt.editor.CloudProject): Promise<pxt.auth.ApiResult<string>> {
        const id = await this.lookupProjectDriveId(project.id);
        project.driveItemId = id;

        const resp = await this.postMessageAsync<pxt.editor.CloudProxySetResponse>({
            operation: "set",
            project
        });

        return resp.resp;
    }

    protected async userAsync(): Promise<pxt.auth.ApiResult<pxt.auth.UserProfile>> {
        const resp = await this.postMessageAsync<pxt.editor.CloudProxyUserResponse>({
            operation: "user",
        });

        return resp.resp;
    }

    protected async updateProjectDriveId(project: pxt.editor.CloudProject) {
        if (!project.driveItemId) return;

        const db = getUserDriveDb();
        await db.openAsync();

        await db.setAsync(DRIVE_ID_TABLE, {
            id: project.id,
            driveItemId: project.driveItemId
        } as DriveDBEntry);
    }

    protected async lookupProjectDriveId(headerId: string) {
        const db = getUserDriveDb();
        await db.openAsync();

        const entry = await db.getAsync<DriveDBEntry>(DRIVE_ID_TABLE, headerId);
        return entry?.driveItemId;
    }
}

function getUserDriveDb() {
    const db = new pxt.BrowserUtils.IDBWrapper(DRIVE_ID_DB_NAME, 1, (ev, r) => {
        const db = r.result as IDBDatabase;
        db.createObjectStore(DRIVE_ID_TABLE, { keyPath: DRIVE_ID_KEYPATH });
    });

    return db;
}