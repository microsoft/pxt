/// <reference path="../../localtypings/pxtparts.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as sui from "./sui"
import * as srceditor from "./srceditor"
import Util = pxt.Util
import { fireClickOnEnter } from "./util"
import IProjectView = pxt.editor.IProjectView;
import * as simulator from "./simulator";

// TODOs:
// - use the SVG board images instead of drawing squares; 
// - keep the sprites and simulators in sync when adding/clearing boards
//   - right now, the correspondence is based on order, which is brittle; 
//     we should add an ID to the simulator and keep track of it in the sprite
// - add a way to remove individual boards
// - add a way to rename boards
// - when we receive message from the simulator, update the corresponding board's sprite
//   - on sending a radio message, do an animation around the sprite of the sending board

function mkBoardImgSvg(): pxsim.visuals.SVGElAndSize {
    const boardDefinition = pxt.appTarget.simulator.boardDefinition
    const boardView = pxsim.visuals.mkBoardView({
        visual: boardDefinition.visual,
        boardDef: boardDefinition
    });
    return boardView.getView();
}

class BoardSprite {
    private _name: string = "";
    constructor(public id: number, public x: number, public y: number) {

    }

    set name(n: string) {
        this._name = n;
    }
    get name() {
        return this._name;
    }
}

export class PhysicalSimulator extends srceditor.Editor {
    isVisible = false;
    active: boolean = true
    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;

    boards: BoardSprite[] = [];
    nextBoardId: number = 0;
    draggingBoard: BoardSprite | undefined;
    dragOffsetX = 0;
    dragOffsetY = 0;
    boardImgCached: HTMLImageElement | undefined;
    spriteWidth = 40;
    spriteHeight = 0;

    getId() {
        return "physicalSimulator"
    }

    hasHistory() { return false; }

    hasEditorToolbar() {
        return false
    }

    acceptsFile(file: pkg.File) {
        return file.name === pxt.PHYSICAL_SIMULATOR_EDITOR_FILE;
    }

    setVisible(b: boolean) {
        // TODO: It'd be great to re-render this component dynamically when the contrast changes,
        // TODO: but for now the user has to toggle the serial editor to see a change.
        const highContrast = core.getHighContrastOnce();
        if (highContrast !== this.highContrast) {
            this.setHighContrast(highContrast)
        }
        this.isVisible = b;
    }

    setHighContrast(hc: boolean) {
        if (hc !== this.highContrast) {
            this.highContrast = hc;
            if (hc) {
                this.currentLineColors = this.hcLineColors
            } else {
                this.currentLineColors = this.lineColors
            }
            this.clear()
        }
    }

    simStateChanged() {
        // this.charts.forEach((chart) => chart.setRealtimeData(this.wantRealtimeData()));
    }

    constructor(public parent: IProjectView) {
        super(parent);
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.addSimulator = this.addSimulator.bind(this);
        this.clearSprites = this.clearSprites.bind(this);
        this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this);
        this.onCanvasMouseMove = this.onCanvasMouseMove.bind(this);
        this.onCanvasMouseUp = this.onCanvasMouseUp.bind(this);
        // Add an initial board to the simulator
        this.addSprite();
    }

    processEvent(ev: MessageEvent) {
        let msg = ev.data
        if (msg.type === "serial") {
            this.processEventCore(msg);
        }
        else if (msg.type === "bulkserial") {
            (msg as pxsim.SimulatorBulkSerialMessage).data.forEach(datum => {
                this.processEventCore({
                    type: "serial",
                    data: datum.data,
                    receivedTime: datum.time,
                    sim: msg.sim,
                    id: msg.id
                } as pxsim.SimulatorSerialMessage);
            })
        }
    }

    processEventCore(smsg: pxsim.SimulatorSerialMessage) {
        const isClearLog = smsg.csvType === "clear";

        smsg.receivedTime = smsg.receivedTime || Util.now();

        this.processMessage(smsg);
    }

    processMessage(smsg: pxsim.SimulatorSerialMessage) {
        const sim = !!smsg.sim

    }

    clearNode(e: HTMLElement) {

    }

    clear() {
        //pxt.BrowserUtils.addClass(this.serialRoot, "hide-view-latest");

        // If the editor is currently visible, leave these as is to leave toggle state.
        if (!this.isVisible) {
            // if (this.serialRoot) {
                // pxt.BrowserUtils.addClass(this.serialRoot, "no-toggle")
            // }
        }
    }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    private addSprite() {
        // Create a new board sprite with random position
        const canvas = document.getElementById("simulatorCanvas") as HTMLCanvasElement;
        if (canvas) {
            const maxX = Math.max(canvas.width - this.spriteWidth, 0);
            const maxY = Math.max(canvas.height - this.spriteHeight, 0);
            const x = Math.random() * maxX;
            const y = Math.random() * maxY;
            const sprite = new BoardSprite(this.nextBoardId, x, y);
            sprite.name = `board${this.nextBoardId}`;
            this.boards.push(sprite);
            this.nextBoardId++;
            this.drawBoards();
        }

    }

    // TODO: upon entry, we need to create simulators for the board sprites, except for the first one
    recreateSimulators() {
        this.boards.forEach((board, index) => {
            if (index === 0) return; // skip the first board, which is the default one
            simulator.driver.addSimulator()
        })
    }

    addSimulator() {
        pxt.tickEvent("serial.newBoardButton", undefined, { interactiveConsent: true })
        this.addSprite();
        simulator.driver.addSimulator()
    }

    clearSprites() {
        pxt.tickEvent("serial.clearBoardsButton", undefined, { interactiveConsent: true })
        if (this.boards.length <= 1) return;
        this.boards = [this.boards[0]];
        this.nextBoardId = 1;
        this.drawBoards();
    }

    display() {
        return (
            <div id="serialArea" className="no-toggle" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div id="serialHeader" className="ui serialHeader">
                    <div className="leftHeaderWrapper">
                        <div className="leftHeader">
                            <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="arrow left" />
                                <span className="ui text landscape only">{lf("Go back")}</span>
                            </sui.Button>
                            <sui.Button title={lf("Add simulator")} tabIndex={0} onClick={this.addSimulator} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="plus" />
                                <span className="ui text landscape only">{lf("Add simulator")}</span>
                            </sui.Button>
                            <sui.Button title={lf("Clear all but first board")} tabIndex={0} onClick={this.clearSprites} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="trash" />
                                <span className="ui text landscape only">{lf("Clear simulators")}</span>
                            </sui.Button>
                        </div>
                    </div>
                </div>
                <div id="canvasContainer" style={{ backgroundColor: "#228B22", flex: 1, minHeight: 0, overflow: "hidden" }}>
                    <canvas
                        id="simulatorCanvas"
                        style={{ display: "block", width: "100%", height: "100%" }}
                        onMouseDown={this.onCanvasMouseDown}
                        onMouseMove={this.onCanvasMouseMove}
                        onMouseUp={this.onCanvasMouseUp}
                        onMouseLeave={this.onCanvasMouseUp}
                    />
                </div>
            </div>
        )
    }

    domUpdate() {
        this.drawBoards();
    }

    drawBoards() {
        const canvas = document.getElementById("simulatorCanvas") as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size to match container
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Clear canvas
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Initialize cached board image if needed
        if (!this.boardImgCached) {
            this.initBoardImage();
            if (!this.boardImgCached) return;
        }

        // Draw each board
        this.boards.forEach((board) => {
            ctx.drawImage(this.boardImgCached!, board.x, board.y, this.spriteWidth, this.spriteHeight);

            // Draw label text
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(board.name, board.x + this.spriteWidth / 2, board.y + this.spriteHeight + 2);
        });
    }

    private initBoardImage() {
        const boardImg =  mkBoardImgSvg();
        // Get dimensions from the SVG element
        const svgEl = boardImg.el as SVGSVGElement;
        let svgWidth = 100;
        let svgHeight = 100;

        if (svgEl.viewBox && svgEl.viewBox.baseVal) {
            svgWidth = svgEl.viewBox.baseVal.width;
            svgHeight = svgEl.viewBox.baseVal.height;
        } else if (svgEl.width && svgEl.height) {
            svgWidth = svgEl.width.baseVal?.value || 100;
            svgHeight = svgEl.height.baseVal?.value || 100;
        }

        // Calculate scaled dimensions
        const scale = this.spriteWidth / svgWidth;
        this.spriteHeight = Math.round(svgHeight * scale);

        // Convert SVG to image
        const svgString = new XMLSerializer().serializeToString(boardImg.el);
        const img = new Image();
        img.onload = () => {
            this.boardImgCached = img;
            this.drawBoards();
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
    }

    private getCanvasMousePosition(ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        const canvas = ev.currentTarget;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
    }

    private findBoardAt(x: number, y: number) {
        for (let i = this.boards.length - 1; i >= 0; i--) {
            const board = this.boards[i];
            if (x >= board.x && x <= board.x + this.spriteWidth && y >= board.y && y <= board.y + this.spriteHeight) {
                return board;
            }
        }
        return undefined;
    }

    private onCanvasMouseDown(ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        const pos = this.getCanvasMousePosition(ev);
        const board = this.findBoardAt(pos.x, pos.y);
        if (!board) return;

        this.draggingBoard = board;
        this.dragOffsetX = pos.x - board.x;
        this.dragOffsetY = pos.y - board.y;

        // keep dragged board on top
        const idx = this.boards.indexOf(board);
        if (idx >= 0 && idx !== this.boards.length - 1) {
            this.boards.splice(idx, 1);
            this.boards.push(board);
        }
        ev.preventDefault();
    }

    private onCanvasMouseMove(ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        if (!this.draggingBoard) return;
        const pos = this.getCanvasMousePosition(ev);
        const canvas = ev.currentTarget;
        const maxX = canvas.width - this.spriteWidth;
        const maxY = canvas.height - this.spriteHeight;

        this.draggingBoard.x = Math.max(0, Math.min(maxX, pos.x - this.dragOffsetX));
        this.draggingBoard.y = Math.max(0, Math.min(maxY, pos.y - this.dragOffsetY));
        this.drawBoards();
    }

    private onCanvasMouseUp() {
        if (this.draggingBoard) {
            this.draggingBoard = undefined;
        }
    }
}
