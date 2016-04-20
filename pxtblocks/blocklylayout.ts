
namespace pxt.blocks.layout {
    
    export function verticalAlign(ws: B.Workspace) {
        let blocks = ws.getTopBlocks(true);
        let y = 0
        blocks.forEach(block => {
            block.moveBy(0, y)
            y += block.getHeightWidth().height
            y += 14; //buffer            
        })
    };
    
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

    function getIdealDistanceBetweenTwoNodes(a: Blockly.Block, b: Blockly.Block) : number {
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
        let t : number;
        if (dx < machineAcc * wx)
            t = wy / dy;
        else if (dy < machineAcc * wy)
            t = wx / dx;
        else
            t = Math.min(wx / dx, wy / dy);
        return t * goog.math.Coordinate.magnitude(ab);
    }
}