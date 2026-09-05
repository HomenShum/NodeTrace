function nodeMessage(nodes, edges, enabledTypes, id) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return null;
    const labels = new Map(nodes.map((item) => [item.id, item.label]));
    return { source: "nodegraph", kind: "node", id: node.id, label: node.label, nodeKind: node.type,
        ...(typeof node.count === "number" ? { count: node.count } : {}),
        edges: edges.filter((edge) => enabledTypes.has(edge.type) && (edge.source === id || edge.target === id))
            .map((edge) => ({ other: labels.get(edge.source === id ? edge.target : edge.source),
                weight: edge.weight, type: edge.type, ...(edge.receipt ? { receipt: edge.receipt } : {}) })) };
}