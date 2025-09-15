/// <reference path="../localtypings/pxteditor.d.ts" />

import { runValidatorPlan } from "./code-validation/runValidatorPlan";
import IProjectView = pxt.editor.IProjectView;

import { IFrameEmbeddedClient } from "../pxtservices/iframeEmbeddedClient";
import { saveProjectAsync } from "./projectImport";

const pendingRequests: pxt.Map<{
    resolve: (res?: pxt.editor.EditorMessageResponse | PromiseLike<pxt.editor.EditorMessageResponse>) => void;
    reject: (err: any) => void;
}> = {};

let iframeClient: IFrameEmbeddedClient;

/**
 * Binds incoming window messages to the project view.
 * Requires the "allowParentController" flag in the pxtarget.json/appTheme object.
 *
 * When the project view receives a request (EditorMessageRequest),
 * it starts the command and returns the result upon completion.
 * The response (EditorMessageResponse) contains the request id and result.
 * Some commands may be async, use the ``id`` field to correlate to the original request.
 */
export function bindEditorMessages(getEditorAsync: () => Promise<IProjectView>) {
    const allowEditorMessages = pxt.appTarget.appTheme.allowParentController || pxt.shell.isControllerMode();
    const allowExtensionMessages = pxt.appTarget.appTheme.allowPackageExtensions;
    const allowSimTelemetry = pxt.appTarget.appTheme.allowSimulatorTelemetry;

    if (!allowEditorMessages && !allowExtensionMessages && !allowSimTelemetry) return;

    const handleMessage = (msg: MessageEvent) => {
        const data = msg.data as pxt.editor.EditorMessage;
        if (!data || !/^pxt(host|editor|pkgext|sim)$/.test(data.type)) return false;

        if (data.type === "pxtpkgext" && allowExtensionMessages) {
            // Messages sent to the editor iframe from a child iframe containing an extension
            getEditorAsync().then(projectView => {
                projectView.handleExtensionRequest(data as pxt.editor.ExtensionRequest);
            })
        }
        else if (data.type === "pxtsim" && allowSimTelemetry) {
            const event = data as pxt.editor.EditorMessageEventRequest;
            if (event.action === "event") {
                if (event.category || event.message) {
                    pxt.reportError(event.category, event.message, event.data as pxt.Map<string>)
                }
                else {
                    pxt.tickEvent(event.tick, event.data);
                }
            }
        }
        else if (allowEditorMessages) {
            // Messages sent to the editor from the parent frame
            let p = Promise.resolve();
            let resp: any = undefined;
            if (data.type == "pxthost") { // response from the host
                const req = pendingRequests[data.id];
                if (!req) {
                    pxt.debug(`pxthost: unknown request ${data.id}`);
                } else {
                    p = p.then(() => req.resolve(data as pxt.editor.EditorMessageResponse));
                }
            } else if (data.type == "pxteditor") { // request from the editor
                p = p.then(() => {
                    return getEditorAsync().then(projectView => {
                        const req = data as pxt.editor.EditorMessageRequest;
                        pxt.debug(`pxteditor: ${req.action}`);
                        switch (req.action.toLowerCase() as pxt.editor.EditorMessageRequest["action"]) {
                            case "switchjavascript": return Promise.resolve().then(() => projectView.openJavaScript());
                            case "switchpython": return Promise.resolve().then(() => projectView.openPython());
                            case "switchblocks": return Promise.resolve().then(() => projectView.openBlocks());
                            case "startsimulator": return Promise.resolve().then(() => projectView.startSimulator());
                            case "restartsimulator": return Promise.resolve().then(() => projectView.restartSimulator());
                            case "hidesimulator": return Promise.resolve().then(() => projectView.collapseSimulator());
                            case "showsimulator": return Promise.resolve().then(() => projectView.expandSimulator());
                            case "closeflyout": return Promise.resolve().then(() => projectView.closeFlyout());
                            case "unloadproject": return Promise.resolve().then(() => projectView.unloadProjectAsync());
                            case "saveproject": return projectView.saveProjectAsync();
                            case "compile": return projectView.compile();
                            case "redo": return Promise.resolve()
                                .then(() => {
                                    const editor = projectView.editor;
                                    if (editor && editor.hasRedo())
                                        editor.redo();
                                });
                            case "undo": return Promise.resolve()
                                .then(() => {
                                    const editor = projectView.editor;
                                    if (editor && editor.hasUndo())
                                        editor.undo();
                                });
                            case "setscale": {
                                const zoommsg = data as pxt.editor.EditorMessageSetScaleRequest;
                                return Promise.resolve()
                                    .then(() => projectView.editor.setScale(zoommsg.scale));
                            }
                            case "stopsimulator": {
                                const stop = data as pxt.editor.EditorMessageStopRequest;
                                return Promise.resolve()
                                    .then(() => projectView.stopSimulator(stop.unload));
                            }
                            case "newproject": {
                                const create = data as pxt.editor.EditorMessageNewProjectRequest;
                                return Promise.resolve()
                                    .then(() => projectView.newProject(create.options));
                            }
                            case "importproject": {
                                const load = data as pxt.editor.EditorMessageImportProjectRequest;
                                return Promise.resolve()
                                    .then(() => projectView.importProjectAsync(load.project, {
                                        filters: load.filters,
                                        searchBar: load.searchBar
                                    }));
                            }
                            case "importexternalproject": {
                                const importExternal = data as pxt.editor.EditorMessageImportExternalProjectRequest
                                return saveProjectAsync(importExternal.project)
                                    .then(importId => {
                                        const importUrl = location.origin + location.pathname + `#embedimport:${importId}`;
                                        resp = {
                                            importUrl
                                        } as Partial<pxt.editor.EditorMessageImportExternalProjectResponse>
                                    });
                            }
                            case "openheader": {
                                const open = data as pxt.editor.EditorMessageOpenHeaderRequest;
                                return projectView.openProjectByHeaderIdAsync(open.headerId)
                            }
                            case "startactivity": {
                                const msg = data as pxt.editor.EditorMessageStartActivity;
                                let tutorialPath = msg.path;
                                let editorProjectName: string = undefined;
                                if (/^([jt]s|py|blocks?):/i.test(tutorialPath)) {
                                    if (/^py:/i.test(tutorialPath))
                                        editorProjectName = pxt.PYTHON_PROJECT_NAME;
                                    else if (/^[jt]s:/i.test(tutorialPath))
                                        editorProjectName = pxt.JAVASCRIPT_PROJECT_NAME;
                                    else
                                        editorProjectName = pxt.BLOCKS_PROJECT_NAME;
                                    tutorialPath = tutorialPath.substr(tutorialPath.indexOf(':') + 1)
                                }
                                return Promise.resolve()
                                    .then(() => projectView.startActivity({
                                        activity: msg.activityType,
                                        path: tutorialPath,
                                        title: msg.title,
                                        editor: editorProjectName,
                                        previousProjectHeaderId: msg.previousProjectHeaderId,
                                        carryoverPreviousCode: msg.carryoverPreviousCode
                                    }));
                            }
                            case "importtutorial": {
                                const load = data as pxt.editor.EditorMessageImportTutorialRequest;
                                return Promise.resolve()
                                    .then(() => projectView.importTutorialAsync(load.markdown));
                            }
                            case "proxytosim": {
                                const simmsg = data as pxt.editor.EditorMessageSimulatorMessageProxyRequest;
                                return Promise.resolve()
                                    .then(() => projectView.proxySimulatorMessage(simmsg.content));
                            }
                            case "renderblocks": {
                                const rendermsg = data as pxt.editor.EditorMessageRenderBlocksRequest;
                                return Promise.resolve()
                                    .then(() => projectView.renderBlocksAsync(rendermsg))
                                    .then(r => {
                                        return r.xml.then((svg: any) => {
                                            resp = svg.xml;
                                        })
                                    });
                            }
                            case "renderxml": {
                                const rendermsg = data as pxt.editor.EditorMessageRenderXmlRequest;
                                return Promise.resolve()
                                    .then(() => {
                                        const r = projectView.renderXml(rendermsg);
                                        return r.resultXml.then((svg: any) => {
                                            resp = svg.xml;
                                        })
                                    });
                            }
                            case "renderbyblockid": {
                                const rendermsg = data as pxt.editor.EditorMessageRenderByBlockIdRequest;
                                return Promise.resolve()
                                    .then(() => projectView.renderByBlockIdAsync(rendermsg))
                                    .then(r => {
                                        return r.resultXml.then((svg: any) => {
                                            resp = svg.xml;
                                        })
                                    });
                            }
                            case "runeval": {
                                const evalmsg = data as pxt.editor.EditorMessageRunEvalRequest;
                                const plan = evalmsg.validatorPlan;
                                const planLib = evalmsg.planLib;
                                return Promise.resolve()
                                    .then(() => {
                                        const blocks = projectView.getBlocks();
                                        return runValidatorPlan(blocks, plan, planLib)})
                                    .then (results => {
                                        resp = results;
                                    });
                            }
                            case "gettoolboxcategories": {
                                const msg = data as pxt.editor.EditorMessageGetToolboxCategoriesRequest;
                                return Promise.resolve()
                                    .then(() => {
                                        resp = projectView.getToolboxCategories(msg.advanced);
                                    });
                            }
                            case "getblockastext": {
                                const msg = data as pxt.editor.EditorMessageGetBlockAsTextRequest;
                                return Promise.resolve()
                                    .then(() => {
                                        const readableName = projectView.getBlockAsText(msg.blockId);
                                        resp = { blockAsText: readableName } as pxt.editor.EditorMessageGetBlockAsTextResponse;
                                    });
                            }
                            case "renderpython": {
                                const rendermsg = data as pxt.editor.EditorMessageRenderPythonRequest;
                                return Promise.resolve()
                                    .then(() => projectView.renderPythonAsync(rendermsg))
                                    .then(r => {
                                        resp = r.python;
                                    });
                            }
                            case "toggletrace": {
                                const togglemsg = data as pxt.editor.EditorMessageToggleTraceRequest;
                                return Promise.resolve()
                                    .then(() => projectView.toggleTrace(togglemsg.intervalSpeed));
                            }
                            case "settracestate": {
                                const trcmsg = data as pxt.editor.EditorMessageSetTraceStateRequest;
                                return Promise.resolve()
                                    .then(() => projectView.setTrace(trcmsg.enabled, trcmsg.intervalSpeed));
                            }
                            case "setsimulatorfullscreen": {
                                const fsmsg = data as pxt.editor.EditorMessageSetSimulatorFullScreenRequest;
                                return Promise.resolve()
                                    .then(() => projectView.setSimulatorFullScreen(fsmsg.enabled));
                            }
                            case "showthemepicker" : {
                                return Promise.resolve()
                                    .then(() => projectView.showThemePicker());
                            }
                            case "togglehighcontrast": {
                                return Promise.resolve()
                                    .then(() => projectView.toggleHighContrast());
                            }
                            case "sethighcontrast": {
                                const hcmsg = data as pxt.editor.EditorMessageSetHighContrastRequest;
                                return Promise.resolve()
                                    .then(() => projectView.setHighContrast(hcmsg.on));
                            }
                            case "togglegreenscreen": {
                                return Promise.resolve()
                                    .then(() => projectView.toggleGreenScreen());
                            }
                            case "togglekeyboardcontrols": {
                                return Promise.resolve()
                                    .then(() => projectView.toggleAccessibleBlocks("editormessage"));
                            }
                            case "print": {
                                return Promise.resolve()
                                    .then(() => projectView.printCode());
                            }
                            case "pair": {
                                return projectView.pairAsync().then(() => {});
                            }
                            case "info": {
                                return Promise.resolve()
                                    .then(() => {
                                        resp = {
                                            versions: pxt.appTarget.versions,
                                            locale: ts.pxtc.Util.userLanguage(),
                                            availableLocales: pxt.appTarget.appTheme.availableLocales,
                                            keyboardControls: projectView.isAccessibleBlocks()
                                        } as pxt.editor.InfoMessage;
                                    });
                            }
                            case "shareproject": {
                                const msg = data as pxt.editor.EditorShareRequest;
                                return projectView.anonymousPublishHeaderByIdAsync(msg.headerId, msg.projectName)
                                    .then(scriptInfo => {
                                        resp = scriptInfo;
                                    });
                            }
                            case "savelocalprojectstocloud": {
                                const msg = data as pxt.editor.EditorMessageSaveLocalProjectsToCloud;
                                return projectView.saveLocalProjectsToCloudAsync(msg.headerIds)
                                    .then(guidMap => {
                                        resp = <pxt.editor.EditorMessageSaveLocalProjectsToCloudResponse>{
                                            headerIdMap: guidMap
                                        };
                                    })
                            }
                            case "requestprojectcloudstatus": {
                                // Responses are sent as separate "projectcloudstatus" messages.
                                const msg = data as pxt.editor.EditorMessageRequestProjectCloudStatus;
                                return projectView.requestProjectCloudStatus(msg.headerIds);
                            }
                            case "convertcloudprojectstolocal": {
                                const msg = data as pxt.editor.EditorMessageConvertCloudProjectsToLocal;
                                return projectView.convertCloudProjectsToLocal(msg.userId);
                            }
                            case "setlanguagerestriction": {
                                const msg = data as pxt.editor.EditorSetLanguageRestriction;
                                if (msg.restriction === "no-blocks") {
                                    pxt.warn("no-blocks language restriction is not supported");
                                    throw new Error("no-blocks language restriction is not supported")
                                }
                                return projectView.setLanguageRestrictionAsync(msg.restriction);
                            }
                            case "precachetutorial": {
                                const msg = data as pxt.editor.PrecacheTutorialRequest;
                                const tutorialData = msg.data;
                                const lang = msg.lang || pxt.Util.userLanguage();

                                return pxt.github.db.cacheReposAsync(tutorialData)
                                    .then(async () => {
                                        if (typeof tutorialData.markdown === "string") {
                                            // the markdown needs to be cached in the translation db
                                            const db = await pxt.BrowserUtils.translationDbAsync();
                                            await db.setAsync(lang, tutorialData.path, undefined, undefined, tutorialData.markdown);
                                        }
                                    });
                            }
                            case "setcolorthemebyid": {
                                const msg = data as pxt.editor.EditorMessageSetColorThemeRequest;
                                projectView.setColorThemeById(msg.colorThemeId, !!msg.savePreference);
                                return Promise.resolve();
                            }
                        }
                        return Promise.resolve();
                    });
                })
            }
            p.then(() => sendResponse(data, resp, true, undefined),
                (err) => sendResponse(data, resp, false, err))
        }

        return true;
    };

    iframeClient = new IFrameEmbeddedClient(handleMessage);
}

/**
 * Sends analytics messages upstream to container if any
 */
let controllerAnalyticsEnabled = false;
export function enableControllerAnalytics() {
    if (controllerAnalyticsEnabled) return;

    const hasOnPostHostMessage = !!pxt.commands.onPostHostMessage;
    const hasAllowParentController = pxt.appTarget.appTheme.allowParentController;
    const isInsideIFrame = pxt.BrowserUtils.isIFrame();

    if (!(hasOnPostHostMessage || (hasAllowParentController && isInsideIFrame))) {
        return;
    }

    const te = pxt.tickEvent;
    pxt.tickEvent = function (id: string, data?: pxt.Map<string | number>): void {
        if (te) te(id, data);
        postHostMessageAsync(<pxt.editor.EditorMessageEventRequest>{
            type: 'pxthost',
            action: 'event',
            tick: id,
            response: false,
            data
        });
    }

    const rexp = pxt.reportException;
    pxt.reportException = function (err: any, data: pxt.Map<string>): void {
        if (rexp) rexp(err, data);
        try {
            postHostMessageAsync(<pxt.editor.EditorMessageEventRequest>{
                type: 'pxthost',
                action: 'event',
                tick: 'error',
                message: err.message,
                response: false,
                data
            })
        } catch (e) {

        }
    };

    const re = pxt.reportError;
    pxt.reportError = function (cat: string, msg: string, data?: pxt.Map<string | number>): void {
        if (re) re(cat, msg, data);
        postHostMessageAsync(<pxt.editor.EditorMessageEventRequest>{
            type: 'pxthost',
            action: 'event',
            tick: 'error',
            category: cat,
            message: msg,
            data
        })
    }

    controllerAnalyticsEnabled = true;
}

function sendResponse(request: pxt.editor.EditorMessage, resp: any, success: boolean, error: any) {
    if (request.response) {
        const toSend = {
            type: request.type,
            id: request.id,
            resp,
            success,
            error
        };

        if (iframeClient) {
            iframeClient.postMessage(toSend)
        }
        else {
            window.parent.postMessage(toSend, "*");
        }
    }
}

/**
 * Determines if host messages should be posted
 */
export function shouldPostHostMessages() {
    return pxt.appTarget.appTheme.allowParentController && pxt.BrowserUtils.isIFrame();
}

/**
 * Posts a message from the editor to the host
 */
export function postHostMessageAsync(msg: pxt.editor.EditorMessageRequest): Promise<pxt.editor.EditorMessageResponse> {
    return new Promise<pxt.editor.EditorMessageResponse>((resolve, reject) => {
        const env = pxt.Util.clone(msg);
        env.id = ts.pxtc.Util.guidGen();
        if (msg.response)
            pendingRequests[env.id] = { resolve, reject };

        if (iframeClient) {
            iframeClient.postMessage(env);
        }
        else {
            window.parent.postMessage(env, "*");
        }

        // Post to editor extension if it wants to be notified of these messages.
        // Note this is a one-way notification. Responses are not supported.
        if (pxt.commands.onPostHostMessage) {
            try {
                pxt.commands.onPostHostMessage(env);
            } catch (err) {
                pxt.reportException(err);
            }
        }

        if (!msg.response)
            resolve(undefined)
    })
}
