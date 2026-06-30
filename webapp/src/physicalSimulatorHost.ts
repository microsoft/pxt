import * as simulator from "./simulator";

const boardWidth = 50;
const boardHeight = 40;
const emissionSourceSize = 32;

export interface SpriteEditableField {
    key: string;
    label: string;
    type: "string" | "number";
    min?: number;
    max?: number;
    integer?: boolean;
}

export abstract class PhysicalSprite {
    name = "";

    constructor(public id: number, public x: number, public y: number, public width: number, public height: number) {
    }

    get centerX() {
        return this.x + this.width / 2;
    }

    get centerY() {
        return this.y + this.height / 2;
    }

    getEditableFields(): SpriteEditableField[] {
        return [{ key: "name", label: "Name", type: "string" }];
    }

    getEditableValue(fieldKey: string): string | number {
        return (this as any)[fieldKey];
    }

    setEditableValue(fieldKey: string, value: string | number): void {
        (this as any)[fieldKey] = value;
    }
}

export class BoardSprite extends PhysicalSprite {
    simulatorId: string = "TBD"
    image: ImageData | undefined = undefined;
    // #define MICROBIT_RADIO_DEFAULT_TX_POWER 6
    transmitPower = 6;
    screenString = "";
    radioFlashUntil = 0;

    constructor(public id: number, public x: number, public y: number) {
        super(id, x, y, boardWidth, boardHeight);
    }

    get radioRadius() {
        return 30 + this.transmitPower * 15;
    }

    override getEditableFields(): SpriteEditableField[] {
        return [
            ...super.getEditableFields(),
        ];
    }
}

export type EmissionSourceType = "light" | "noise" | "heat";

export abstract class EmissionSourceSprite extends PhysicalSprite {
    range = 90;

    constructor(id: number, x: number, y: number) {
        super(id, x, y, emissionSourceSize, emissionSourceSize);
    }

    abstract readonly sourceType: EmissionSourceType;

    override getEditableFields(): SpriteEditableField[] {
        return [
            ...super.getEditableFields(),
            { key: "range", label: "Range", type: "number", min: 10, max: 400, integer: true }
        ];
    }
}

export class LightSourceSprite extends EmissionSourceSprite {
    readonly sourceType = "light" as const;
    luminosity = 100;

    override getEditableFields(): SpriteEditableField[] {
        return [
            ...super.getEditableFields(),
            { key: "luminosity", label: "Luminosity", type: "number", min: 0, max: 1000, integer: true }
        ];
    }
}

export class NoiseSourceSprite extends EmissionSourceSprite {
    readonly sourceType = "noise" as const;
    decibels = 70;

    override getEditableFields(): SpriteEditableField[] {
        return [
            ...super.getEditableFields(),
            { key: "decibels", label: "Noise level (dB)", type: "number", min: 0, max: 200, integer: true }
        ];
    }
}

export class HeatSourceSprite extends EmissionSourceSprite {
    readonly sourceType = "heat" as const;
    temperatureCelsius = 28;

    override getEditableFields(): SpriteEditableField[] {
        return [
            ...super.getEditableFields(),
            { key: "temperatureCelsius", label: "Temperature (C)", type: "number", min: -50, max: 500, integer: true }
        ];
    }
}

export interface PhysicalSimulatorHostOptions {
    onSpritesChanged?: (sprites: PhysicalSprite[]) => void;
}

export class PhysicalSimulatorHost {
    onSpritesChanged?: (sprites: PhysicalSprite[]) => void;
    sprites: PhysicalSprite[] = [];
    private nextSpriteId = 0;
    private nextBoardNameId = 0;
    private nextSourceNameIds: Record<EmissionSourceType, number> = {
        light: 0,
        noise: 0,
        heat: 0,
    };

    get boards() {
        return this.sprites.filter((sprite): sprite is BoardSprite => sprite instanceof BoardSprite);
    }

    constructor(private readonly opts: PhysicalSimulatorHostOptions = {}) {
        this.onSpritesChanged = opts.onSpritesChanged;
    }

    private getFrameIds() { return simulator.driver.getFrameIds()}
    private addSimulatorToSim() { return simulator.driver.addSimulator() }
    private removeFrameById(id: string) { simulator.driver.removeFrameById(id) }
    private postMessageToFrame(id: string, message: any) {
        simulator.driver?.postMessageToFrame(id, message)
    }
    screenshot(id: string) { simulator.driver?.screenshot(id, boardWidth) }

    getNextBoardName() {
        return `board${this.nextBoardNameId}`;
    }

    notifySpritesChanged(): void {
        this.onSpritesChanged?.([...this.sprites]);
    }

    addBoardSprite(x = 100, y = 100): BoardSprite {
        const sprite = new BoardSprite(this.nextSpriteId++, x, y);
        sprite.name = `board${this.nextBoardNameId++}`;
        this.sprites.push(sprite);
        return sprite;
    }

    addEmissionSource(sourceType: EmissionSourceType, x = 100, y = 100): EmissionSourceSprite {
        const id = this.nextSpriteId++;
        let sprite: EmissionSourceSprite | undefined;

        switch (sourceType) {
            case "light":
                sprite = new LightSourceSprite(id, x, y);
                break;
            case "noise":
                sprite = new NoiseSourceSprite(id, x, y);
                break;
            case "heat":
                sprite = new HeatSourceSprite(id, x, y);
                break;
            default:
                throw new Error(`Unknown emission source type: ${sourceType}`);
        }

        if (!sprite) {
            throw new Error(`Unable to create emission source: ${sourceType}`);
        }

        const index = this.nextSourceNameIds[sourceType]++;
        sprite.name = `${sourceType}${index}`;
        this.sprites.push(sprite);
        this.notifySpritesChanged();
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

        this.notifySpritesChanged();
    }

    private setTitle(board: BoardSprite): void {
        if (board.simulatorId) {
            this.postMessageToFrame(board.simulatorId,
                { type: "settitle", title: board.name } as pxsim.SimulatorSetTitleMessage);
        }
    }

    updateBoardProperties(board: BoardSprite): void {
        this.setTitle(board);
        this.notifySpritesChanged();
    }

    addSimulator(x = 100, y = 100, name?: string): BoardSprite {
        const init = this.boards.length === 0;
        const board = this.addBoardSprite(x, y);
        board.name = name || board.name;
        if (init) {
            board.simulatorId = this.getFrameIds()[0];
            this.setTitle(board);
            this.screenshot(board.simulatorId);
            this.notifySpritesChanged();
        } else
            board.simulatorId = this.addSimulatorToSim();
        return board;
    }

    clearSprites(): void {
        const boards = this.boards;
        const firstBoard = boards[0];

        if (!firstBoard && this.sprites.length === 0) return;

        boards.forEach((board, index) => {
            if (index > 0 && board.simulatorId) this.removeFrameById(board.simulatorId);
        });

        this.sprites = firstBoard ? [firstBoard] : [];
        this.nextBoardNameId = this.boards.length;
        this.nextSourceNameIds = {
            light: 0,
            noise: 0,
            heat: 0,
        };
        this.notifySpritesChanged();
    }

    isInRange(sender: BoardSprite | undefined, receiver: BoardSprite): boolean {
        if (!sender) return false;

        const dx = sender.centerX - receiver.centerX;
        const dy = sender.centerY - receiver.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= sender.radioRadius;
    }

    processMessage(msg: pxsim.SimulatorTunnelMessage): void {

        switch (msg.payload.type) {
            case "status": {
                const statusMsg = msg.payload as pxsim.SimulatorStateMessage;
                const board = this.boards.find(candidate => candidate.simulatorId === msg.source);
                if (board && statusMsg.state === "running") {
                    this.setTitle(board);
                    this.screenshot(board.simulatorId);
                    this.notifySpritesChanged();
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
                        this.notifySpritesChanged();
                    }, 100);
                    this.notifySpritesChanged();
                }
                break;
            }
            case "screenshot": {
                const scrMsg = msg.payload as pxsim.SimulatorScreenshotMessage;
                const board = this.boards.find(candidate => candidate.simulatorId === msg.source);
                if (board) {
                    board.image = scrMsg.data;
                }
                this.notifySpritesChanged();
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
                    this.screenshot(board.simulatorId);
                }
                this.notifySpritesChanged();
                break;
            }
        }
    }
}

export { boardHeight, boardWidth, emissionSourceSize };
