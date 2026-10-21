/// <reference path="./host.ts" />
// Browser implementation of the pxsim.host environment.
namespace pxsim.host {
    setEnvironment({
        postToParent: data => {
            // TODO: origins
            if (typeof window !== 'undefined' && window.parent && window.parent.postMessage) {
                window.parent.postMessage(data, "*");
            }
        },
        locationHref: () => typeof window !== "undefined" ? window.location.href : undefined,
        isPxtElectron: () => typeof window != "undefined" && !!(window as any).pxtElectron,
        isIpcRenderer: () => typeof window != "undefined" && !!(window as any).ipcRenderer,
        frameId: () => Embed.frameid
    });
}
