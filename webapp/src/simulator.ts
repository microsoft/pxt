/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../localtypings/pxtparts.d.ts" />

import * as core from "./core";
import * as coretsx from "./coretsx";
import * as data from "./data";
import U = pxt.U
import { postHostMessageAsync, shouldPostHostMessages } from "../../pxteditor";
import { Milestones } from "./constants";
import * as simulatorTheme from "./simulatorTheme";
import * as simulatorThemePreference from "./simulatorThemePreference";
import * as pkg from "./package";
import { applyUserEdit, ProjfsEditor, ProjfsHost, ProjfsProject, writeProjectFileAsync } from "./projfsHost";
import { createProjassetsConfig, ProjassetsConfig, ProjassetsHost } from "./projassetsHost";
import {
    answerSimxEditorRequest,
    findSimxInstanceCreator,
    getDependencyRepository,
    getProjectSimxEditors,
    getSimxEditorRegistrations,
    isSimxInProject,
    SimxEditorHost,
    SimxEditorRegistration,
} from "./simxEditorHost";
import { OpenProjectTracker } from "./simxRequests";
import { SimxEditorSimulatorCommand, SimxEditorSimulatorState } from "../../pxtservices/simxeditor";



interface SimulatorConfig {
    // return true if a visible breakpoint was found
    orphanException(brk: pxsim.DebuggerBreakpointMessage): void;
    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage): boolean;
    restartSimulator(): void;
    singleSimulator(): void;
    onStateChanged(state: pxsim.SimulatorState): void;
    onSimulatorReady(): void;
    setState(key: string, value: any): void;
    onMuteButtonStateChange(state: pxt.editor.MuteState): void;
    editor: string;
    // the editor entry points that simulator extension changes flagged dirty pass through
    projfsEditor: ProjfsEditor;
    // shows the editor tab of the simulator extension registered under the key; returns false,
    // showing nothing, if the editor offers no such tab here
    openSimxEditor(key: string): boolean;
}

export const FAST_TRACE_INTERVAL = 100;
export const SLOW_TRACE_INTERVAL = 500;

export let driver: pxsim.SimulatorDriver;
// the editor tab frames of simulator extensions; undefined until the simulator is initialized
export let simxEditorHost: SimxEditorHost;
let config: SimulatorConfig;
let lastCompileResult: pxtc.CompileResult;
let previewSimulatorTheme: pxt.SimulatorTheme | undefined;
let displayedModals: pxt.Map<boolean> = {};
// the editor package of the open project, as simulator extensions read it
const openProject = new OpenProjectTracker<pkg.EditorPackage>(() => {
    const epkg = pkg.mainEditorPkg();
    return epkg.header ? epkg : undefined;
});
const projfsHost = new ProjfsHost(getProjfsProject);
const projassetsHost = new ProjassetsHost(getOpenAssetProject, () => pxt.react.getTilemapProject(), getAssetConfig);
export let simTranslations: pxt.Map<string>;

export function setTranslations(translations: pxt.Map<string>) {
    if (simTranslations !== translations) {
        simTranslations = translations;
        setDirty();
    }
}

export async function initAsync(cfg: SimulatorConfig) {
    // We previously hit a Safari < 18 codegen issue with root as a parameter.
    const root = document.getElementById("boardview");
    if (!root) return;
    pxsim.U.clear(root);
    const simulatorsDiv = document.createElement('div');
    simulatorsDiv.id = 'simulators';
    simulatorsDiv.className = 'simulator';
    root.appendChild(simulatorsDiv);
    const debuggerDiv = document.createElement('div');
    debuggerDiv.id = 'debugger';
    debuggerDiv.className = 'ui item landscape only';
    root.appendChild(debuggerDiv);

    const trgConfig = await data.getAsync<pxt.TargetConfig>("target-config:")

    const nestedEditorSim = /nestededitorsim=1/i.test(window.location.href);
    const mpRole = /[\&\?]mp=(server|client)/i.exec(window.location.href)?.[1]?.toLowerCase();
    let parentOrigin: string = null;
    if (window.parent !== window) {
        const searchParams = new URLSearchParams(window.location.search);
        const origin = searchParams.get("parentOrigin")

        // validate the URI
        if (!!origin) {
            try {
                const originUrl = new URL(origin);
                parentOrigin = originUrl.origin
            } catch (e) {
                pxt.error(`Invalid parent origin: ${origin}`)
            }
        }
    }

    // Map simulator extensions from approved repos
    const simulatorExtensions: pxt.Map<pxt.SimulatorExtensionConfig> = {};
    Object.entries(trgConfig?.packages?.approvedRepoLib || {})
        .map(([k, v]) => ({ k: k, v: v.simx }))
        .filter(x => !!x.v)
        .forEach(x => simulatorExtensions[x.k] = {
            index: "index.html", // default to index.html
            aspectRatio: pxt.appTarget.simulator.aspectRatio || 1.22, // fallback to 1.22
            permanent: true, // default to true
            ...x.v
        });
    // Add in test simulator extensions
    Object.entries(pxt.appTarget?.simulator?.testSimulatorExtensions || {})
        .map(([k, v]) => ({ k: k, v: v as pxt.SimulatorExtensionConfig }))
        .filter(x => !!x.v)
        .forEach(x => simulatorExtensions[x.k] = {
            index: "index.html", // default to index.html
            aspectRatio: pxt.appTarget.simulator.aspectRatio || 1.22, // fallback to 1.22
            permanent: true, // default to true
            ...x.v
        });

    // Plays the simulator frame exit animation on `el`, then calls `done`.
    const playExitAnimation = (el: HTMLElement, done: () => void) => {
        const animation = pxt.appTarget.appTheme.simAnimationExit || 'fly right out';
        el.style.animationDuration = '500ms';
        const animationClasses = `${animation} visible transition animating`;
        pxsim.U.addClass(el, animationClasses);
        pxt.Util.delay(500).then(() => {
            pxsim.U.removeClass(el, animationClasses);
            el.style.animationDuration = '';
            done();
        })
    };

    let options: pxsim.SimulatorDriverOptions = {
        restart: () => cfg.restartSimulator(),
        revealElement: (el) => {
            if (pxt.options.light || driver.isLoanedSimulator(el)) return;
            // Play enter animation
            const animation = pxt.appTarget.appTheme.simAnimationEnter || 'fly right in';
            el.style.animationDuration = '500ms';
            const animationClasses = `${animation} visible transition animating`;
            pxsim.U.addClass(el, animationClasses);

            pxt.Util.delay(500).then(() => {
                pxsim.U.removeClass(el, animationClasses);
                el.style.animationDuration = '';

                if (pxt.BrowserUtils.isEdge() && coretsx.dialogIsShowing()) {
                    // Workaround for a Microsoft Edge bug where when a dialog is open and the simulator is
                    // revealed it somehow breaks the page render. See https://github.com/Microsoft/pxt/pull/4707
                    // for more details

                    document.body.style.display = "none";
                    requestAnimationFrame(() => {
                        document.body.style.display = "block";
                    });
                }
            })
        },
        removeElement: (el, completeHandler) => {
            if (pxt.appTarget.simulator.headless) {
                pxsim.U.addClass(el, 'simHeadless');
                if (completeHandler) completeHandler();
            }
            else {
                if (pxt.options.light) {
                    if (completeHandler) completeHandler();
                    pxsim.U.remove(el);
                    return;
                }
                // Play exit animation
                playExitAnimation(el, () => {
                    if (completeHandler) completeHandler();
                    pxsim.U.remove(el);
                });
            }
        },
        hideElement: (el, completeHandler) => {
            if (pxt.appTarget.simulator.headless) {
                pxsim.U.addClass(el, 'simHeadless');
                if (completeHandler) completeHandler();
            }
            else if (pxt.options.light) {
                pxsim.U.addClass(el, 'simHidden');
                if (completeHandler) completeHandler();
            }
            else {
                playExitAnimation(el, () => {
                    pxsim.U.addClass(el, 'simHidden');
                    if (completeHandler) completeHandler();
                });
            }
        },
        unhideElement: (el) => {
            pxsim.U.removeClass(el, "simHeadless");
            if (pxsim.U.containsClass(el, "simHidden")) {
                pxsim.U.removeClass(el, "simHidden");
                options.revealElement(el);
            }
        },
        onDebuggerBreakpoint: function (brk) {
            // walk stack until breakpoint is found
            // and can be highlighted
            let highlighted = false;
            if (config) {
                let frameid = 0;
                let brkid = brk.breakpointId;
                while (!highlighted) {
                    // try highlight current statement
                    if (brkid) {
                        const brkInfo = lastCompileResult.breakpoints[brkid];
                        highlighted = config.highlightStatement(brkInfo, brk);
                    }
                    // try next frame
                    if (!highlighted) {
                        frameid++;
                        const frame = brk.stackframes ? brk.stackframes[frameid] : undefined;
                        // no more frames, done
                        if (!frame) break;
                        brkid = frame.breakpointId;
                    }
                }
            }
            // no exception and no highlighting, keep going
            if (!brk.exceptionMessage && config && !highlighted) {
                // keep going until breakpoint is hit
                driver.resume(pxsim.SimulatorDebuggerCommand.StepInto);
                return;
            }
            // we had an expected but could not find a block
            if (!highlighted && brk.exceptionMessage) {
                pxt.debug(`runtime error: ${brk.exceptionMessage}`);
                pxt.debug(brk.exceptionStack);
                if (config) config.orphanException(brk);
            }
            postSimEditorEvent("stopped", brk.exceptionMessage);
        },
        onTraceMessage: function (msg) {
            let brkInfo = lastCompileResult.breakpoints[msg.breakpointId]
            if (config) config.highlightStatement(brkInfo, msg)
        },
        onDebuggerWarning: function (wrn) {
            for (let id of wrn.breakpointIds) {
                let brkInfo = lastCompileResult.breakpoints[id]
                if (brkInfo) {
                    if (!U.startsWith("pxt_modules/", brkInfo.fileName)) {
                        if (config) config.highlightStatement(brkInfo)
                        break
                    }
                }
            }
        },
        onDebuggerResume: function () {
            postSimEditorEvent("resumed");
            if (config) config.highlightStatement(null)
        },
        onStateChanged: function (state) {
            simxEditorHost?.simulatorStateChanged(pxsim.SimulatorState[state] as SimxEditorSimulatorState);
            if (state === pxsim.SimulatorState.Stopped) {
                postSimEditorEvent("stopped");
            } else if (state === pxsim.SimulatorState.Running) {
                this.onDebuggerResume();
                postPreviewSimulatorTheme();
            }
            cfg.onStateChanged(state);
        },
        onSimulatorReady: function () {
            pxt.perf.recordMilestone(Milestones.SimulatorReady)
            cfg.onSimulatorReady();
        },
        onSimulatorCommand: (msg: pxsim.SimulatorCommandMessage): void => {
            switch (msg.command) {
                case "setstate":
                    cfg.setState(msg.stateKey, msg.stateValue);
                    break
                case "restart":
                    cfg.restartSimulator();
                    break;
                case "single":
                    cfg.singleSimulator();
                    break;
                case "reload":
                    stop(true);
                    cfg.restartSimulator();
                    break;
                case "modal":
                    stop();
                    if (!pxt.shell.isSandboxMode() && (!msg.displayOnceId || !displayedModals[msg.displayOnceId])) {
                        const modalOpts: core.ConfirmOptions = {
                            header: msg.header,
                            body: msg.body,
                            size: "large",
                            copyable: msg.copyable,
                            disagreeLbl: lf("Close"),
                            modalContext: msg.modalContext
                        };
                        const trustedSimUrls = pxt.appTarget.simulator.trustedUrls;
                        const hasTrustedLink = msg.linkButtonHref && trustedSimUrls && trustedSimUrls.indexOf(msg.linkButtonHref) !== -1;

                        if (hasTrustedLink) {
                            modalOpts.agreeLbl = msg.linkButtonLabel;
                        } else {
                            modalOpts.hideAgree = true;
                        }

                        displayedModals[msg.displayOnceId] = true;
                        core.confirmAsync(modalOpts)
                            .then((selection) => {
                                if (hasTrustedLink && selection == 1) {
                                    window.open(msg.linkButtonHref, '_blank');
                                }
                            });
                    }
                    break;
            }
        },
        onTopLevelCodeEnd: () => {
            postSimEditorEvent("toplevelfinished");
        },
        onMuteButtonStateChange: cfg.onMuteButtonStateChange,
        onProjfsMessage: (key, msg, reply, frame) => {
            projfsHost.handleMessageAsync(key, msg, reply, frame);
        },
        onProjassetsMessage: (key, msg, reply, frame) => {
            projassetsHost.handleMessageAsync(key, msg, reply, frame);
        },
        onSimxEditorMessage: (key, msg, reply) => {
            reply(answerSimxEditorRequest(key, msg, k => cfg.openSimxEditor(k)) as pxsim.SimulatorMessage);
        },
        onSimxFrameLoad: (key, frame) => {
            simxEditorHost?.simulatorFrameLoaded(key, frame);
        },
        isSimxInProject: key => isSimxInProject(key, getProjectDependencies()),
        onFramesUnloaded: () => {
            simxEditorHost?.ensureSimulatorFrames();
        },
        stoppedClass: pxt.appTarget.simulator && pxt.appTarget.simulator.stoppedClass,
        invalidatedClass: pxt.appTarget.simulator && pxt.appTarget.simulator.invalidatedClass,
        nestedEditorSim,
        parentOrigin,
        mpRole,
        messageSimulators: pxt.appTarget?.simulator?.messageSimulators,
        simulatorExtensions,
        userLanguage: pxt.Util.userLanguage(),
        targetId: pxt.appTarget.id,
        getProjectId: () => pkg.mainEditorPkg().header?.id
    };
    driver = new pxsim.SimulatorDriver(document.getElementById('simulators'), options);
    config = cfg
    simxEditorHost = new SimxEditorHost({
        createFrame: () => document.createElement("iframe"),
        createLoader: label => {
            const loader = document.createElement("div");
            loader.className = "ui active text loader";
            loader.textContent = lf("Loading {0}...", label);
            return loader;
        },
        framePermissions: grants => pxsim.simulatorFramePermissions(grants),
        startSimulatorExtension: key => driver.startSimulatorExtension(key),
        addTabFrame: (key, frame) => driver.addEditorTabFrame(key, frame),
        removeTabFrame: frame => driver.removeEditorTabFrame(frame),
        getSimulatorState: () => pxsim.SimulatorState[driver.state] as SimxEditorSimulatorState,
        createChannel: () => new MessageChannel(),
    });
    window.addEventListener("message", ev => simxEditorHost.handleMessage(ev), false);
}

/**
 * Returns the editor tabs of simulator extensions the editor offers for the open
 * project, in registration order: those of registrations that declare and enable
 * a tab, whose extension the project includes.
 */
export function getProjectSimxEditorRegistrations(): SimxEditorRegistration[] {
    if (!driver || !pkg.mainPkg) return [];
    const registrations = getSimxEditorRegistrations(driver.options.simulatorExtensions);
    if (!registrations.length) return [];
    return getProjectSimxEditors(registrations, getProjectDependencies());
}

/** Returns the version specs of every package the open project has loaded, without resolving any package. */
function getProjectDependencies(): string[] {
    const deps = pkg.mainPkg?.deps || {};
    return Object.keys(deps).map(id => deps[id]?._verspec);
}

// the ignored claims on types, by registration key and type, logged since the open project loaded
const loggedSimxClaims = new Set<string>();

/**
 * Returns the key of the simulator extension whose editor tab creates the
 * instances of the fixed-instance type `typeQName`, among those whose tabs the
 * editor offers the open project, or undefined if none does. Only a
 * registration of the GitHub repository of the type's declaring package may
 * create them, and the first such in registration order does; every other
 * registration naming the type in its `creates` is logged once per project load.
 * @param declaringPackage the id of the package that declares the type, as the type's `pkg` gives it; undefined for the project's own code
 */
export function getProjectSimxInstanceCreator(typeQName: string, declaringPackage: string | undefined): string | undefined {
    const registrations = getProjectSimxEditorRegistrations();
    const spec = declaringPackage ? pkg.mainPkg?.deps[declaringPackage]?._verspec : undefined;
    const { creator, ignored } = findSimxInstanceCreator(registrations, typeQName, getDependencyRepository(spec));
    for (const { key, reason } of ignored) {
        const claim = `${key} ${typeQName}`;
        if (loggedSimxClaims.has(claim)) continue;
        loggedSimxClaims.add(claim);
        pxt.warn(reason === "OTHER_REPOSITORY"
            ? `simulator extension ${key}: ignoring its claim to create ${typeQName}, which no package of its repository declares`
            : `simulator extension ${key}: ignoring its claim to create ${typeQName}, which an earlier registration creates`);
    }
    return creator?.key;
}

/** Tells every ready simulator extension editor tab that the editor is giving the simulator `command`. */
export function postSimxEditorSimulatorCommand(command: SimxEditorSimulatorCommand) {
    simxEditorHost?.simulatorCommand(command);
}

/** Tells every ready simulator extension editor tab whether the editor is in fullscreen-simulator mode. */
export function postSimxEditorFullscreen(enabled: boolean) {
    simxEditorHost?.fullscreenChanged(enabled);
}

/**
 * Closes the open project to simulator extensions: removes every editor tab
 * frame, with the actions held for the tabs, forgets the ignored `creates`
 * claims logged for the project, refuses the project-file and project-asset
 * requests still waiting for the project with `PROJECT_CLOSED`, and ends every
 * project-file and project-asset subscription. Call before the simulator
 * unloads, as the project closes or another load begins.
 */
export function closeSimxProject() {
    simxEditorHost?.close();
    loggedSimxClaims.clear();
    openProject.close();
    projfsHost.close();
    projassetsHost.close();
}

/**
 * Returns the open project as the asset host waits on it, or undefined if none
 * is open: its editor package.
 */
function getOpenAssetProject(): pkg.EditorPackage | undefined {
    return openProject.get();
}

/** Returns the configuration of the open project as the asset host reads and watches it. */
function getAssetConfig(): ProjassetsConfig {
    return createProjassetsConfig(pkg.mainPkg, {
        get: () => simulatorThemePreference.getEffectiveSimulatorThemePreference()?.theme,
        addChangeListener: simulatorThemePreference.addSimulatorThemePreferenceListener,
        removeChangeListener: simulatorThemePreference.removeSimulatorThemePreferenceListener,
    });
}

// the project getProjfsProject last returned, with the editor package it stands for
let projfsProject: { epkg: pkg.EditorPackage, project: ProjfsProject } | undefined;

/**
 * Returns the open project as simulator extensions read and write it, or undefined
 * if no project is open; the same object while the project stays open.
 */
function getProjfsProject(): ProjfsProject | undefined {
    const epkg = openProject.get();
    if (!epkg) return undefined;
    if (projfsProject?.epkg !== epkg)
        projfsProject = { epkg, project: createProjfsProject(epkg) };
    return projfsProject.project;
}

/**
 * Returns the project of `epkg` as simulator extensions read and write it.
 * Changes are saved like other programmatic file writes and never reload the
 * project. By default they leave a running simulator alone; a change flagged
 * dirty then passes through the editor's user-edit pipeline, which reruns the
 * simulator as a user edit does.
 */
function createProjfsProject(epkg: pkg.EditorPackage): ProjfsProject {
    return {
        loadedAsync: () => epkg.loadedAsync(),
        getFiles: () => epkg.getAllFiles(),
        writeFileAsync: (name, content) => writeProjectFileAsync(epkg, config?.projfsEditor, name, content),
        deleteFileAsync: async name => {
            await epkg.removeFileAsync(name);
            await epkg.saveFilesAsync();
        },
        setListedAsync: async (name, listed) => {
            await epkg.setFileListedAsync(name, listed);
        },
        markDirty: (name, content) => {
            if (config?.projfsEditor) applyUserEdit(config.projfsEditor, name, content);
        },
        addChangeListener: listener => epkg.addFileChangeListener(listener),
        removeChangeListener: listener => epkg.removeFileChangeListener(listener),
    };
}

function postSimEditorEvent(subtype: string, exception?: string) {
    if (shouldPostHostMessages()) {
        postHostMessageAsync({
            type: "pxthost",
            action: "simevent",
            subtype: subtype as any,
            exception: exception
        } as pxt.editor.EditorSimulatorStoppedEvent);
    }
}

let tutorialMode: boolean = false;
export function setState(editor: string, tutMode?: boolean) {
    if (config && config.editor != editor) {
        config.editor = editor;
        config.highlightStatement(null)
    }

    tutorialMode = tutMode;
}

export function setDirty() { // running outdated code
    if (driver) driver.setDirty();
}

export function setPending() {
    if (driver) driver.setPending();
}

export interface RunOptions {
    mute?: boolean;
    highContrast?: boolean;
    light?: boolean;
    clickTrigger?: boolean;
    storedState?: pxt.Map<any>;
    autoRun?: boolean;
}

export function run(pkg: pxt.MainPackage, debug: boolean,
    res: pxtc.CompileResult, options: RunOptions, trace: boolean) {
    const boardDefinition = pxt.appTarget.simulator.boardDefinition;
    const {
        js,
        fnArgs,
        parts,
        usedBuiltinParts,
        allParts
    } = pxtc.buildSimJsInfo(res);
    lastCompileResult = res;
    const { mute, highContrast, light, clickTrigger, storedState, autoRun } = options;
    const isIpcRenderer = pxt.BrowserUtils.isIpcRenderer() || undefined;
    const dependencies: pxt.Map<string> = {}
    for (const dep of pkg.sortedDeps())
        dependencies[dep.id] = dep.version()

    const playerNumber = allParts && allParts.indexOf("multiplayer") >= 0 ? 1 : undefined;
    if (playerNumber) {
        const root = document.getElementById("root");
        for (let i = 1; i <= 4; i++) {
            const cssVar = `--multiplayer-presence-icon-${i}`;
            root?.style?.removeProperty(cssVar);
        }
    }

    const deviceTheme = pxt.appTarget.appTheme.matchWebUSBDeviceInSim && pxt.packetio.isConnected()
        ? pxt.packetio.deviceVariant()
        : undefined;
    const theme = previewSimulatorTheme || simulatorTheme.resolveSimulatorTheme(
            pkg.config.theme,
            deviceTheme,
            simulatorThemePreference.getEffectiveSimulatorThemePreference()?.theme,
            !!playerNumber
        );

    const opts: pxsim.SimulatorRunOptions = {
        boardDefinition: boardDefinition,
        mute,
        parts,
        builtinParts: usedBuiltinParts,
        debug,
        trace,
        fnArgs,
        highContrast,
        light,
        aspectRatio: parts.length ? pxt.appTarget.simulator.partsAspectRatio : pxt.appTarget.simulator.aspectRatio,
        partDefinitions: pkg.computePartDefinitions(parts),
        cdnUrl: pxt.webConfig.commitCdnUrl,
        localizedStrings: simTranslations,
        refCountingDebug: pxt.options.debug,
        version: pkg.version(),
        clickTrigger: clickTrigger,
        breakOnStart: debug,
        storedState: storedState,
        autoRun,
        ipc: isIpcRenderer,
        dependencies,
        activePlayer: playerNumber,
        theme: theme,
    }
    //if (pxt.options.debug)
    //    pxt.debug(JSON.stringify(opts, null, 2))
    postSimEditorEvent("started");

    driver.run(js, opts);
}

export function mute(mute: boolean) {
    if (!driver) return;
    driver.mute(mute);
}

export function stop(unload?: boolean, starting?: boolean) {
    if (!driver) return;
    driver.stop(unload, starting);
}

export function suspend() {
    if (!driver) return;
    driver.suspend();
}

export function hide(completeHandler?: () => void) {
    if (!driver) return;
    driver.hide(completeHandler);
}

export function unhide() {
    if (!driver) return;
    driver.unhide();
}

export function setTraceInterval(intervalMs: number) {
    if (!driver) return;
    driver.setTraceInterval(intervalMs);
}

export function proxy(message: pxsim.SimulatorCustomMessage) {
    if (!driver) return;
    driver.postMessage(message);
}

export function setPreviewSimulatorTheme(theme: pxt.SimulatorTheme) {
    previewSimulatorTheme = theme;
    postPreviewSimulatorTheme();
}

function postPreviewSimulatorTheme() {
    if (!previewSimulatorTheme || !driver) return;
    const message: pxsim.SetSimulatorThemeMessage = {
        type: "setsimtheme",
        theme: previewSimulatorTheme,
    };
    driver.postMessage(message);
}

export function clearPreviewSimulatorTheme() {
    previewSimulatorTheme = undefined;
}

export function dbgPauseResume() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.Resume);
    } else if (driver.state == pxsim.SimulatorState.Running) {
        driver.resume(pxsim.SimulatorDebuggerCommand.Pause);
    }
}

export function dbgStepOver() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepOver);
    }
}

export function dbgStepInto() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepInto);
    }
}

export function dbgStepOut() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepOut);
    }
}
