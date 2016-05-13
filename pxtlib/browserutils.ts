namespace pxt.BrowserUtils {
    export function browserDownloadText(text: string, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        console.log('trigger download')
        let buf = Util.stringToUint8Array(Util.toUTF8(text))
        return browserDownloadUInt8Array(buf, name, contentType, onError);
    }

    function browserDownloadUInt8Array(buf: Uint8Array, name: string, contentType: string = "application/octet-stream", onError?: (err: any) => void): string {
        let isMobileBrowser = /mobile/.test(navigator.userAgent);
        let dataurl = "data:" + contentType + ";base64," + btoa(Util.uint8ArrayToString(buf))
        try {
            if ((<any>window).navigator.msSaveOrOpenBlob && !isMobileBrowser) {
                let b = new Blob([buf], { type: contentType })
                let result = (<any>window).navigator.msSaveOrOpenBlob(b, name);
            } else {
                let link = <any>window.document.createElement('a');
                if (typeof link.download == "string") {
                    link.href = dataurl;
                    link.download = name;
                    document.body.appendChild(link); // for FF
                    link.click();
                    document.body.removeChild(link);
                } else {
                    document.location.href = dataurl;
                }
            }
        } catch (e) {
            if (onError) onError(e);
            console.log("saving failed")
        }
        return dataurl;
    }

}