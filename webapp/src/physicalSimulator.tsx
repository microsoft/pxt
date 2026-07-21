/// <reference path="../../localtypings/pxtparts.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts" />

import * as pkg from "./package"
import * as core from "./core"
import * as sui from "./sui"
import * as srceditor from "./srceditor"
import * as workspace from "./workspace"
import { fireClickOnEnter } from "./util"
import IProjectView = pxt.editor.IProjectView;
import {
    BoardSprite,
    boardHeight,
    boardWidth,
    EmissionSourceSprite,
    EmissionSourceType,
    HeatSourceSprite,
    LightSourceSprite,
    NoiseSourceSprite,
    PhysicalSimulatorHost,
    PhysicalSprite,
    SpriteEditableField,
} from "./physicalSimulatorHost";


// BUGS
// - boards appear out of order (debug this)
// - focus on simulator doesn't work (debug this)
// TODOs:
// - sending sensor readings into a sim based on emission sources (light, sound, heat) and distance from the source
//    - need to handle the value and events that might be raised by the sensor, especially the accelerometer, so as
//      to keep the sim in sync with the physical simulator state
//    - pxt/pxt-microbit/sim/state
//      - accelerometer.ts
//      - thermometer.ts: instrument temperature() to return a value based on the distance from heat sources and their intensity
//      - microphone.ts: instrument soundLevel() to return a value based on the distance from noise sources and their intensity
//      - lightsensor.ts: instrument lightLevel() to return a value based on the distance light sources and their intensity
//          - the simple case of just returning a value can be done by instrumenting the lightLevel() function to return a 
//            value based on the distance from light sources and their intensity; in this case, we are taking over control 
//            of the lightLevel() function and not using the light sensor state in the sim, so we need to make sure that
//            the sim is not using the light sensor state and perhaps remove the the GUI controls for the light sensor in the sim, 
//            since they won't be in sync with the physical simulator state
//          - to handle events, it would be best if it just worked by instrumenting the lightLevel() function 
// - add "delete" option to board dialog
// - move PhysicalSimulatorHost to out of the webapp so it can be used via the CLI
// - disable the sim sensor controls when the physical simulator is open, since they won't be in sync with the physical simulator state
//     in particular, light/temperature/sound
// - more realistic physical simulation and realistic distance metrics on playground 
//   - inverse square law for light and sound
// - showing the serial output of each board somehow... (maybe a bubble, or simple text output in a pane)

// ICING
// - when we receive message from the simulator, update the corresponding board's sprite
//   - on sending a radio message, do an animation around the sprite of the sending board
//   - determine which boards are in range of the message and update their sprites accordingly


export class PhysicalSimulator extends srceditor.Editor {
    canvasRef: HTMLCanvasElement | undefined;
    draggingSprite: PhysicalSprite | undefined;
    dragOffsetX: number;
    dragOffsetY: number;
    isVisible = false;
    active: boolean = true
    lineColors: string[];
    hcLineColors: string[];
    currentLineColors: string[];
    highContrast?: boolean = false;
    host: PhysicalSimulatorHost;

    get sprites() {
        return this.host.sprites;
    }

    get boards() {
        return this.host.boards;
    }

    get onSpritesChanged() {
        return this.host.onSpritesChanged;
    }

    set onSpritesChanged(handler: ((sprites: PhysicalSprite[]) => void) | undefined) {
        this.host.onSpritesChanged = handler;
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
        this.notifySpritesChanged();
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
        this.host = new PhysicalSimulatorHost({});
        window.addEventListener("message", this.processEvent.bind(this), false)
        const serialTheme = pxt.appTarget.serial && pxt.appTarget.serial.editorTheme;
        this.lineColors = (serialTheme && serialTheme.lineColors) || ["#e00", "#00e", "#0e0"];
        this.hcLineColors = ["#000"];
        this.currentLineColors = this.lineColors;

        this.goBack = this.goBack.bind(this);
        this.addSimulator = this.addSimulator.bind(this);
        this.addLightSource = this.addLightSource.bind(this);
        this.addNoiseSource = this.addNoiseSource.bind(this);
        this.addHeatSource = this.addHeatSource.bind(this);
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
        const board = await this.promptForBoardInfoAsync();
        if (!board) return;

        const canvas = this.canvasRef;
        const x = canvas ? Math.random() * (canvas.width - 40) : 100;
        const y = canvas ? Math.random() * (canvas.height - 40) : 100;
        this.host.addSimulator(x, y, board.name, board.projectHeaderId);
        this.notifySpritesChanged();
    }

    private async promptForBoardInfoAsync(): Promise<{ name: string; projectHeaderId?: string } | undefined> {
        const defaultName = this.host.getNextBoardName();
        const projectOptions = workspace.getHeaders()
            .filter(header => !header.isDeleted)
            .sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));

        let name = defaultName;
        let selectedProjectHeaderId: string | undefined = projectOptions[0]?.id;
        let applied = false;

        await core.dialogAsync({
            header: lf("Add simulator board"),
            jsx: <div className="ui form">
                <sui.Input
                    id="projectBoardNameInput"
                    label={lf("Board name")}
                    value={name}
                    autoComplete={false}
                    placeholder={lf("Enter a simulator name")}
                    onChange={v => name = v}
                    autoFocus
                />
                <div className="field">
                    <label>{lf("Project")}</label>
                    <select
                        className="ui dropdown"
                        defaultValue={selectedProjectHeaderId || ""}
                        onChange={e => selectedProjectHeaderId = e.currentTarget.value || undefined}
                        aria-label={lf("Project")}
                    >
                        <option value="">{lf("Default")}</option>
                        {projectOptions.map(project =>
                            <option key={project.id} value={project.id}>{project.name || lf("Untitled")}</option>
                        )}
                    </select>
                </div>
            </div>,
            buttons: [{
                label: lf("Add simulator"),
                className: "approve positive",
                icon: "check",
                onclick: () => {
                    name = (name || "").trim() || defaultName;
                    applied = true;
                }
            }]
        });

        if (!applied) return undefined;

        return {
            name,
            projectHeaderId: selectedProjectHeaderId
        };
    }

    addLightSource() {
        this.addEmissionSource("light");
    }

    addNoiseSource() {
        this.addEmissionSource("noise");
    }

    addHeatSource() {
        this.addEmissionSource("heat");
    }

    private addEmissionSource(sourceType: EmissionSourceType) {
        const canvas = this.canvasRef;
        const x = canvas ? Math.random() * (canvas.width - 40) : 100;
        const y = canvas ? Math.random() * (canvas.height - 40) : 100;
        this.host.addEmissionSource(sourceType, x, y);
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
                            <sui.DropdownMenu title={lf("Add sprite")} icon="add circle" className="button neutral" role="menuitem" closeOnItemClick={true}>
                                <sui.Item role="menuitem" icon="microchip" text={lf("Simulator board")} onClick={this.addSimulator} />
                                <sui.Item role="menuitem" icon="lightbulb" text={lf("Light source")} onClick={this.addLightSource} />
                                <sui.Item role="menuitem" icon="volume up" text={lf("Noise source")} onClick={this.addNoiseSource} />
                                <sui.Item role="menuitem" icon="thermometer half" text={lf("Heat source")} onClick={this.addHeatSource} />
                            </sui.DropdownMenu>
                            <sui.Button title={lf("Clear all but first board and remove sources")} tabIndex={0} onClick={this.clearSprites} onKeyDown={fireClickOnEnter} className="neutral">
                                <sui.Icon icon="trash" />
                                <span className="ui text landscape only">{lf("Clear extra sprites")}</span>
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

    notifySpritesChanged() {
        this.host.notifySpritesChanged();
    }

    drawBoards() {
        this.notifySpritesChanged();
    }

    handleCanvasRef = (c: HTMLCanvasElement | null) => {
        if (this.canvasRef === c) return;

        if (this.canvasRef) {
            this.detachCanvasListeners(this.canvasRef);
        }

        this.canvasRef = c || undefined;

        if (this.canvasRef) {
            this.host.onSpritesChanged = this.handleSpritesChanged;
            this.attachCanvasListeners(this.canvasRef);
            this.redrawCanvas();
        } else if (this.host.onSpritesChanged === this.handleSpritesChanged) {
            this.host.onSpritesChanged = undefined;
        }
    }

    private attachCanvasListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener("mousedown", this.onCanvasMouseDown);
        canvas.addEventListener("mousemove", this.onCanvasMouseMove);
        canvas.addEventListener("mouseup", this.onCanvasMouseUp);
        canvas.addEventListener("mouseleave", this.onCanvasMouseUp);
        canvas.addEventListener("dblclick", this.onCanvasDoubleClick);
        window.addEventListener("resize", this.redrawCanvas);
    }

    private detachCanvasListeners(canvas: HTMLCanvasElement) {
        canvas.removeEventListener("mousedown", this.onCanvasMouseDown);
        canvas.removeEventListener("mousemove", this.onCanvasMouseMove);
        canvas.removeEventListener("mouseup", this.onCanvasMouseUp);
        canvas.removeEventListener("mouseleave", this.onCanvasMouseUp);
        canvas.removeEventListener("dblclick", this.onCanvasDoubleClick);
        window.removeEventListener("resize", this.redrawCanvas);
    }

    private handleSpritesChanged = (_sprites: PhysicalSprite[]) => {
        this.redrawCanvas();
    }

    private getCanvasMousePosition(ev: MouseEvent, canvas: HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
    }

    private findSpriteAt(x: number, y: number) {
        for (let i = this.sprites.length - 1; i >= 0; i--) {
            const sprite = this.sprites[i];
            if (x >= sprite.x && x <= sprite.x + sprite.width && y >= sprite.y && y <= sprite.y + sprite.height) {
                return sprite;
            }
        }
        return undefined;
    }

    private onCanvasMouseDown = (ev: MouseEvent) => {
        const canvas = this.canvasRef;
        if (!canvas) return;

        const pos = this.getCanvasMousePosition(ev, canvas);
        const sprite = this.findSpriteAt(pos.x, pos.y);
        if (!sprite) return;

        this.draggingSprite = sprite;
        this.dragOffsetX = pos.x - sprite.x;
        this.dragOffsetY = pos.y - sprite.y;

        // keep dragged sprite on top
        const idx = this.sprites.indexOf(sprite);
        if (idx >= 0 && idx !== this.sprites.length - 1) {
            this.sprites.splice(idx, 1);
            this.sprites.push(sprite);
        }

        ev.preventDefault();
    }

    private onCanvasMouseMove = (ev: MouseEvent) => {
        const canvas = this.canvasRef;
        if (!canvas || !this.draggingSprite) return;

        const pos = this.getCanvasMousePosition(ev, canvas);
        const maxX = canvas.width - this.draggingSprite.width;
        const maxY = canvas.height - this.draggingSprite.height;

        this.draggingSprite.x = Math.max(0, Math.min(maxX, pos.x - this.dragOffsetX));
        this.draggingSprite.y = Math.max(0, Math.min(maxY, pos.y - this.dragOffsetY));
        this.notifySpritesChanged();
    }

    private onCanvasMouseUp = (_ev: MouseEvent) => {
        this.draggingSprite = undefined;
    }

    private onCanvasDoubleClick = async (ev: MouseEvent) => {
        const canvas = this.canvasRef;
        if (!canvas) return;

        const pos = this.getCanvasMousePosition(ev, canvas);
        const sprite = this.findSpriteAt(pos.x, pos.y);
        if (!sprite) return;

        await this.inspectSprite(sprite);
        ev.preventDefault();
    }

    private async inspectSprite(sprite: PhysicalSprite) {
        const fields = sprite.getEditableFields();
        const values: pxt.Map<string> = {};
        fields.forEach(field => {
            values[field.key] = `${sprite.getEditableValue(field.key)}`;
        });

        let applied = false;
        await core.dialogAsync({
            header: lf("Edit properties"),
            body: lf(""),
            jsx: <div className="ui form">
                {fields.map((field, index) => {
                    const inputId = `sprite-${sprite.id}-field-${field.key}`;
                    return <sui.Input
                        key={field.key}
                        id={inputId}
                        label={field.label}
                        value={values[field.key]}
                        onChange={v => values[field.key] = v}
                        autoFocus={index === 0}
                    />;
                })}
            </div>,
            buttons: [
                {
                    label: lf("Apply"),
                    className: "green",
                    icon: "checkmark",
                    onclick: () => {
                        applied = true;
                    }
                }
            ]
        });

        if (!applied) return;

        this.applyEditableFields(sprite, fields, values);

        if (sprite instanceof BoardSprite) {
            this.host.updateBoardProperties(sprite);
            return;
        }

        this.notifySpritesChanged();
    }

    private applyEditableFields(sprite: PhysicalSprite, fields: SpriteEditableField[], values: pxt.Map<string>) {
        fields.forEach(field => {
            const rawValue = values[field.key];
            if (field.type === "string") {
                const trimmed = (rawValue || "").trim();
                if (trimmed) sprite.setEditableValue(field.key, trimmed);
                return;
            }

            const parsed = field.integer ? parseInt(rawValue, 10) : parseFloat(rawValue);
            if (isNaN(parsed)) return;
            const normalized = this.clampNumber(parsed, field.min, field.max, !!field.integer);
            sprite.setEditableValue(field.key, normalized);
        });
    }

    private clampInteger(value: number, min: number, max: number) {
        return Math.max(min, Math.min(max, Math.round(value)));
    }

    private clampNumber(value: number, min?: number, max?: number, integer?: boolean) {
        const normalized = integer ? Math.round(value) : value;
        const withMin = min === undefined ? normalized : Math.max(min, normalized);
        return max === undefined ? withMin : Math.min(max, withMin);
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

        this.sprites.forEach((sprite) => {
            if (sprite instanceof BoardSprite) {
                this.drawBoardSprite(ctx, sprite);
            } else if (sprite instanceof EmissionSourceSprite) {
                this.drawEmissionSource(ctx, sprite);
            }
        });
    }

    private drawBoardSprite(ctx: CanvasRenderingContext2D, board: BoardSprite) {
        const isFlashing = board.radioFlashUntil > Date.now();
        ctx.beginPath();
        ctx.arc(board.centerX, board.centerY, board.radioRadius, 0, 2 * Math.PI);
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
        }

        this.drawSpriteLabel(ctx, board.name, board.centerX, board.y - 10);
    }

    private drawEmissionSource(ctx: CanvasRenderingContext2D, source: EmissionSourceSprite) {
        ctx.beginPath();
        ctx.arc(source.centerX, source.centerY, source.range, 0, 2 * Math.PI);
        ctx.strokeStyle = this.getSourceStrokeColor(source);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.getSourceFillColor(source);
        ctx.fill();

        if (source instanceof LightSourceSprite) {
            this.drawLightIcon(ctx, source);
        } else if (source instanceof NoiseSourceSprite) {
            this.drawNoiseIcon(ctx, source);
        } else if (source instanceof HeatSourceSprite) {
            this.drawHeatIcon(ctx, source);
        }

        this.drawSpriteLabel(ctx, source.name, source.centerX, source.y - 10);
    }

    private drawSpriteLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    private getSourceStrokeColor(source: EmissionSourceSprite) {
        if (source instanceof LightSourceSprite) return "rgba(255, 245, 140, 0.75)";
        if (source instanceof NoiseSourceSprite) return "rgba(120, 220, 255, 0.75)";
        return "rgba(255, 145, 110, 0.75)";
    }

    private getSourceFillColor(source: EmissionSourceSprite) {
        if (source instanceof LightSourceSprite) return "rgba(255, 245, 140, 0.14)";
        if (source instanceof NoiseSourceSprite) return "rgba(120, 220, 255, 0.14)";
        return "rgba(255, 145, 110, 0.14)";
    }

    private drawLightIcon(ctx: CanvasRenderingContext2D, source: LightSourceSprite) {
        const radius = source.width / 4;

        ctx.fillStyle = "#FFF2A8";
        ctx.beginPath();
        ctx.arc(source.centerX, source.centerY, radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = "#FFFBE6";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(source.centerX + Math.cos(angle) * (radius + 2), source.centerY + Math.sin(angle) * (radius + 2));
            ctx.lineTo(source.centerX + Math.cos(angle) * (radius + 8), source.centerY + Math.sin(angle) * (radius + 8));
            ctx.stroke();
        }
    }

    private drawNoiseIcon(ctx: CanvasRenderingContext2D, source: NoiseSourceSprite) {
        const left = source.x + 6;
        const midY = source.centerY;

        ctx.fillStyle = "#A8ECFF";
        ctx.beginPath();
        ctx.moveTo(left, midY - 5);
        ctx.lineTo(left + 6, midY - 5);
        ctx.lineTo(left + 12, source.y + 8);
        ctx.lineTo(left + 12, source.y + source.height - 8);
        ctx.lineTo(left + 6, midY + 5);
        ctx.lineTo(left, midY + 5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#E8FAFF";
        ctx.lineWidth = 2;
        [4, 8].forEach(offset => {
            ctx.beginPath();
            ctx.arc(source.x + source.width - 10, midY, offset, -Math.PI / 4, Math.PI / 4);
            ctx.stroke();
        });
    }

    private drawHeatIcon(ctx: CanvasRenderingContext2D, source: HeatSourceSprite) {
        const stemX = source.centerX;
        const stemTop = source.y + 6;
        const stemBottom = source.y + source.height - 10;

        ctx.strokeStyle = "#FFE6DB";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(stemX, stemTop);
        ctx.lineTo(stemX, stemBottom);
        ctx.stroke();

        ctx.fillStyle = "#FF9F7A";
        ctx.beginPath();
        ctx.arc(stemX, stemBottom + 2, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = "#FFC7B3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(stemX, stemTop + 4, 3, Math.PI, 0);
        ctx.stroke();
    }

}
