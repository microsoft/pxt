import * as Blockly from "blockly";

export class ConnectionPreviewer implements Blockly.IConnectionPreviewer {
    static CONNECTION_INDICATOR_RADIUS = 9;

    protected connectionLine: SVGLineElement;
    protected staticConnectionIndicator: SVGElement;
    protected draggedConnectionIndicator: SVGElement;
    protected staticConnection: Blockly.RenderedConnection;

    previewReplacement(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection, replacedBlock: Blockly.BlockSvg): void {
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

            // Create connection indicator for target/closes connection
            this.draggedConnectionIndicator = this.createConnectionIndicator(draggedConn);
        }

        if (this.staticConnection !== staticConn) {
            if (this.staticConnectionIndicator) {
                this.staticConnectionIndicator.remove();
            }
            this.staticConnection = staticConn;
            this.staticConnectionIndicator = this.createConnectionIndicator(staticConn);
        }

        const radius = ConnectionPreviewer.CONNECTION_INDICATOR_RADIUS;
        const offset = draggedConn.getOffsetInBlock();

        const absDrag = Blockly.utils.Coordinate.sum(
            draggedConn.sourceBlock_.getRelativeToSurfaceXY(),
            offset
        );
        const absStatic = Blockly.utils.Coordinate.sum(
            staticConn.sourceBlock_.getRelativeToSurfaceXY(),
            staticConn.getOffsetInBlock()
        );

        const dx = absStatic.x - absDrag.x;
        const dy = absStatic.y - absDrag.y;
        // Offset the line by the radius of the indicator to prevent overlap
        const atan = Math.atan2(dy, dx);

        const len = Math.sqrt(dx * dx + dy * dy);
        // When the indicators are overlapping, we hide the line
        if (len < radius * 2 + 1) {
            Blockly.utils.dom.addClass(this.connectionLine, "hidden");
        } else {
            Blockly.utils.dom.removeClass(this.connectionLine, "hidden");
            this.connectionLine.setAttribute("x1", String(offset.x + Math.cos(atan) * radius));
            this.connectionLine.setAttribute("y1", String(offset.y + Math.sin(atan) * radius));

            this.connectionLine.setAttribute("x2", String(offset.x + dx - Math.cos(atan) * radius));
            this.connectionLine.setAttribute("y2", String(offset.y + dy - Math.sin(atan) * radius));
        }
    }

    previewConnection(draggedConn: Blockly.RenderedConnection, staticConn: Blockly.RenderedConnection): void {

    }

    hidePreview(): void {
        if (this.connectionLine) {
            this.connectionLine.remove();
            this.connectionLine = null;
            this.staticConnectionIndicator.remove();
            this.staticConnectionIndicator = null;
            this.draggedConnectionIndicator.remove();
            this.draggedConnectionIndicator = null;
            this.staticConnection = null;
        }
    }

    dispose(): void {
        this.hidePreview();
    }

    protected createConnectionIndicator(connection: Blockly.RenderedConnection): SVGElement {
        const result = Blockly.utils.dom.createSvgElement('g',
            { 'class': 'blocklyInputConnectionIndicator' },
            connection.sourceBlock_.getSvgRoot());
        Blockly.utils.dom.createSvgElement('circle',
            { 'r': ConnectionPreviewer.CONNECTION_INDICATOR_RADIUS }, result);
        const offset = connection.getOffsetInBlock();
        result.setAttribute('transform',
            'translate(' + offset.x + ',' + offset.y + ')');
        return result;
    }
}