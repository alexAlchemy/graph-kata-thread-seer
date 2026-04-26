export const edgeTypes = [
  "REQUIRES",
  "ENABLES",
  "BLOCKS",
  "REVEALS",
  "ESCALATES",
  "CREATES",
] as const;

export type EdgeType = (typeof edgeTypes)[number];

export const edgeDisplayNames: Record<EdgeType, string> = {
  REQUIRES: "Requires",
  ENABLES: "Enables",
  BLOCKS: "Blocks",
  REVEALS: "Reveals",
  ESCALATES: "Escalates",
  CREATES: "Creates",
};

export const consequenceOrder: EdgeType[] = [
  "REQUIRES",
  "REVEALS",
  "CREATES",
  "ESCALATES",
  "ENABLES",
  "BLOCKS",
];
