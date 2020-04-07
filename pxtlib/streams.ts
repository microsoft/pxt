// See https://github.com/microsoft/TouchDevelop-backend/blob/master/docs/streams.md
namespace pxt.streams {
    export interface JsonStreamField {
        name: string;
        sum: number;
        min: number;
        max: number;
        count: number;
    }
    export interface JsonStreamMeta {
        fields: JsonStreamField[];
        size: number;
        rows: number;
        batches: number;
    }

    export interface JsonStream {
        kind: string;
        id: string;
        time: number;
        name?: string;
        meta: JsonStreamMeta;
        privatekey?: string;
    }

    export interface JsonStreamPayload {
        fields: string[];
        values: number[][];
    }

    export interface JsonStreamPayloadResponse {
        meta: JsonStreamMeta;
        quotaUsedHere: number;
        quotaLeft: number;
    }
    export interface JsonStreamData {
        fields: JsonStreamField[];
        values: number[][];
        continuation?: string;
        continuationUrl?: string;
    }

    export function createStreamAsync(target: string, name?: string): Promise<JsonStream> {
        return Cloud.privatePostAsync("streams", { target: target, name: name || 'data' }).then(j => <JsonStream>j);
    }

    export function postPayloadAsync(stream: JsonStream, data: JsonStreamPayload): Promise<void> {
        Util.assert(!!stream.privatekey);
        return Cloud.privatePostAsync(`${stream.id}/data?privatekey=${stream.privatekey}`, data);
    }
}