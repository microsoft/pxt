////////////////////////////////////////////
////////                            ////////
////////        SVG RENDERING       ////////
////////                            ////////
////////////////////////////////////////////

export interface SvgCoord {
    x: number;
    y: number;
}

export interface SvgGraphItem {
    activity: MapActivity;
    position: SvgCoord;
}

export interface SvgGraphPath {
    points: SvgCoord[];
}

export interface SvgGraph {
    map: SkillMap;
    items: SvgGraphItem[];
    paths: SvgGraphPath[];
    width: number;
    height: number
}

export const UNIT = 10;
export const PADDING = 4;
export const MIN_HEIGHT = 40 * UNIT;
export const MIN_WIDTH = 60 * UNIT;

export function getGraph(map: SkillMap): SvgGraph {
    let nodes: GraphNode[] = [];
    switch (map.layout) {
        case "manual":
            nodes = nodes.concat(manualGraph(map.root));
            break;
        case "ortho":
        default:
            nodes = nodes.concat(orthogonalGraph(map.root));
    }

    let maxDepth = 0, maxOffset = 0;

    // Convert into renderable items
    const items: SvgGraphItem[] = [];
    const paths: SvgGraphPath[] = [];
    for (let current of nodes) {
        const { depth, offset } = current;
        items.push({
            activity: current,
            position: getPosition(depth, offset)
        } as any);

        if (current.edges) {
            current.edges.forEach(edge => {
                const points: SvgCoord[] = [];
                edge.forEach(n => points.push(getPosition(n.depth, n.offset)));
                paths.push({ points });
            });
        }

        maxDepth = Math.max(maxDepth, current.depth);
        maxOffset = Math.max(maxOffset, current.offset);
    }

    const width = getX(maxDepth) + UNIT * PADDING;
    const height = getY(maxOffset) + UNIT * PADDING;

    return { map, items, paths, width, height };
}

// This function converts graph position (no units) to x/y (SVG units)
function getPosition(depth: number, offset: number): SvgCoord {
    return { x: getX(depth), y: getY(offset) }
}

function getX(position: number) {
    return ((position * 12) + PADDING) * UNIT;
}

function getY(position: number) {
    return ((position * 9) + PADDING) * UNIT;
}



////////////////////////////////////////////
////////                            ////////
////////        GRAPH LAYOUT        ////////
////////                            ////////
////////////////////////////////////////////

export function manualGraph(root: MapNode): GraphNode[] {
    const visited: string[] = [];
    const graphNode = cloneGraph(root);
    const nodes = dfsArray(graphNode).filter(node => node.kind !== "layout");
    nodes.forEach(n => {
        if (visited.indexOf(n.activityId) < 0) {
            visited.push(n.activityId);
            n.depth = n.position?.depth || 0;
            n.offset = n.position?.offset || 0;

            // Generate straight-line edges between nodes
            const edges: GraphCoord[][] = []
            n.next.forEach((next, i) => {
                const nextDepth = next.position?.depth || 0;
                const nextOffset = next.position?.offset || 0;

                // Edge starts from current node
                const edge = [{depth: n.depth, offset: n.offset }];
                // If manual edge is specified for this node, push edge points
                if (n.edges?.[i]) {
                    n.edges[i].forEach(el => {
                        const prev = edge[edge.length - 1];
                        // Ensure that there are only horizontal and vertical segments
                        if (el.depth !== prev.depth && el.offset !== prev.offset) {
                            edge.push({ depth: prev.depth, offset: el.offset });
                        }
                        edge.push(el);
                    })
                }
                // Edge ends at "next" node, ensure only horizontal/vertical
                const prev = edge[edge.length - 1];
                if (nextDepth !== prev.depth && nextOffset !== prev.offset) {
                    edge.push({ depth: prev.depth, offset: nextOffset });
                }
                edge.push({ depth: nextDepth, offset: nextOffset });

                edges.push(edge);
            });
            n.edges = edges;
        }
    })
    return nodes;
}

export function orthogonalGraph(root: MapNode): GraphNode[] {
    const graphNode = cloneGraph(root);
    let activities: GraphNode[] = [graphNode];

    // Compute two coordiantes (depth, offset) for each node. The placement heuristic
    // here is roughly based off of "The DFS-heuristic for orthogonal graph drawing"
    // found at: https://core.ac.uk/download/pdf/82771879.pdf
    const prevChildPosition: { [key: string]: GraphCoord } = {};
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
            const next = current.next.map((el: BaseNode) => {
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
                // Skip the increment if the nodes are adjacent siblings
                if (!isAdjacent(n, current!)) {
                    n.offset += 1;
                    totalOffset = Math.max(totalOffset, n.offset);
                    n.depth = Math.max(n.depth, current!.depth + 1);
                }
            })
            activities = next.concat(activities);
        }
    }

    const nodes = dfsArray(graphNode).filter(node => node.kind !== "layout");

    // Get map of node offsets at each level of the graph
    const offsetMap: { [key: number]: number[] } = {};
    nodes.forEach(n => {
        if (offsetMap[n.depth] == undefined) {
            offsetMap[n.depth] = [];
        }
        offsetMap[n.depth].push(n.offset);
    })

    // Shrink long leaf branches
    nodes.forEach(node => {
        if ((!node.next || node.next.length == 0) && node.parents?.length == 1) {
            const parent = node.parents[0];
            const offsets = offsetMap[node.depth];
            const siblingOffset = offsets[offsets.indexOf(node.offset) - 1];
            const distance = siblingOffset ? node.offset - siblingOffset : Math.abs(node.depth - parent.depth) + Math.abs(node.offset - parent.offset);
            if (distance > 2) {
                node.depth = parent.depth;
                node.offset = (siblingOffset || parent.offset) + 1;
            }
        }
    })

    // Calculate edge segments from parent nodes
    nodes.forEach(n => {
        if (n.parents) {
            n.edges = [];

            // We will try to flip the edge (draw vertical before horizontal) if
            // there is a parent on the horizontal axis, or more than two parents
            const tryFlipEdge = n.parents.some(p => p.offset == n.offset) || n.parents.length > 2;
            n.parents.forEach(p => {
                const edge = [{ depth: p.depth, offset: p.offset }];
                if (tryFlipEdge) {
                    // Grab node index, check the siblings to see if there is space to draw the flipped edge
                    const offsets = offsetMap[n.depth];
                    const nodeIndex = offsets.indexOf(n.offset);
                    const spaceBelow = n.offset > p.offset && !((offsets[nodeIndex + 1] - offsets[nodeIndex]) < (n.offset - p.offset));
                    const spaceAbove = n.offset < p.offset && !((offsets[nodeIndex] - offsets[nodeIndex - 1]) < (p.offset - n.offset));
                    if (spaceBelow || spaceAbove) {
                        edge.push({ depth: n.depth, offset: p.offset });
                    } else {
                        edge.push({ depth: p.depth, offset: n.offset });
                    }
                } else {
                    edge.push({ depth: p.depth, offset: n.offset });
                }
                edge.push({ depth: n.depth, offset: n.offset });
                n.edges?.push(edge);
            })
        }
    })

    return nodes;
}

// Simple tree-like layout, does not handle loops very well
export function treeGraph(root: BaseNode): GraphNode[] {
    let graphNode = cloneGraph(root);
    let activities: GraphNode[] = [graphNode];

    // Pass to set the width of each node
    setWidths(graphNode);

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
                offsetMap[current.depth] = current.offset + current.width!;
            }

            // Assign this node as the parent of all children
            const next = current.next.map((el: BaseNode) => {
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

    const nodes = bfsArray(graphNode).filter(node => node.kind !== "layout");
    nodes.forEach(n => {
        if (n.parents) {
            n.edges = [];
            n.parents.forEach(p => {
                // Edge from parent, vertically down, then horizontal to child
                n.edges?.push([ { depth: p.depth, offset: p.offset },
                    { depth: n.depth, offset: p.offset },
                    { depth: n.depth, offset: n.offset } ])
            })
        }
    })
    return nodes;
}

function setWidths(node: GraphNode): number {
    if (!node.next || node.next.length == 0) {
        node.width = 1;
    } else {
        node.width = node.next.map((el: any) => setWidths(el)).reduce((total: number, w: number) => total + w);
    }
    return node.width;
}

function isAdjacent(a: GraphNode, b: GraphNode): boolean {
    if (!a.parents || !b.parents) return false;

    let sharedParent: GraphNode | undefined;
    a.parents.forEach((p: GraphNode) => {
        if (b.parents!.indexOf(p) >= 0) sharedParent = p;
    })

    return !!sharedParent
        && Math.abs(sharedParent.nextIds.indexOf(a.activityId) - sharedParent.nextIds.indexOf(b.activityId)) == 1
        && a.depth == b.depth;
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

function cloneGraph(root: BaseNode): GraphNode {
    const nodes = bfsArray(root as GraphNode);
    const clones: { [key: string]: GraphNode} = {};

    // Clone all nodes, assign children to cloned nodes
    nodes.forEach(n => {
        let nextCopy = n.next.slice();
        n.next.length = 0;
        clones[n.activityId] = JSON.parse(JSON.stringify(n));
        n.next = nextCopy;
    });
    Object.keys(clones).forEach(cloneId => clones[cloneId].next = clones[cloneId].nextIds.map(id => clones[id] as any));

    return clones[root.activityId];
}
