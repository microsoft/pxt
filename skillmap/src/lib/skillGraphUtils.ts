export interface GraphCoord {
    x: number;
    y: number;
}

interface GraphNode extends MapActivity {
    layer: number; // The layer of this node (distance from root)
    width: number; // The maximum subtree width from this node
    counter: number; // The offset of the node within the layer
    parents?: GraphNode[];
}

export function simpleGraph(root: MapActivity): GraphNode[] {
    const base = root as GraphNode;
    base.layer = 0;
    let activities: GraphNode[] = [base];

    // Pass to set the width of each node
    setWidths(base);

    // We keep a map of how deep the graph is at this layer
    const counterMap: { [key: number]: number } = {};
    // BFS traversal to set the counter and layer
    while (activities.length > 0) {
        let current = activities.shift();
        if (current) {
            current.layer = current.parents ? (Math.min(...current.parents.map((el: GraphNode) => el.layer)) + 1) : 0;
            if (counterMap[current.layer] === undefined) {
                counterMap[current.layer] = 1;
            }

            // Set the layer offset of the node, track it in our counter map
            if (!current.counter) {
                const parent = current.parents?.map((el: GraphNode) => el.counter) || [0];
                current.counter = Math.max(counterMap[current.layer], ...parent);
                counterMap[current.layer] = current.counter + current.width;
            }

            // Assign this node as the parent of all children, set children depth
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

    return bfsArray(base);
}

function bfsArray(root: GraphNode): GraphNode[] {
    let nodes = [];
    let queue = [root];
    while (queue.length > 0) {
        let current = queue.shift();
        if (current) {
            nodes.push(current);
            queue = queue.concat(current.next as any);
        }
    }

    return nodes;
}

function setWidths(node: GraphNode) {
    let current = node as any;
    if (!node.next || node.next.length == 0) {
        current.width = 1;
    } else {
        current.width = node.next.map((el: any) => setWidths(el)).reduce((total: number, w: number) => total + w);
    }
    return current.width;
}
