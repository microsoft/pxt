import { dispatchSetReadyResources } from "../actions/dispatch";
import store from "../store/store";

export class ReadyResources {
    public sendMessageAsync?: (message: any) => Promise<any>;
    public exportCloudProjectsToLocal(userId: string): Promise<void> {
        return this.sendMessageAsync!({
            type: "pxteditor",
            action: "convertcloudprojectstolocal",
            userId
        } as pxt.editor.EditorMessageConvertCloudProjectsToLocal);
    }
}

export class ReadyPromise {
    private promise_: Promise<ReadyResources>
    private resources: ReadyResources;
    private appMounted?: boolean;
    private resolve?: (value: ReadyResources | PromiseLike<ReadyResources>) => void;

    constructor() {
        this.resources = new ReadyResources();
        this.promise_ = new Promise<ReadyResources>((resolve) => {
            this.resolve = resolve;
            this.checkComplete();
        })
    }

    public promise = () => this.promise_;

    public setSendMessageAsync(sendMessageAsync: (message: any) => Promise<any>) {
        this.resources.sendMessageAsync = sendMessageAsync;
        this.checkComplete();
    }

    public setAppMounted() {
        this.appMounted = true;
        this.checkComplete();
    }

    private checkComplete() {
        if (this.resolve &&
            this.appMounted &&
            this.resources.sendMessageAsync
        ) {
            store.dispatch(dispatchSetReadyResources(this.resources));
            this.resolve(this.resources);
        }
    }
}
