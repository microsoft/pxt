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

// - when we recreate sims, they disappear after a few seconds!
// X need to handle entry into the sim from GUI
// X keep the sprites and simulators in sync when adding/clearing boards
//   X right now, the correspondence is based on order, which is brittle; 
//     we should add an ID to the simulator and keep track of it in the sprite
// - add a way to remove individual boards
// - add a way to rename boards
// - plumbing between simdriver and physical simulator (via psim-tunnel message
//.  - we can make a direct call to simdriver to send a message to one of the sims (or all)
//.  - but if we need a response from a direct call, we need to make sure that response is 
//     tunneled through to the psim
// - when we receive message from the simulator, update the corresponding board's sprite
//   - on sending a radio message, do an animation around the sprite of the sending board

class BoardSprite {
    private _name: string = "";
    private _simulatorId: string | undefined;
    private _image: ImageData | undefined = undefined
    constructor(public id: number, public x: number, public y: number) {

    }

    set name(n: string) {
        this._name = n;
    }
    get name() {
        return this._name;
    }
    set image(i: ImageData) {
        this._image = i;
    }
    get image(): ImageData | undefined {
        return this._image;
    }
    set simulatorId(id: string | undefined) {
        this._simulatorId = id;
    }
    get simulatorId() {
        return this._simulatorId;
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
        this.domUpdate();
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

        // TODO
    }

    processMessage(msg: pxsim.SimulatorTunnelMessage) {
        if (!this.isVisible) return;
        switch(msg.payload.type) {
            case "radiopacket":
                // 1. some sort of animation to show send of message 
                // 2. determine which sim sprites "hear" the message
                // 3. post to each of the associated sim
                break
            case "screenshot":
                const scrMsg = msg.payload as pxsim.SimulatorScreenshotMessage
                const simSprite = this.boards.find(board => board.simulatorId === msg.source)
                if (simSprite) simSprite.image = scrMsg.data
                this.domUpdate()
                break
        }
    }

    clear() { }

    goBack() {
        pxt.tickEvent("serial.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    private addSprite() {
        // Create a new board sprite with random position
        const canvas = document.getElementById("simulatorCanvas") as HTMLCanvasElement
        const x = canvas ? Math.random() * (canvas.width - 40) : 100 ;
        const y = canvas ? Math.random() * (canvas.height - 40) : 100 ;
        const sprite = new BoardSprite(this.nextBoardId, x, y);
        sprite.name = `board${this.nextBoardId}`;
        this.boards.push(sprite);
        this.nextBoardId++;
        this.drawBoards();
        return sprite
    }

     recreateSimulators() {
        const sims = simulator.driver.getFrameIds();
        if (sims.length > 0 && this.boards.length == 0) {
            const firstBoard = this.addSprite(); // add the default board if we don't have any
            firstBoard!.simulatorId = sims[0];
        }
        this.boards.forEach((board, index) => {
            if (index < sims.length) {
                board.simulatorId = sims[index];
                // update
                return;
            } else {
                board.simulatorId = simulator.driver.addSimulator()
            }
        })
    }

    addSimulator() {
        pxt.tickEvent("serial.newBoardButton", undefined, { interactiveConsent: true })
        const sprite = this.addSprite();
        sprite.simulatorId = simulator.driver.addSimulator();
    }

    clearSprites() {
        pxt.tickEvent("serial.clearBoardsButton", undefined, { interactiveConsent: true })
        if (this.boards.length <= 1) return;
        this.boards.forEach((board,index) => {
            if (index > 0) simulator.driver.removeFrameById(board.simulatorId)
        })
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

        // Draw each board
        const squareSize = 40;
        this.boards.forEach((board) => {
            if (board.image) {
                // ctx.drawImage()
                const boardWidth = 40
                const boardHeight = 40 * (board.image.height / board.image.width)
                ctx.putImageData(board.image, board.x, board.y, 0, 0, boardWidth, boardHeight)
            } else {
                // Draw black square
                ctx.fillStyle = "#000000";
                ctx.fillRect(board.x, board.y, squareSize, squareSize);

                // Draw label text
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(board.name, board.x + squareSize / 2, board.y + squareSize / 2);
                simulator.driver?.screenshot(board.simulatorId)
            }
        });
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
        const squareSize = 40;
        for (let i = this.boards.length - 1; i >= 0; i--) {
            const board = this.boards[i];
            if (x >= board.x && x <= board.x + squareSize && y >= board.y && y <= board.y + squareSize) {
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
        const squareSize = 40;
        const maxX = canvas.width - squareSize;
        const maxY = canvas.height - squareSize;

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
