import * as Pixi from "pixi.js";
import { flattenVerts } from "../util";

const shaderPrograms = new Map<string, Pixi.Program>();

export function addShaderProgram(name: string, vert: string, frag: string) {
    shaderPrograms.set(name, Pixi.Program.from(vert, frag));
}

function getShaderProgram(name: string): Pixi.Program {
    const pgm = shaderPrograms.get(name);
    if (pgm) return pgm;
    console.error(`shader program not found: "${name}"`);
    return shaderPrograms.get("$$missing_shader$$")!;
}

export const CommonVertexShaderGlobals = `
    precision mediump float;
    attribute vec2 aVerts;
    attribute vec2 aUvs;
    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;
    varying vec2 vUvs;
    varying vec2 vVerts;
`;
export const BasicVertexShader =
    CommonVertexShaderGlobals +
    `
    void main() {
        vUvs = aUvs;
        vVerts = aVerts;
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVerts, 1.0)).xy, 0.0, 1.0);
    }`;

export const CommonFragmentShaderGlobals = `
        precision mediump float;
        varying vec2 vUvs;
        varying vec2 vVerts;
        `;

addShaderProgram(
    "$$missing_shader$$",
    BasicVertexShader,
    CommonFragmentShaderGlobals +
        `
        void main() {
            vec2 uv = vUvs;
            uv = floor(uv * 10.);
            vec3 color1 = vec3(0.4, 0.0, 0.0);
            vec3 color2 = vec3(0.0, 0.4, 0.4);
            vec3 outColor = mod(uv.x + uv.y, 2.) < 0.5 ? color1 : color2;
            gl_FragColor = vec4(outColor.rgb, 0.5);
        }`
);

addShaderProgram(
    "textured_colored",
    BasicVertexShader,
    CommonFragmentShaderGlobals +
        `
        uniform sampler2D uSampler2;
        uniform vec3 uColor;
        uniform float uAlpha;
        void main() {
            vec2 uv = vUvs;
            gl_FragColor = texture2D(uSampler2, uv) * vec4(uColor.rgb, uAlpha);
        }`
);

addShaderProgram(
    "grid",
    BasicVertexShader,
    CommonFragmentShaderGlobals +
        `
        void main() {
            vec2 uv = vUvs;
            vec2 vert = vVerts;
            bool a = int(mod(vert.x, 20.0)) == 0;
            bool b = int(mod(vert.y, 20.0)) == 0;
            gl_FragColor = ((a && !b) || (!a && b)) ? vec4(0.,0.,0.,0.1) : vec4(0.,0.,0.,0.);
        }`
);

export const CANVAS_SIZE = 4000;

type CanvasPlayer = {
    imgId: number;
    sprite: Pixi.Sprite;
};

class CollabCanvas {
    private app: Pixi.Application;
    private root: Pixi.Graphics;
    private playerSprites: Map<string, CanvasPlayer> = new Map();

    public get view() {
        return this.app.view;
    }

    constructor() {
        this.app = new Pixi.Application({
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            backgroundColor: 0xffffff,
            antialias: true,
            clearBeforeRender: true,
        });

        // Set up initial canvas dimensions
        const canv = this.app.view as HTMLCanvasElement;
        canv.style.width = canv.style.minWidth = CANVAS_SIZE + "px";
        canv.style.height = canv.style.minHeight = CANVAS_SIZE + "px";

        this.root = new Pixi.Graphics();
        this.app.stage.addChild(this.root as any);

        this.addBackgroundGrid();
    }

    public reset() {
        this.root.children.forEach(child => child.destroy());
        this.root.removeChildren();
        this.playerSprites.clear();
        this.addBackgroundGrid();
    }

    private addBackgroundGrid() {
        const geom = new Pixi.Geometry();
        geom.addAttribute(
            "aVerts",
            flattenVerts([
                { x: 0, y: 0 },
                { x: 0, y: CANVAS_SIZE },
                { x: CANVAS_SIZE, y: CANVAS_SIZE },
                { x: CANVAS_SIZE, y: 0 },
            ]),
            2
        );
        geom.addAttribute(
            "aUvs",
            flattenVerts([
                { x: 0, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 1, y: 0 },
            ]),
            2
        );
        geom.addIndex([0, 1, 2, 0, 2, 3]);
        const pgm = getShaderProgram("grid");
        const shader = new Pixi.Shader(pgm);
        const mesh = new Pixi.Mesh(geom, shader);
        mesh.zIndex = -100; // behind everything
        this.root.addChild(mesh as any);
    }

    public addPlayerSprite(
        playerId: string,
        x: number,
        y: number,
        imgId: number
    ) {
        if (!playerId) return;
        if (this.playerSprites.has(playerId)) return;
        const sprite = Pixi.Sprite.from(
            `hackathon/rt-collab/sprites/sprite-${imgId}.png`
        );
        sprite.anchor.set(0.5);
        sprite.position.set(x, y);
        sprite.zIndex = 100; // in front of everything
        const player: CanvasPlayer = { imgId, sprite };
        this.playerSprites.set(playerId, player);
        this.root.addChild(sprite as any);
    }

    public removePlayerSprite(playerId: string) {
        const player = this.playerSprites.get(playerId);
        if (player) {
            this.root.removeChild(player.sprite as any);
            this.playerSprites.delete(playerId);
        }
    }

    public updatePlayerSpritePosition(playerId: string, x: number, y: number) {
        const player = this.playerSprites.get(playerId);
        if (player) {
            player.sprite.position.set(x, y);
        }
    }

    public updatePlayerSpriteImage(playerId: string, imgId: number) {
        const player = this.playerSprites.get(playerId);
        if (player && player.imgId !== imgId) {
            player.imgId = imgId;
            player.sprite.texture = Pixi.Texture.from(
                `hackathon/rt-collab/sprites/sprite-${imgId}.png`
            );
        }
    }
}

let _instance: CollabCanvas;

function ensureInstance(): CollabCanvas {
    if (!_instance) {
        _instance = new CollabCanvas();
    }
    return _instance;
}

export function getCollabCanvas() {
    return ensureInstance();
}
