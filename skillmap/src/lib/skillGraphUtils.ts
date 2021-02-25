export interface GraphCoord {
    x: number;
    y: number;
}

export type GraphEdgeDirection = "horizontal" | "vertical";

interface GraphNode extends MapActivity {
    depth: number; // The depth of this node (distance from root)
    width: number; // The maximum subtree width from this node
    offset: number; // The offset of the node within the layer
    parents?: GraphNode[];
    edges?: GraphEdgeDirection[];
}

export function orthogonalGraph(root: MapActivity): GraphNode[] {
    let activities: GraphNode[] = [root as GraphNode];

    const prevChildPosition: { [key: string]: {depth: number, offset: number} } = {};
    const visited: { [key: string]: boolean } = {};
    let totalOffset = 0;
    while (activities.length > 0) {
        let current = activities.shift();
        if (current && !visited[current.activityId]) {
            visited[current.activityId] = true;
            const parent = current.parents?.[0];
            if (parent) {
                const prevChild = prevChildPosition[parent.activityId] || { depth: 0, offset: 0 };
                // If we can place it horizontally do so, otherwise place at bottom of the graph
                if (prevChild.depth == 0) {
                    prevChild.depth = 1;
                    current.offset = parent.offset + prevChild.offset;
                } else {
                    totalOffset += 1
                    prevChild.offset = totalOffset;
                    current.offset = totalOffset;
                }

                current.depth = parent.depth + prevChild.depth;
                prevChildPosition[parent.activityId] = prevChild;
            } else {
                // This is a root node
                current.depth = 0;
                current.offset = 0;
            }

            // Assign the current node as the parent of its children
            const next = current.next.map((el: MapActivity) => {
                let node = el as GraphNode;
                if (!node.parents) {
                    node.parents = [current!];
                } else {
                    node.parents.push(current!);
                }
                return node;
            })

            // If we have already seen this child node (attached to earlier parent)
            // 1. Increase child offset by one unit (so it's between the parents) and adjust the total if necessary
            // 2. Increase child depth if necessary (should be deeper than parent)
            next.filter(n => visited[n.activityId]).forEach(n => {
                n.offset += 1;
                totalOffset = Math.max(totalOffset, n.offset);
                n.depth = Math.max(n.depth, current!.depth + 1);
            })
            activities = next.concat(activities);
        }
    }


    const nodes = dfsArray(root as GraphNode);

    // Get map of node offsets at each level of the graph
    const offsetMap: { [key: number]: number[] } = {};
    nodes.forEach(n => {
        if (offsetMap[n.depth] == undefined) {
            offsetMap[n.depth] = [];
        }
        offsetMap[n.depth].push(n.offset);
    })

    nodes.forEach(n => {
        if (n.parents) {
            n.edges = [];
            // We will try to flip the edge (draw vertical before horizontal) if
            // there is a parent on the horizontal axis, or more than two parents
            const tryFlipEdge = n.parents.some(p => p.offset == n.offset) || n.parents.length > 2;
            n.parents.forEach(p => {
                if (tryFlipEdge) {
                    // Grab node index, check the siblings to see if there is space to draw the flipped edge
                    const offsets = offsetMap[n.depth];
                    const nodeIndex = offsets.indexOf(n.offset);
                    const spaceBelow = n.offset > p.offset && !((offsets[nodeIndex + 1] - offsets[nodeIndex]) < (n.offset - p.offset));
                    const spaceAbove = n.offset < p.offset && !((offsets[nodeIndex] - offsets[nodeIndex - 1]) < (p.offset - n.offset));
                    if (spaceBelow || spaceAbove) {
                        n.edges?.push("vertical")
                    } else {
                        n.edges?.push("horizontal")
                    }
                } else {
                    n.edges?.push("horizontal")
                }
            })
        }
    })

    // Shrink long leaf branches
    nodes.forEach(node => {
        if ((!node.next || node.next.length == 0) && node.parents?.length == 1) {
            const parent = node.parents[0];
            if (Math.abs(node.depth - parent.depth) + Math.abs(node.offset - parent.offset) > 2) {
                const offsets = offsetMap[node.depth];
                const nodeIndex = offsets.indexOf(node.offset);
                const siblingOffset = offsets[nodeIndex - 1];
                node.depth = parent.depth;
                node.offset = (siblingOffset || parent.offset) + 1;
            }
        }
    })

    return nodes;
}

// Simple tree-like layout, does not handle loops very well
export function simpleGraph(root: MapActivity): GraphNode[] {
    let activities: GraphNode[] = [root as GraphNode];

    // Pass to set the width of each node
    setWidths(root as GraphNode);

    // We keep a map of how deep the graph is at this depth
    const offsetMap: { [key: number]: number } = {};
    // BFS traversal to set the offset and depth
    while (activities.length > 0) {
        let current = activities.shift();
        if (current) {
            current.depth = current.parents ? (Math.min(...current.parents.map((el: GraphNode) => el.depth)) + 1) : 0;
            if (offsetMap[current.depth] === undefined) {
                offsetMap[current.depth] = 1;
            }

            // Set the offset of the node, track it in our map
            if (!current.offset) {
                const parent = current.parents?.map((el: GraphNode) => el.offset) || [0];
                current.offset = Math.max(offsetMap[current.depth], ...parent);
                offsetMap[current.depth] = current.offset + current.width;
            }

            // Assign this node as the parent of all children
            const next = current.next.map((el: MapActivity) => {
                let node = el as GraphNode;
                if (!node.parents) {
                    node.parents = [current!];
                } else {
                    node.parents.push(current!);
                }
                return node;
            })

            activities = activities.concat(next);
        }
    }

    return bfsArray(root as GraphNode);
}

function bfsArray(root: GraphNode): GraphNode[] {
    let nodes = [];
    let queue = [root];
    let visited: { [key: string]: boolean } = {};
    while (queue.length > 0) {
        let current = queue.shift();
        if (current && !visited[current.activityId]) {
            visited[current.activityId] = true;
            nodes.push(current);
            queue = queue.concat(current.next as any);
        }
    }

    return nodes;
}

function dfsArray(root: GraphNode): GraphNode[] {
    let nodes = [];
    let queue = [root];
    let visited: { [key: string]: boolean } = {};
    while (queue.length > 0) {
        let current = queue.shift();
        if (current && !visited[current.activityId]) {
            visited[current.activityId] = true;
            nodes.push(current);
            queue = (current.next as any).concat(queue);
        }
    }

    return nodes;
}

function setWidths(node: GraphNode) {
    if (!node.next || node.next.length == 0) {
        node.width = 1;
    } else {
        node.width = node.next.map((el: any) => setWidths(el)).reduce((total: number, w: number) => total + w);
    }
    return node.width;
}
