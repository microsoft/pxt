
namespace pxt.blocks.layout {

    export function verticalAlign(ws: B.Workspace, emPixels: number) {
        let blocks = ws.getTopBlocks(true);
        let y = 0
        blocks.forEach(block => {
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += emPixels; //buffer            
        })
    };

    export function shuffle(ws: B.Workspace) {
        let blocks = ws.getAllBlocks();
        // unplug all blocks
        blocks.forEach(b => b.unplug());
        // TODO: better layout
        // randomize order
        fisherYates(blocks);
        // apply layout
        flow(blocks);
    }

    function flow(blocks: Blockly.Block[]) {
        const gap = 14;
        // compute total block surface and infer width
        let surface = 0;
        for (let block of blocks) {
            let s = block.getHeightWidth();
            surface += s.width * s.height;
        }
        const maxx = Math.sqrt(surface) * 1.62;

        let insertx = 0;
        let inserty = 0;
        let endy = 0;
        for (let block of blocks) {
            let r = block.getBoundingRectangle();
            let s = block.getHeightWidth();
            // move block to insertion point
            block.moveBy(insertx - r.topLeft.x, inserty - r.topLeft.y);
            insertx += s.width + gap;
            endy = Math.max(endy, inserty + s.height + gap);
            if (insertx > maxx) { // start new line
                insertx = 0;
                inserty = endy;
            }
        }
    }

    function fisherYates<T>(myArray: T[]): void {
        let i = myArray.length;
        if (i == 0) return;
        // TODO: seeded random
        while (--i) {
            let j = Math.floor(Math.random() * (i + 1));
            let tempi = myArray[i];
            let tempj = myArray[j];
            myArray[i] = tempj;
            myArray[j] = tempi;
        }
    }

    const nodeSeparation = 12;

    interface Edge {
        source: string;
        target: string;
        weight: number;
    }

    function mst(nodes: string[], edges: Edge[]): Edge[] {
        let forest = nodes.map(node => { let r: U.Map<number> = {}; r[node] = 1; return r; });
        let sortedEdges = edges.slice(0).sort((l, r) => -l.weight + r.weight);
        let r: Edge[] = [];
        while (forest.length > 1) {
            let edge = sortedEdges.pop();
            let n1 = edge.source;
            let n2 = edge.target;
            let t1 = forest.filter(tree => !!tree[n1])[0];
            let t2 = forest.filter(tree => !!tree[n2])[0];
            if (t1 != t2) {
                forest = forest.filter(ar => ar != t1 && ar != t2);
                forest.push(union(t1, t2));
                r.push(edge);
            }
        }
        return r;

        function union(a: U.Map<number>, b: U.Map<number>): U.Map<number> {
            let r: U.Map<number> = {};
            for (let k in a)
                r[k] = 1;
            for (let k in b)
                r[k] = 1;
            return r;
        }
    }

    function removeOverlapsOnTinyGraph(blocks: Blockly.Block[]) {
        if (blocks.length == 1)
            return;
        if (blocks.length == 2) {
            let a = blocks[0];
            let b = blocks[1];

            //if (ApproximateComparer.Close(center(a), center(b)))
            //    b.Center += new Point(0.001, 0);

            let idealDist = getIdealDistanceBetweenTwoNodes(a, b);
            let c = center(centerBlock(a), centerBlock(b));
            let dir = goog.math.Coordinate.difference(centerBlock(a), centerBlock(b));
            let dist = goog.math.Coordinate.magnitude(dir);
            dir = scale(dir, 0.5 * idealDist / dist);

            setCenter(a, goog.math.Coordinate.sum(c, dir))
            setCenter(b, goog.math.Coordinate.sum(c, dir))
        }
    }

    function scale(c: goog.math.Coordinate, f: number): goog.math.Coordinate {
        return new goog.math.Coordinate(c.x * f, c.y * f);
    }

    function center(l: goog.math.Coordinate, r: goog.math.Coordinate): goog.math.Coordinate {
        return new goog.math.Coordinate(
            l.x + (r.x - l.x) / 2,
            l.y + (r.y - l.y) / 2);
    }

    function centerBlock(b: Blockly.Block): goog.math.Coordinate {
        let br = b.getBoundingRectangle();
        return center(br.bottomRight, br.topLeft);
    }

    function setCenter(b: Blockly.Block, c: goog.math.Coordinate) {

    }

    function getIdealDistanceBetweenTwoNodes(a: Blockly.Block, b: Blockly.Block): number {
        let abox = a.getBoundingRectangle();
        let bbox = b.getBoundingRectangle();
        //abox.Pad(nodeSeparation / 2);
        //bbox.Pad(nodeSeparation / 2);
        let ac = goog.math.Coordinate.difference(abox.topLeft, abox.bottomRight);
        let bc = goog.math.Coordinate.difference(bbox.topLeft, bbox.bottomRight);

        let ab = goog.math.Coordinate.difference(ac, bc);
        let dx = Math.abs(ab.x);
        let dy = Math.abs(ab.y);
        let wx = (Math.abs(abox.topLeft.x - abox.bottomRight.x) / 2 + Math.abs(bbox.topLeft.x - bbox.bottomRight.x) / 2);
        let wy = (Math.abs(abox.topLeft.y - abox.bottomRight.y) / 2 + Math.abs(bbox.topLeft.y - bbox.bottomRight.y) / 2);
        const machineAcc = 1.0e-16;
        let t: number;
        if (dx < machineAcc * wx)
            t = wy / dy;
        else if (dy < machineAcc * wy)
            t = wx / dx;
        else
            t = Math.min(wx / dx, wy / dy);
        return t * goog.math.Coordinate.magnitude(ab);
    }
}