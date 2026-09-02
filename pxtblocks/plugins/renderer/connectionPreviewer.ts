import * as Blockly from "blockly";

export class ConnectionPreviewer extends Blockly.InsertionMarkerPreviewer {
    static CONNECTION_INDICATOR_RADIUS = 9;

    protected connectionLine: SVGLineElement;
    protected draggedConnectionIndicator: SVGElement;
    protected staticConnection: Blockly.RenderedConnection;
    protected staticConnectionIndicator: SVGElement;

    previewConnection(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection): void {
        super.previewConnection(draggedConn, staticConn);
        if (staticConn.type === Blockly.ConnectionType.INPUT_VALUE || staticConn.type === Blockly.ConnectionType.OUTPUT_VALUE) {
            this.showDraggedIndicatorWithLine(draggedConn, staticConn);
        }
    }

    previewReplacement(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection, replacedBlock: Blockly.BlockSvg): void {
        super.previewReplacement(draggedConn, staticConn, replacedBlock);
        this.showDraggedIndicatorWithLine(draggedConn, staticConn);
    }

    private showDraggedIndicatorWithLine(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection) {
        if (!this.connectionLine) {
            this.connectionLine = Blockly.utils.dom.createSvgElement(
                'line',
                {
                    'class': 'blocklyConnectionLine',
                    'x1': 0,
                    'y1': 0,
                    'x2': 0,
                    'y2': 0
                },
                draggedConn.sourceBlock_.getSvgRoot());

            this.draggedConnectionIndicator = this.createConnectionIndicator(draggedConn.sourceBlock_.getSvgRoot(), draggedConn);
            const staticIndicatorParent = staticConn.sourceBlock_.getSvgRoot().querySelector(":scope>.blocklyConnectionIndicatorParent") as SVGElement;
            this.staticConnectionIndicator = this.createConnectionIndicator(staticIndicatorParent, staticConn);
        }
        this.raiseIndicators();
        this.updateLineCoords(draggedConn, staticConn);
        // Refresh after the in-flight render queue drains. Covers two cases:
        //  - base.startDrag for keyboard events nudges the block after firing
        //    the preview, leaving our line endpoints stale.
        //  - disconnecting from a parent can queue a re-render of the static
        //    block (size change when a child slot collapses), shifting its
        //    connection positions.
        Blockly.renderManagement.finishQueuedRenders().then(() => {
            if (this.connectionLine) {
                this.raiseIndicators();
                this.updateLineCoords(draggedConn, staticConn);
            }
        });
    }

    private raiseIndicators() {
        // Dragged side: keep the dragged dot last in the dragged block's
        // svgRoot so it paints over the line and the dragged block's path.
        this.draggedConnectionIndicator.parentElement?.appendChild(this.draggedConnectionIndicator);
        // Static side: ensure the indicator group ends up at the end of the
        // static block's svgRoot so the connection-highlight path that
        // RenderedConnection.highlight re-appends doesn't sit on top of it.
        const staticParent = this.staticConnectionIndicator.parentElement;
        staticParent.appendChild(this.staticConnectionIndicator);
        staticParent.parentElement?.appendChild(staticParent);
    }

    private updateLineCoords(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection) {
        const radius = ConnectionPreviewer.CONNECTION_INDICATOR_RADIUS;
        const dragOffset = draggedConn.getOffsetInBlock();
        const staticOffset = staticConn.getOffsetInBlock();
        // Connection offsets can shift when the host block re-renders (e.g.
        // a static block whose input slot collapses on disconnect), so keep
        // each indicator's transform in sync with the current offset.
        this.draggedConnectionIndicator.setAttribute(
            "transform", `translate(${dragOffset.x}, ${dragOffset.y})`);
        this.staticConnectionIndicator.setAttribute(
            "transform", `translate(${staticOffset.x}, ${staticOffset.y})`);

        const absDrag = Blockly.utils.Coordinate.sum(
            draggedConn.sourceBlock_.getRelativeToSurfaceXY(),
            dragOffset,
        );
        const absStatic = Blockly.utils.Coordinate.sum(
            staticConn.sourceBlock_.getRelativeToSurfaceXY(),
            staticOffset,
        );
        const dx = absStatic.x - absDrag.x;
        const dy = absStatic.y - absDrag.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        // Hide when the indicators are close enough to overlap; the line
        // endpoints would otherwise land inside the dots and look wrong.
        if (len < radius * 2 + 1) {
            Blockly.utils.dom.addClass(this.connectionLine, "hidden");
            return;
        }
        Blockly.utils.dom.removeClass(this.connectionLine, "hidden");
        // Stop each endpoint at the dot's edge so the line visually meets it.
        const atan = Math.atan2(dy, dx);
        this.connectionLine.setAttribute("x1", String(dragOffset.x + Math.cos(atan) * radius));
        this.connectionLine.setAttribute("y1", String(dragOffset.y + Math.sin(atan) * radius));
        this.connectionLine.setAttribute("x2", String(dragOffset.x + dx - Math.cos(atan) * radius));
        this.connectionLine.setAttribute("y2", String(dragOffset.y + dy - Math.sin(atan) * radius));
    }

    hidePreview(): void {
        super.hidePreview();
        if (this.connectionLine) {
            this.connectionLine.remove();
            this.connectionLine = null;
            this.draggedConnectionIndicator.remove();
            this.draggedConnectionIndicator = null;
            this.staticConnectionIndicator.remove();
            this.staticConnectionIndicator = null;
            this.staticConnection = null;
        }
    }

    protected createConnectionIndicator(parent: SVGElement, connection: Blockly.RenderedConnection): SVGElement {
        const result = Blockly.utils.dom.createSvgElement('g',
            { 'class': 'blocklyInputConnectionIndicator' },
            parent);
        Blockly.utils.dom.createSvgElement('circle',
            { 'r': ConnectionPreviewer.CONNECTION_INDICATOR_RADIUS }, result);
        const offset = connection.getOffsetInBlock();
        result.setAttribute('transform',
            'translate(' + offset.x + ',' + offset.y + ')');
        return result;
    }
}
