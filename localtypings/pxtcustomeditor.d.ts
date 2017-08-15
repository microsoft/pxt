declare namespace pxt.extension {
    interface Message {
        id?: string;
        type: "request" | "response" | "event";
    }

    interface Request extends Message {
        type: "request";
        subtype: string;
        
        seq: number;
        body?: any;
    }

    interface Response extends Message {
        type: "response";
        subtype: string;

        requestSeq: number;
        success: boolean;
        message?: string;
        body?: any;
    }

    interface Event extends Message {
        type: "event";
        event: string;
        body?:  any;
    }

    interface DataStreams<T> {
        serial?: T;
    }

    interface Permissions<T> {
        serial?: T;
        readUserCode?: T;
    }

    interface ExtensionFiles {
        code?: string;
        json?: string;
    }

    enum PermissionResponses {
        Granted,
        Denied,
        NotAvailable
    }

    /**
     * Event fired when the extension becomes visible.
     */
    interface ShownEvent extends Event {
        event: "shown";
    }

    /**
     * Event fired when the extension becomes hidden.
     */
    interface HiddenEvent extends Event {
        event: "hidden";
        body: HiddenReason;
    }

    export type HiddenReason = "useraction" | "other";

    /**
     * Event fired when serial data is received
     */
    interface SerialEvent extends Event {
        event: "serial";
        body: string;
    }

    /**
     * Event fired when extension is first shown. Extension
     * should send init request in response
     */
    export type InitializeType = "init";

    interface InitializeEvent extends Event {
        event: InitializeType;
    }

    interface InitializeRequest extends Request {
        subtype: InitializeType;
    }

    interface InitializeResponse extends Response {
        subtype: InitializeType;
    }

    /**
     * Requests data stream event to be fired. Permission will
     * be requested if not already received.
     */
    export type DataStreamType = "datastream";

    interface DataStreamRequest extends Request {
        subtype: DataStreamType;
        body: DataStreams<boolean>;
    }

    interface DataStreamResponse extends Response {
        subtype: DataStreamType;
        body: DataStreams<PermissionResponses>;
    }

    /**
     * Queries the current permissions granted to the extension.
     */
    export type QueryPermissionType = "querypermission";

    interface QueryPermissionRequest extends Request {
        subtype: QueryPermissionType;
    }

    interface QueryPermissionResponse extends Response {
        subtype: QueryPermissionType;
        body: Permissions<PermissionResponses>;
    }

    /**
     * Prompts the user for the specified permission
     */
    export type RequestPermissionType = "requestpermission";

    interface PermissionRequest extends Request {
        subtype: RequestPermissionType;
        body: Permissions<boolean>;
    }

    interface PermissionResponse extends Response {
        subtype: RequestPermissionType;
        body: Permissions<PermissionResponses>;
    }

    /**
     * Request to read the user's code. Will request permission if
     * not already granted
     */
    export type UserCodeType = "usercode";

    interface UserCodeRequest extends Request {
        subtype: UserCodeType;
    }

    interface UserCodeResponse extends Response {
        subtype: UserCodeType;

        /* A mapping of file names to their contents */
        body?: { [index: string]: string };
    }

    /**
     * Request to read the files saved by this extension
     */
    export type ReadCodeType = "readcode";

    interface ReadCodeRequest extends Request {
        subtype: ReadCodeType;
    }

    interface ReadCodeResponse extends Response {
        subtype: ReadCodeType;

        body?: ExtensionFiles;
    }

    /**
     * Request to write the JSON and/or TS files saved
     * by this extension
     */
    export type WriteCodeType = "writecode";

    interface WriteCodeRequest extends Request {
        subtype: WriteCodeType;

        body?: ExtensionFiles;
    }

    interface WriteCodeResponse extends Response {
        subtype: WriteCodeType;
    }
}