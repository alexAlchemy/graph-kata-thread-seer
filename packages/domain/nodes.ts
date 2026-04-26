export const nodeTypes = ["Beat", "Thread", "Pressure", "Secret", "State"] as const;

export type NodeType = (typeof nodeTypes)[number];

export type StoryNode = {
  id: string;
  type: NodeType;
  title: string;
  status?: "possible" | "canon";
};

export function primaryNodeType(labels: string[]): NodeType {
  const label = labels.find((candidate): candidate is NodeType =>
    nodeTypes.includes(candidate as NodeType),
  );

  if (!label) {
    throw new Error(`Expected one of ${nodeTypes.join(", ")} labels, got: ${labels.join(", ")}`);
  }

  return label;
}
