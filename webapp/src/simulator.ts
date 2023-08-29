/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../localtypings/pxtparts.d.ts" />

import * as core from "./core";
import * as coretsx from "./coretsx";
import U = pxt.U

interface SimulatorConfig {
    // return true if a visible breakpoint was found
    orphanException(brk: pxsim.DebuggerBreakpointMessage): void;
    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage): boolean;
    restartSimulator(): void;
    onStateChanged(state: pxsim.SimulatorState): void;
    onSimulatorReady(): void;
    setState(key: string, value: any): void;
    onMuteButtonStateChange(state: pxt.editor.MuteState): void;
    editor: string;
}

export const FAST_TRACE_INTERVAL = 100;
export const SLOW_TRACE_INTERVAL = 500;

export let driver: pxsim.SimulatorDriver;
let config: SimulatorConfig;
let lastCompileResult: pxtc.CompileResult;
let displayedModals: pxt.Map<boolean> = {};
export let simTranslations: pxt.Map<string>;

export function setTranslations(translations: pxt.Map<string>) {
    if (simTranslations !== translations) {
        simTranslations = translations;
        setDirty();
    }
}

export function init(root: HTMLElement, cfg: SimulatorConfig) {
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
                console.error(`Invalid parent origin: ${origin}`)
            }
        }
    }

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
                const animation = pxt.appTarget.appTheme.simAnimationExit || 'fly right out';
                el.style.animationDuration = '500ms';
                const animationClasses = `${animation} visible transition animating`;
                pxsim.U.addClass(el, animationClasses);
                pxt.Util.delay(500).then(() => {
                    pxsim.U.removeClass(el, `animating`);
                    el.style.animationDuration = '';

                    if (completeHandler) completeHandler();
                    pxsim.U.remove(el);
                })
            }
        },
        unhideElement: (el) => {
            pxsim.U.removeClass(el, "simHeadless");
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
            if (state === pxsim.SimulatorState.Stopped) {
                postSimEditorEvent("stopped");
            } else if (state === pxsim.SimulatorState.Running) {
                this.onDebuggerResume();
            }
            cfg.onStateChanged(state);
        },
        onSimulatorReady: function () {
            pxt.perf.recordMilestone("simulator ready")
            if (!pxt.perf.perfReportLogged) {
                pxt.perf.report()
            }
        },
        onSimulatorCommand: (msg: pxsim.SimulatorCommandMessage): void => {
            switch (msg.command) {
                case "setstate":
                    cfg.setState(msg.stateKey, msg.stateValue);
                    break
                case "restart":
                    cfg.restartSimulator();
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
        stoppedClass: pxt.appTarget.simulator && pxt.appTarget.simulator.stoppedClass,
        invalidatedClass: pxt.appTarget.simulator && pxt.appTarget.simulator.invalidatedClass,
        nestedEditorSim,
        parentOrigin,
        mpRole,
        messageSimulators: pxt.appTarget?.simulator?.messageSimulators
    };
    driver = new pxsim.SimulatorDriver(document.getElementById('simulators'), options);
    config = cfg
}

function postSimEditorEvent(subtype: string, exception?: string) {
    if (pxt.editor.shouldPostHostMessages()) {
        pxt.editor.postHostMessageAsync({
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

    const theme = pkg.config.theme || (pxt.appTarget.appTheme.matchWebUSBDeviceInSim && pxt.packetio.isConnected() && pxt.packetio.deviceVariant());

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
