const tile = `
    2 2 2 2 2 2 2 2
    1 1 2 1 1 1 1 1
    1 1 2 1 1 1 1 1
    1 1 2 1 1 1 1 1
    2 2 2 2 2 2 2 2
    1 1 1 1 1 1 2 1
    1 1 1 1 1 1 2 1
    1 1 1 1 1 1 2 1
`;
const avatar = `
    . . 2 2 2 2 . .
    . . 2 2 2 2 . .
    . . 2 2 2 2 . .
    . . . 2 2 . . .
    . 2 2 2 2 2 2 .
    2 . . 2 2 . . 2
    . . 2 2 2 2 . .
    . . 2 . . 2 . .
`;
const item = `
    . . . . . . . .
    . . 2 2 2 . . .
    . . 2 1 2 . . .
    . . 2 2 2 . . .
    . . . 2 . . . .
    . . . 2 2 . . .
    . . . 2 . . . .
    . . . 2 2 . . .
`;
const sprite = `
    . 2 2 2 2 2 2 .
    2 2 2 2 2 2 2 2
    2 2 2 2 1 2 1 2
    2 2 2 2 1 2 1 2
    2 2 2 2 2 2 2 2
    2 2 2 2 2 2 2 2
    2 2 2 2 2 2 2 2
    2 2 . 2 2 . 2 2
`;

export function renderIcon(icon: string, selected: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;

    const palette = [
        "#000000",
        "#FFFFFF",
        selected ? "#000000" : "#dedede"
    ];
    renderBitmap(canvas, getIconBitmap(icon)!, palette);

    return canvas.toDataURL();
}

export function getIconBitmap(icon: string) {
    switch (icon) {
        case "tile":
            return pxt.sprite.imageLiteralToBitmap(tile);
        case "avatar":
            return pxt.sprite.imageLiteralToBitmap(avatar);
        case "item":
            return pxt.sprite.imageLiteralToBitmap(item);
        case "sprite":
            return pxt.sprite.imageLiteralToBitmap(sprite);
    }

    return undefined;
}

export function renderBitmap(canvas: HTMLCanvasElement, frame: pxt.sprite.Bitmap, palette: string[]) {
    const ctx = canvas.getContext("2d")!;

    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            if (frame.get(x, y)) {
                ctx.fillStyle = palette[frame.get(x, y)];
                ctx.fillRect(x, y, 1, 1);
            }
            else {
                ctx.clearRect(x, y, 1, 1);
            }
        }
    }
}