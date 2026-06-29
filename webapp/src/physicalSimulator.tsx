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

// - add a way to remove individual boards
// - add a way to rename boards
// - when we receive message from the simulator, update the corresponding board's sprite
//   - on sending a radio message, do an animation around the sprite of the sending board
//   - determine which boards are in range of the message and update their sprites accordingly

class BoardSprite {
    name: string = "";
    simulatorId: string | undefined;
    image: ImageData | undefined = undefined
    // #define MICROBIT_RADIO_DEFAULT_TX_POWER         6
    // TODO: we can use this to determine which boards are in range of each other for radio messages
    transmitPower: number = 6
    // TODO: show the string above the board sprite
    screenString: string = ""
    constructor(public id: number, public x: number, public y: number) {

    }
    radioFlashUntil: number = 0;
}

const boardWidth = 50
const boardHeight = 40
export class PhysicalSimulator extends srceditor.Editor {
    canvasRef = React.createRef<HTMLCanvasElement>();
    onBoardsChanged?: (boards: BoardSprite[]) => void;
    isVisible = false;
    active: boolean = true
    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;

    boards: BoardSprite[] = [];
    nextBoardId: number = 0;

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
    }

    processEvent(ev: MessageEvent) {

    }

    isInRange(sender: BoardSprite | undefined, receiver: BoardSprite) {
        if (!sender) return false;
        const senderX = sender.x + boardWidth / 2;
        const senderY = sender.y + boardHeight / 2;
        const receiverX = receiver.x + boardWidth / 2;
        const receiverY = receiver.y + boardHeight / 2;
        const dx = senderX - receiverX;
        const dy = senderY - receiverY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const senderRadius = 30 + sender.transmitPower * 15;
        return distance <= senderRadius;
    }

    processMessage(msg: pxsim.SimulatorTunnelMessage) {
        if (!this.isVisible) return;
        switch(msg.payload.type) {
            case "radiopacket":
                const radioMsg = msg.payload as pxsim.SimulatorRadioPacketMessage
                const sender = this.boards.find(board => board.simulatorId === msg.source)
                const receivers =
                    this.boards.filter(receiver => receiver.simulatorId !== sender?.simulatorId && this.isInRange(sender, receiver))
                receivers.forEach(receiver => {
                    // TODO: compute the signal strength based on distance and transmit power
                    // TODO: The value is measured in -dbm. The higher the value, the stronger the signal.
                    // TODO: Typical values are in the range -42 to -128.
                    radioMsg.rssi =  -30;
                    simulator.driver?.postMessageToFrame(receiver.simulatorId, radioMsg)
                });
                if (sender) {
                    sender.radioFlashUntil = Date.now() + 100;
                    setTimeout(() => { sender.radioFlashUntil = 0; this.domUpdate(); }, 100);
                    this.domUpdate();
                }
                break
            case "screenshot":
                const scrMsg = msg.payload as pxsim.SimulatorScreenshotMessage
                const simSprite = this.boards.find(board => board.simulatorId === msg.source)
                const scale = boardWidth / scrMsg.data.width
                if (simSprite) simSprite.image = this.resizeImageData(scrMsg.data, scale)
                this.domUpdate()
                break
            case "output":
                const outMsg = msg.payload as pxsim.SimulatorOutputMessage
                const simSprite2 = this.boards.find(board => board.simulatorId === msg.source)
                if (simSprite2) {
                    // this could be done in a more generic way, 
                    // but for now we just handle the two cases we care about
                    if (outMsg.function === "basic.showString") {
                        simSprite2.screenString = outMsg.args[0] as string
                        // console.log(`PSIM: ${simSprite2.name} shows string: ${simSprite2.screenString}`)
                    } else if (outMsg.function === "radio.setTransmitPower") {
                        simSprite2.transmitPower = outMsg.args[0] as number
                        // console.log(`PSIM: ${simSprite2.name} sets transmit power: ${simSprite2.transmitPower}`)
                    }
                }
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
        const canvas = this.canvasRef.current;
        const x = canvas ? Math.random() * (canvas.width - 40) : 100 ;
        const y = canvas ? Math.random() * (canvas.height - 40) : 100 ;
        const sprite = new BoardSprite(this.nextBoardId, x, y);
        sprite.name = `board${this.nextBoardId}`;
        this.boards.push(sprite);
        this.nextBoardId++;
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
                simulator.driver?.screenshot(board.simulatorId)
                return;
            } else {
                board.simulatorId = simulator.driver.addSimulator()
            }
        })
        this.notifyBoardsChanged();
    }

    addSimulator() {
        pxt.tickEvent("serial.newBoardButton", undefined, { interactiveConsent: true })
        const sprite = this.addSprite();
        sprite.simulatorId = simulator.driver.addSimulator();
        this.notifyBoardsChanged();
        simulator.driver?.screenshot(sprite.simulatorId)
    }

    clearSprites() {
        pxt.tickEvent("serial.clearBoardsButton", undefined, { interactiveConsent: true })
        if (this.boards.length <= 1) return;
        this.boards.forEach((board,index) => {
            if (index > 0 && board.simulatorId) simulator.driver.removeFrameById(board.simulatorId)
        })
        this.boards = [this.boards[0]];
        this.nextBoardId = 1;
        this.notifyBoardsChanged();
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
                    <PhysicalSimulatorCanvas simulator={this} />
                </div>
            </div>
        )
    }

    notifyBoardsChanged() {
        this.onBoardsChanged?.([...this.boards]);
    }

    domUpdate() {
        this.notifyBoardsChanged();
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

}

interface PhysicalSimulatorCanvasProps {
    simulator: PhysicalSimulator;
}

const PhysicalSimulatorCanvas: React.FC<PhysicalSimulatorCanvasProps> = ({ simulator: psim }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [boards, setBoards] = React.useState<BoardSprite[]>(() => [...psim.boards]);
    const draggingBoard = React.useRef<BoardSprite | undefined>(undefined);
    const dragOffsetX = React.useRef(0);
    const dragOffsetY = React.useRef(0);

    const getCanvasMousePosition = (ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        const canvas = ev.currentTarget;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
    };

    const findBoardAt = (x: number, y: number) => {
        const squareSize = 40;
        for (let i = psim.boards.length - 1; i >= 0; i--) {
            const board = psim.boards[i];
            if (x >= board.x && x <= board.x + squareSize && y >= board.y && y <= board.y + squareSize) {
                return board;
            }
        }
        return undefined;
    };

    const onCanvasMouseDown = (ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        const pos = getCanvasMousePosition(ev);
        const board = findBoardAt(pos.x, pos.y);
        if (!board) return;

        draggingBoard.current = board;
        dragOffsetX.current = pos.x - board.x;
        dragOffsetY.current = pos.y - board.y;

        // keep dragged board on top
        const idx = psim.boards.indexOf(board);
        if (idx >= 0 && idx !== psim.boards.length - 1) {
            psim.boards.splice(idx, 1);
            psim.boards.push(board);
        }
        ev.preventDefault();
    };

    const onCanvasMouseMove = (ev: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!draggingBoard.current) return;
        const pos = getCanvasMousePosition(ev);
        const canvas = ev.currentTarget;
        const maxX = canvas.width - boardWidth;
        const maxY = canvas.height - boardHeight;

        draggingBoard.current.x = Math.max(0, Math.min(maxX, pos.x - dragOffsetX.current));
        draggingBoard.current.y = Math.max(0, Math.min(maxY, pos.y - dragOffsetY.current));
        psim.notifyBoardsChanged();
    };

    const onCanvasMouseUp = () => {
        draggingBoard.current = undefined;
    };

    // Keep psim.canvasRef in sync so addSprite() can read canvas dimensions
    React.useEffect(() => {
        (psim.canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvasRef.current;
    });

    // Subscribe to board changes from the class
    React.useEffect(() => {
        psim.onBoardsChanged = setBoards;
        // Sync state immediately in case boards were updated before mount
        setBoards([...psim.boards]);
        return () => { psim.onBoardsChanged = undefined; };
    }, [psim]);

    // Redraw the canvas whenever the board list changes
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        boards.forEach((board) => {
            const centerX = board.x + boardWidth / 2;
            const centerY = board.y + boardHeight / 2;

            // Draw transmit-power radius circle (power 0–7 maps to 30–135 px)
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
                if (board.simulatorId) simulator.driver?.screenshot(board.simulatorId);
            }
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(board.name, centerX, board.y - 10);
        });
    }, [boards]);

    return (
        <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%" }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
        />
    );
}
