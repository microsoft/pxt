import { AuthClient } from "./auth";


export class MinecraftAuthClient extends AuthClient {
    protected pendingMessages: pxt.Map<(response: pxt.editor.CloudProxyResponse) => void> = {};
    protected preferences: pxt.auth.UserPreferences = {};

    private pendingAuthCheck: Promise<pxt.auth.ApiResult<pxt.auth.UserProfile>> = undefined;

    constructor() {
        super();

        window.addEventListener("message", ev => {
            const message = ev.data;

            if (message.action === "cloudproxy") {
                if (this.pendingMessages[message.id]) {
                    const response = message as pxt.editor.CloudProxyResponse;
                    this.pendingMessages[message.id](response);
                    delete this.pendingMessages[message.id];
                }
            }
        });
    }

    async apiAsync<T = any>(url: string, data?: any, method?: string, authToken?: string): Promise<pxt.auth.ApiResult<T>> {
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
        return new Promise<U>((resolve, reject) => {
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
        })
    }

    protected async listAsync(headerIds?: string[]): Promise<pxt.auth.ApiResult<pxt.editor.CloudProject[]>> {
        const resp = await this.postMessageAsync<pxt.editor.CloudProxyListResponse>({
            operation: "list",
            headerIds
        });

        return resp.resp;
    }

    protected async getAsync(headerId: string): Promise<pxt.auth.ApiResult<pxt.editor.CloudProject>> {
        const resp = await this.postMessageAsync<pxt.editor.CloudProxyGetResponse>({
            operation: "get",
            headerId
        });

        return resp.resp;
    }

    protected async setAsync(project: pxt.editor.CloudProject): Promise<pxt.auth.ApiResult<string>> {
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
}

