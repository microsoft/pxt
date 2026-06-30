import Util = pxt.Util
import * as simulator from "./simulator";

const boardWidth = 50;
const boardHeight = 40;

export class BoardSprite {
    name = "";
    simulatorId: string = "TBD"
    image: ImageData | undefined = undefined;
    // #define MICROBIT_RADIO_DEFAULT_TX_POWER 6
    transmitPower = 6;
    screenString = "";
    radioFlashUntil = 0;

    constructor(public id: number, public x: number, public y: number) {
    }
}

export interface PhysicalSimulatorHostOptions {
    resizeImageData?: (imageData: ImageData, scale: number) => ImageData;
}

export class PhysicalSimulatorHost {
    onBoardsChanged?: (boards: BoardSprite[]) => void;
    boards: BoardSprite[] = [];
    private nextBoardId = 0;

    constructor(private readonly opts: PhysicalSimulatorHostOptions = {}) {
    }

    private getFrameIds() { return simulator.driver.getFrameIds()}
    private addSimulatorToSim() { return simulator.driver.addSimulator() }
    private removeFrameById(id: string) { simulator.driver.removeFrameById(id) }
    private postMessageToFrame(id: string, message: any) {
        simulator.driver?.postMessageToFrame(id, message)
    }
    screenshot(id: string) { simulator.driver?.screenshot(id) }

    getNextBoardName() {
        return `board${this.nextBoardId}`;
    }

    notifyBoardsChanged(): void {
        this.onBoardsChanged?.([...this.boards]);
    }

    addSprite(x = 100, y = 100): BoardSprite {
        const sprite = new BoardSprite(this.nextBoardId, x, y);
        sprite.name = `board${this.nextBoardId}`;
        this.boards.push(sprite);
        this.nextBoardId++;
        return sprite;
    }

    recreateSimulators(): void {
        if (this.boards.length === 0) return;
        const sims = this.getFrameIds();
        this.boards.forEach((board, index) => {
            if (index < sims.length) {
                board.simulatorId = sims[index];
                this.setTitle(board);
                return;
            }
            board.simulatorId = this.addSimulatorToSim();
        });

        this.notifyBoardsChanged();
    }

    private setTitle(board: BoardSprite): void {
        if (board.simulatorId) {
            simulator.driver.postMessageToFrame(board.simulatorId,
                { type: "settitle", title: board.name } as pxsim.SimulatorSetTitleMessage);
        }
    }

    addSimulator(x = 100, y = 100, name?: string): BoardSprite {
        const init = this.boards.length === 0;
        const sprite = this.addSprite(x, y);
        sprite.name = name || sprite.name;
        if (init) {
            sprite.simulatorId = this.getFrameIds()[0];
        } else
            sprite.simulatorId = this.addSimulatorToSim();
        return sprite;
    }

    clearSprites(): void {
        if (this.boards.length <= 1) return;

        this.boards.forEach((board, index) => {
            if (index > 0 && board.simulatorId) this.removeFrameById(board.simulatorId);
        });

        this.boards = [this.boards[0]];
        this.nextBoardId = 1;
        this.notifyBoardsChanged();
    }

    isInRange(sender: BoardSprite | undefined, receiver: BoardSprite): boolean {
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

    processMessage(msg: pxsim.SimulatorTunnelMessage): void {

        switch (msg.payload.type) {
            case "status": {
                const statusMsg = msg.payload as pxsim.SimulatorStateMessage;
                const board = this.boards.find(candidate => candidate.simulatorId === msg.source);
                if (board && statusMsg.state === "running") {
                    this.setTitle(board);
                    this.screenshot(board.simulatorId);
                    this.notifyBoardsChanged();
                }
                break
            }
            case "radiopacket": {
                const radioMsg = msg.payload as pxsim.SimulatorRadioPacketMessage;
                const sender = this.boards.find(board => board.simulatorId === msg.source);
                const receivers = this.boards.filter(receiver =>
                    receiver.simulatorId !== sender?.simulatorId && this.isInRange(sender, receiver)
                );

                receivers.forEach(receiver => {
                    // TODO: Compute signal strength from distance and transmit power.
                    radioMsg.rssi = -30;
                    if (receiver.simulatorId) this.postMessageToFrame(receiver.simulatorId, radioMsg);
                });

                if (sender) {
                    sender.radioFlashUntil = Date.now() + 100;
                    setTimeout(() => {
                        sender.radioFlashUntil = 0;
                        this.notifyBoardsChanged();
                    }, 100);
                    this.notifyBoardsChanged();
                }
                break;
            }
            case "screenshot": {
                const scrMsg = msg.payload as pxsim.SimulatorScreenshotMessage;
                const board = this.boards.find(candidate => candidate.simulatorId === msg.source);
                if (board) {
                    if (this.opts.resizeImageData) {
                        const scale = boardWidth / scrMsg.data.width;
                        board.image = this.opts.resizeImageData(scrMsg.data, scale);
                    } else {
                        board.image = scrMsg.data;
                    }
                }
                this.notifyBoardsChanged();
                break;
            }
            case "output": {
                const outMsg = msg.payload as pxsim.SimulatorOutputMessage;
                const board = this.boards.find(candidate => candidate.simulatorId === msg.source);
                if (board) {
                    if (outMsg.function === "basic.showString") {
                        board.screenString = outMsg.args[0] as string;
                    }
                    else if (outMsg.function === "radio.setTransmitPower") {
                        board.transmitPower = outMsg.args[0] as number;
                    }
                }
                this.notifyBoardsChanged();
                break;
            }
        }
    }
}

export { boardHeight, boardWidth };
