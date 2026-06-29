const boardWidth = 50;
const boardHeight = 40;

export class BoardSprite {
    name = "";
    simulatorId: string | undefined;
    image: ImageData | undefined = undefined;
    // #define MICROBIT_RADIO_DEFAULT_TX_POWER 6
    transmitPower = 6;
    screenString = "";
    radioFlashUntil = 0;

    constructor(public id: number, public x: number, public y: number) {
    }
}

export interface PhysicalSimulatorHostOptions {
    getFrameIds?: () => string[];
    addSimulator?: () => string | undefined;
    removeFrameById?: (id: string) => void;
    screenshot?: (id: string) => void;
    postMessageToFrame?: (id: string, message: any) => void;
    resizeImageData?: (imageData: ImageData, scale: number) => ImageData;
    setTimeout?: (handler: () => void, timeoutMs: number) => void;
    now?: () => number;
}

export class PhysicalSimulatorHost {
    onBoardsChanged?: (boards: BoardSprite[]) => void;
    boards: BoardSprite[] = [];
    nextBoardId = 0;

    constructor(private readonly opts: PhysicalSimulatorHostOptions = {}) {
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
        const sims = this.opts.getFrameIds?.() || [];
        if (sims.length > 0 && this.boards.length === 0) {
            const firstBoard = this.addSprite();
            firstBoard.simulatorId = sims[0];
        }

        this.boards.forEach((board, index) => {
            if (index < sims.length) {
                board.simulatorId = sims[index];
                if (board.simulatorId) this.opts.screenshot?.(board.simulatorId);
                return;
            }
            board.simulatorId = this.opts.addSimulator?.();
        });

        this.notifyBoardsChanged();
    }

    addSimulator(x = 100, y = 100): BoardSprite {
        const sprite = this.addSprite(x, y);
        sprite.simulatorId = this.opts.addSimulator?.();
        this.notifyBoardsChanged();
        if (sprite.simulatorId) this.opts.screenshot?.(sprite.simulatorId);
        return sprite;
    }

    clearSprites(): void {
        if (this.boards.length <= 1) return;

        this.boards.forEach((board, index) => {
            if (index > 0 && board.simulatorId) this.opts.removeFrameById?.(board.simulatorId);
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
            case "radiopacket": {
                const radioMsg = msg.payload as pxsim.SimulatorRadioPacketMessage;
                const sender = this.boards.find(board => board.simulatorId === msg.source);
                const receivers = this.boards.filter(receiver =>
                    receiver.simulatorId !== sender?.simulatorId && this.isInRange(sender, receiver)
                );

                receivers.forEach(receiver => {
                    // TODO: Compute signal strength from distance and transmit power.
                    radioMsg.rssi = -30;
                    if (receiver.simulatorId) this.opts.postMessageToFrame?.(receiver.simulatorId, radioMsg);
                });

                if (sender) {
                    sender.radioFlashUntil = (this.opts.now || Date.now)() + 100;
                    const schedule = this.opts.setTimeout || ((handler: () => void, timeoutMs: number) => setTimeout(handler, timeoutMs));
                    schedule(() => {
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
