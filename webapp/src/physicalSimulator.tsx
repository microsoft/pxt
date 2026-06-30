/// <reference path="../../localtypings/pxtparts.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts" />


import * as React from "react"
import * as pkg from "./package"
import * as core from "./core"
import * as sui from "./sui"
import * as srceditor from "./srceditor"
import { fireClickOnEnter } from "./util"
import IProjectView = pxt.editor.IProjectView;
import { BoardSprite, boardHeight, boardWidth, PhysicalSimulatorHost } from "./physicalSimulatorHost";


// BUGS
// - boards appear out of order

// TODOs:
// - add a way to remove individual boards
// - add a way to rename boards
// - when we receive message from the simulator, update the corresponding board's sprite
//   - on sending a radio message, do an animation around the sprite of the sending board
//   - determine which boards are in range of the message and update their sprites accordingly

export class PhysicalSimulator extends srceditor.Editor {
    canvasRef: HTMLCanvasElement | undefined;
    draggingBoard: BoardSprite | undefined;
    dragOffsetX: number;
    dragOffsetY: number;
    isVisible = false;
    active: boolean = true
    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;
    host: PhysicalSimulatorHost;

    get boards() {
        return this.host.boards;
    }

    get onBoardsChanged() {
        return this.host.onBoardsChanged;
    }

    set onBoardsChanged(handler: ((boards: BoardSprite[]) => void) | undefined) {
        this.host.onBoardsChanged = handler;
    }

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

    // this is called when the editor is opened, 
    // but before the file is loaded
    setVisible(b: boolean) {
        // TODO: It'd be great to re-render this component dynamically when the contrast changes,
        // TODO: but for now the user has to toggle the serial editor to see a change.
        const highContrast = core.getHighContrastOnce();
        if (highContrast !== this.highContrast) {
            this.setHighContrast(highContrast)
        }
        this.isVisible = b;
        if (b) {
            this.recreateSimulators();
        } else {
            console.log(`PSIM: Visible = false`)
        }
        this.notifyBoardsChanged();
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

    simStateChanged() {    }

    constructor(public parent: IProjectView) {
        super(parent);
        this.host = new PhysicalSimulatorHost({
            resizeImageData: (imageData, scale) => this.resizeImageData(imageData, scale),
        });
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.addSimulator = this.addSimulator.bind(this);
        this.clearSprites = this.clearSprites.bind(this);

        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
    }

    processEvent(ev: MessageEvent) {

    }

    processMessage(msg: pxsim.SimulatorTunnelMessage) {
        if (!this.isVisible) return;
        this.host.processMessage(msg);
    }

    clear() { }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    recreateSimulators() {
        this.host.recreateSimulators();
    }

    async addSimulator() {
        pxt.tickEvent("serial.newBoardButton", undefined, { interactiveConsent: true })
        const name = await core.promptAsync({
            header: lf("Name your simulator"),
            agreeLbl: lf("Add simulator"),
            agreeClass: "green",
            initialValue: this.host.getNextBoardName(),
            placeholder: lf("Enter a simulator name")
        });

        if (name === null) return;

        const canvas = this.canvasRef;
        const x = canvas ? Math.random() * (canvas.width - 40) : 100;
        const y = canvas ? Math.random() * (canvas.height - 40) : 100;
        this.host.addSimulator(x, y, name.trim() || undefined);
        this.notifyBoardsChanged();
    }

    clearSprites() {
      this.host.clearSprites();
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
                    <canvas ref={this.handleCanvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
                </div>
            </div>
        )
    }

    notifyBoardsChanged() {
        this.host.notifyBoardsChanged();
    }

    private resizeImageData(imageData: ImageData, scale: number) {
        // Create source canvas
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = imageData.width;
        srcCanvas.height = imageData.height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) return imageData;
        srcCtx.putImageData(imageData, 0, 0);

        // Create destination canvas
        const destCanvas = document.createElement('canvas');
        const newWidth = destCanvas.width = imageData.width * scale;
        const newHeight = destCanvas.height = imageData.height * scale;
        const destCtx = destCanvas.getContext('2d');
        if (!destCtx) return imageData;

        destCtx.imageSmoothingEnabled = true

        // Draw scaled image
        destCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);

        // Return resized ImageData
        return destCtx.getImageData(0, 0, newWidth, newHeight);
    }

    drawBoards() {
        this.notifyBoardsChanged();
    }

    handleCanvasRef = (c: HTMLCanvasElement | null) => {
        if (this.canvasRef === c) return;

        if (this.canvasRef) {
            this.detachCanvasListeners(this.canvasRef);
        }

        this.canvasRef = c || undefined;

        if (this.canvasRef) {
            this.host.onBoardsChanged = this.handleBoardsChanged;
            this.attachCanvasListeners(this.canvasRef);
            this.redrawCanvas();
        } else if (this.host.onBoardsChanged === this.handleBoardsChanged) {
            this.host.onBoardsChanged = undefined;
        }
    }

    private attachCanvasListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener("mousedown", this.onCanvasMouseDown);
        canvas.addEventListener("mousemove", this.onCanvasMouseMove);
        canvas.addEventListener("mouseup", this.onCanvasMouseUp);
        canvas.addEventListener("mouseleave", this.onCanvasMouseUp);
        window.addEventListener("resize", this.redrawCanvas);
    }

    private detachCanvasListeners(canvas: HTMLCanvasElement) {
        canvas.removeEventListener("mousedown", this.onCanvasMouseDown);
        canvas.removeEventListener("mousemove", this.onCanvasMouseMove);
        canvas.removeEventListener("mouseup", this.onCanvasMouseUp);
        canvas.removeEventListener("mouseleave", this.onCanvasMouseUp);
        window.removeEventListener("resize", this.redrawCanvas);
    }

    private handleBoardsChanged = (_boards: BoardSprite[]) => {
        this.redrawCanvas();
    }

    private getCanvasMousePosition(ev: MouseEvent, canvas: HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
    }

    private findBoardAt(x: number, y: number) {
        for (let i = this.boards.length - 1; i >= 0; i--) {
            const board = this.boards[i];
            if (x >= board.x && x <= board.x + boardWidth && y >= board.y && y <= board.y + boardHeight) {
                return board;
            }
        }
        return undefined;
    }

    private onCanvasMouseDown = (ev: MouseEvent) => {
        const canvas = this.canvasRef;
        if (!canvas) return;

        const pos = this.getCanvasMousePosition(ev, canvas);
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

    private onCanvasMouseMove = (ev: MouseEvent) => {
        const canvas = this.canvasRef;
        if (!canvas || !this.draggingBoard) return;

        const pos = this.getCanvasMousePosition(ev, canvas);
        const maxX = canvas.width - boardWidth;
        const maxY = canvas.height - boardHeight;

        this.draggingBoard.x = Math.max(0, Math.min(maxX, pos.x - this.dragOffsetX));
        this.draggingBoard.y = Math.max(0, Math.min(maxY, pos.y - this.dragOffsetY));
        this.notifyBoardsChanged();
    }

    private onCanvasMouseUp = (_ev: MouseEvent) => {
        this.draggingBoard = undefined;
    }

    private redrawCanvas = () => {
        const canvas = this.canvasRef;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.boards.forEach((board) => {
            const centerX = board.x + boardWidth / 2;
            const centerY = board.y + boardHeight / 2;

            // Draw transmit-power radius circle (power 0-7 maps to 30-135 px)
            const radius = 30 + board.transmitPower * 15;
            const isFlashing = board.radioFlashUntil > Date.now();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = isFlashing ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 100, 0.6)";
            ctx.lineWidth = isFlashing ? 3 : 2;
            ctx.stroke();
            ctx.fillStyle = isFlashing ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 100, 0.08)";
            ctx.fill();

            if (board.image) {
                ctx.putImageData(board.image, board.x, board.y);
            } else {
                ctx.fillStyle = "#000000";
                ctx.fillRect(board.x, board.y, boardWidth, boardHeight);
                // if (board.simulatorId) simulator.driver?.screenshot(board.simulatorId);
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(board.name, centerX, board.y - 10);
        });
    }

}
