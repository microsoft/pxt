namespace pxtsprite {
    export class FloatingLayer {
        content: Bitmap;
        left: number;
        top: number;


        constructor(content: Bitmap) {
            this.content = content;
            this.clearOffset();
        }

        clearOffset() {
            this.left = this.content.x0;
            this.top = this.content.y0;
        }
    }
}

            // if (!width || !height) return;

            // if (width < 0) {
            //     left += width;
            //     width = -width;
            // }

            // if (height < 0) {
            //     top += height;
            //     height = -height;
            // }

            // const verticalEdges: [Coord, number][] = [];
            // const horizontalEdges: [Coord, number][] = [];

            // const marks: boolean[][] = [];

            // for (let i = 0; i < width; i++) marks.push([]);

            // const isTransparent = (x: number, y: number) => {
            //     return !this.image.get(left + x, top + y);
            // }


            // for (let col = 0; col < width; col++) {
            //     let markingEdge = false;
            //     let edgeStart: Coord;
            //     for (let row = 0; row < height; row++) {
            //         if (!isTransparent(col, row)) continue;
            //         if (isTransparent(col + 1, row)) {
            //             if (markingEdge) {
            //                 markingEdge = false;
            //                 verticalEdges.push([edgeStart, row - edgeStart[1]]);
            //             }
            //         }
            //         else if (!markingEdge) {
            //             markingEdge = true;
            //             edgeStart = [col, row];
            //         }
            //     }

            //     if (markingEdge) {
            //         verticalEdges.push([edgeStart, height - edgeStart[1]]);
            //     }
            // }

            // for (let row = 0; row < height; row++) {
            //     let markingEdge = false;
            //     let edgeStart: Coord;
            //     for (let col = 0; col < width; col++) {
            //         if (!isTransparent(col, row)) continue;
            //         if (isTransparent(col, row + 1)) {
            //             if (markingEdge) {
            //                 markingEdge = false;
            //                 horizontalEdges.push([edgeStart, col - edgeStart[0]]);
            //             }
            //         }
            //         else if (!markingEdge) {
            //             markingEdge = true;
            //             edgeStart = [col, row];
            //         }
            //     }

            //     if (markingEdge) {
            //         horizontalEdges.push([edgeStart, width - edgeStart[0]]);
            //     }
            // }


            // this.showOverlay();

            // const context = this.overlayLayer.getContext("2d");
            // context.clearRect(0, 0, this.overlayLayer.width, this.overlayLayer.height);
            // context.strokeStyle = "#000000";

            // for (const e of verticalEdges) {
            //     const x = (1 + left + e[0][0]) * this.cellWidth;
            //     const y = (1 + top + e[0][1]) * this.cellHeight;
            //     context.moveTo(x, y);
            //     context.lineTo(x, y + e[1] * this.cellHeight);
            //     context.stroke();
            // }

            // for (const e of horizontalEdges) {
            //     const x = (1 + left + e[0][0]) * this.cellWidth;
            //     const y = (1 + top + e[0][1]) * this.cellHeight;
            //     context.moveTo(x, y);
            //     context.lineTo(x + e[1] * this.cellWidth, y);
            //     context.stroke();
            // }

            // context.strokeStyle = "#898989";

            // context.strokeRect(left * this.cellWidth, top * this.cellHeight, width * this.cellWidth, height * this.cellHeight);



            // for (let col = 0; col < width; col++) {
            //     for (let row = 0; row < height; row++) {
            //         if (marks[col][row] || isTransparent(col, row)) continue;

            //         marks[col][row] = true;
            //         segments.push(makeSegment(col, row));
            //     }
            // }

            // return segments;

            // function makeSegment(col: number, row: number) {
            //     const q: Coord[] = [[col, row]];
            //     const segment: Coord[] = [[col, row]];

            //     while (q.length) {
            //         const [c, r] = q.pop();
            //         if (!isTransparent(c, r)) {
            //             tryPush(c + 1, r);
            //             tryPush(c - 1, r);
            //             tryPush(c, r + 1);
            //             tryPush(c, r - 1);
            //         }
            //     }

            //     return segment;

            //     function tryPush(x: number, y: number) {
            //         if (!isTransparent(x, y) && !marks[x][y]) {
            //             segment.push([x, y]);
            //             q.push([x, y]);
            //             marks[x][y] = true;
            //         }
            //     }
            // }

            // function pruneSegment(segment: Coord[]) {

            // }