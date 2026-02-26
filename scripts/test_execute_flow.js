const nodes = [
    { id: 'menu', type: 'menu', data: { buttons: ['1', '2'] } },
    { id: 'action-link', type: 'action', data: { message: 'Link' } }
];
const edges = [
    { id: 'edge-menu', source: 'menu', target: 'action-link', sourceHandle: 'btn-0' }
];

const activeMenuId = 'menu';
const sourceHandleId = 'btn-0';

const matchingEdge = edges.find(e => e.source === activeMenuId && e.sourceHandle === sourceHandleId);
const filteredEdges = edges.filter(e => e.source !== activeMenuId || e.id === matchingEdge.id);

console.log("Filtered Edges:");
console.log(filteredEdges);

// Inside executeFlow:
const connections = filteredEdges.filter(e => e.source === activeMenuId);
console.log("Connections inside executeFlow:");
console.log(connections);

// Now the loop inside executeFlow:
for (const edge of connections) {
    const targetNode = nodes.find(n => n.id === edge.target);
    console.log("Target Node:", targetNode);
    // if targetNode is action, send message!
}
