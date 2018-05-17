/// <reference path="./bitmap.ts" />
/// <reference path="./grid.ts" />
/// <reference path="./tools.ts" />
/// <reference path="./util.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;
    export class BitmapImage extends Grid {
        public image: Bitmap;
        protected palette: string[];
        private overlay: svg.Group;
        private overlayFade: Fade;

        constructor(props: Partial<GridStyleProps>, img: Bitmap, palette: string[], root?: svg.SVG) {
            super(bitmapImageProps(props, img), root);

            this.image = img;
            this.palette = palette;
            this.repaint();
        }

        repaint() {
            for (let c = 0; c < this.image.width; c++) {
                for (let r = 0; r < this.image.height; r++) {
                    this.setCellColor(c, r, this.palette[this.image.get(c, r)])
                }
            }
        }

        writeColor(col: number, row: number, color: number) {
            const old = this.image.get(col, row);
            this.image.set(col, row, color);
            this.drawColor(col, row, color);
        }

        drawColor(col: number, row: number, color: number) {
            this.setCellColor(col, row, this.palette[color]);
        }

        restore(bitmap: Bitmap, repaint = false) {
            if (bitmap.height != this.image.height || bitmap.width != this.image.width) {
                this.image = bitmap.copy();
                this.resizeGrid(bitmap.width, bitmap.width * bitmap.height);
            }
            else {
                this.image.apply(bitmap);
            }

            if (repaint) {
                this.repaint();
            }
        }

        applyEdit(edit: Edit) {
            edit.doEdit(this.image);
            this.repaint();
        }

        bitmap() {
            return this.image;
        }

        showOverlay() {
            if (!this.overlay) {
                this.overlay = new svg.Group;
                if (this.dragSurface) {
                    this.group.el.insertBefore(this.overlay.el, this.dragSurface.el);
                }
                else {
                    this.group.appendChild(this.overlay);
                }
            }
            else {
                pxsim.U.clear(this.overlay.el);
                if (this.overlayFade) {
                    this.overlayFade.kill();
                }
            }


            const width = this.outerWidth();
            const height = this.outerHeight();

            for (let c = 0; c < this.columns; c++) {
                const [x, ] = this.cellToCoord(c, 0);
                this.overlay.draw("line")
                    .stroke("#898989")
                    .strokeWidth(1)
                    .at(x, 0, x, height);
            }

            for (let r = 0; r < this.rows; r++) {
                const [, y] = this.cellToCoord(0, r);
                this.overlay.draw("line")
                    .stroke("#898989")
                    .strokeWidth(1)
                    .at(0, y, width, y);
            }

            const toastWidth = 100;
            const toastHeight = 40;

            this.overlay.draw("rect")
                .at(width / 2 - toastWidth / 2, height / 2 - toastHeight / 2 )
                .fill("#898989")
                .corner(2)
                .size(toastWidth, toastHeight);

            this.overlay.draw("text")
                .text(`${this.columns}x${this.rows}`)
                .at(width / 2, height / 2)
                .fontSize(30, svg.LengthUnit.px)
                .fill("white")
                // .alignmentBaseline("middle")
                .anchor("middle");

            this.overlayFade = new Fade(this.overlay, 750, 500);
        }
    }

    function bitmapImageProps(props: Partial<GridStyleProps>, bitmap: Bitmap): GridProps {
        const defaultProps = defaultGridProps();
        defaultProps.rowLength = bitmap.width;
        defaultProps.numCells = bitmap.width * bitmap.height;

        return mergeProps<GridProps>(defaultProps, props);
    }

    class Fade {
        start: number;
        end: number;
        slope: number;
        dead: boolean;

        constructor (protected target: svg.Group, delay: number, duration: number) {
            this.start = Date.now() + delay;
            this.end = this.start + duration;
            this.slope = 1 / duration;
            this.dead = false;

            target.setAttribute("fill-opacity", 1)
            target.setAttribute("stroke-opacity", 1)

            setTimeout(() => requestAnimationFrame(() => this.frame()), delay);
        }

        frame() {
            if (this.dead) return;
            const now = Date.now();
            if (now < this.end) {
                const v = 1 - (this.slope * (now - this.start));
                this.target.setAttribute("fill-opacity", v);
                this.target.setAttribute("stroke-opacity", v);
                requestAnimationFrame(() => this.frame());
            }
            else {
                pxsim.U.clear(this.target.el);
            }
        }

        kill() {
            this.dead = true;
        }
    }
}