import type { NodeType } from "./types";


export type NodeLike = { id: string; type?: string };
export type EdgeLike = { source: string; target: string };

/** which node types may connect to which */
const VALID_TARGETS: Record<NodeType, NodeType[]> = {
  notes:      ["instrument"],
  instrument: ["filter", "fx", "output", "arrange"],
  filter:     ["filter", "fx", "output", "arrange"],
  fx:         ["filter", "fx", "output", "arrange"], // an FX rack can sit anywhere a Filter can
  output:     [],
  arrange:    [], // no output cable, joins the Output's stack on its own
};

export function isValidPair(sourceType: NodeType, targetType: NodeType) : boolean {
    return VALID_TARGETS[sourceType].includes(targetType);
}

/** would adding source --> target create a loop? */
export function wouldCreateCycle(edges: EdgeLike[], source: string, target: string): boolean {
  if (source === target) return true;

  const next = new Map<string, string[]>();          // source -> [targets]
  for (const e of edges) {
    const list = next.get(e.source) ?? [];
    list.push(e.target);
    next.set(e.source, list);
  }

  // DFS forward from target looking for source
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(next.get(cur) ?? []));
  }
  return false;
}


/** IDs of every node with a path to the Output or to an Arrange (they join the Output wirelessly) */
export function nodesReachingOutput(nodes: NodeLike[], edges: EdgeLike[]): Set<string>{
    if(!nodes.some((n) => n.type === "output")) return new Set(); // no Output, nothing plays, Arrange included

    //build reverse lookup: target -> [sources that feed it]
    const feeders = new Map<string, string[]>();
    for( const e of edges){
        const list = feeders.get(e.target) ?? [];
        list.push(e.source);
        feeders.set(e.target, list);
    }

    //BFS backwards from every sink
    const sinks = nodes.filter((n) => n.type === "output" || n.type === "arrange").map((n) => n.id);
    const reached = new Set<string>(sinks);
    const queue = [...sinks];
    while(queue.length > 0){
        const current = queue.shift()!;
        for(const src of feeders.get(current)??[]){
            if(!reached.has(src)){
                reached.add(src);
                queue.push(src);
            }
        }
    }
    return reached;
}