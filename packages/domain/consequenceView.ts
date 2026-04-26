import { consequenceOrder, edgeDisplayNames, type EdgeType } from "./edges.js";
import type { NodeType, StoryNode } from "./nodes.js";

export type Consequence = {
  relationship: EdgeType;
  title: string;
  type: NodeType;
};

export type BeatView = StoryNode & {
  outgoing: Consequence[];
  incoming: Consequence[];
};

export function groupConsequences(consequences: Consequence[]): Map<EdgeType, Consequence[]> {
  const grouped = new Map<EdgeType, Consequence[]>();

  for (const consequence of consequences) {
    const group = grouped.get(consequence.relationship) ?? [];
    group.push(consequence);
    grouped.set(consequence.relationship, group);
  }

  for (const group of grouped.values()) {
    group.sort((left, right) => left.title.localeCompare(right.title));
  }

  return grouped;
}

export function formatConsequences(beatTitle: string, consequences: Consequence[]): string {
  const grouped = groupConsequences(consequences);
  const lines = [`Beat: ${beatTitle}`];

  for (const relationship of consequenceOrder) {
    const group = grouped.get(relationship);
    if (!group?.length || relationship === "BLOCKS") {
      continue;
    }

    lines.push("", `${edgeDisplayNames[relationship]}:`);
    for (const consequence of group) {
      lines.push(`- ${consequence.type}: ${consequence.title}`);
    }
  }

  return lines.join("\n");
}

export function formatKills(beatTitle: string, consequences: Consequence[]): string {
  const blocked = groupConsequences(consequences).get("BLOCKS") ?? [];
  const lines = [`Beat: ${beatTitle}`, "", "Blocks:"];

  if (!blocked.length) {
    lines.push("- Nothing directly blocked yet.");
    return lines.join("\n");
  }

  for (const consequence of blocked) {
    lines.push(`- ${consequence.type}: ${consequence.title}`);
  }

  return lines.join("\n");
}

export function formatBeatView(view: BeatView): string {
  const grouped = groupConsequences(view.outgoing);
  const involved = grouped.get("INVOLVES") ?? [];
  const lines = [
    `Beat: ${view.title}`,
    `Status: ${view.status ?? "unknown"}`,
    "",
    "Involves:",
  ];

  if (involved.length) {
    for (const consequence of involved) {
      lines.push(`- ${consequence.type}: ${consequence.title}`);
    }
  } else {
    lines.push("- No attached entities yet.");
  }

  lines.push(
    "",
    "Outgoing:",
  );

  const consequenceText = formatConsequences(view.title, view.outgoing)
    .split("\n")
    .slice(2)
    .join("\n");
  if (consequenceText.trim()) {
    lines.push(consequenceText);
  } else {
    lines.push("- No outgoing consequences yet.");
  }

  lines.push("", "Incoming:");
  if (view.incoming.length) {
    for (const consequence of view.incoming) {
      lines.push(`- ${edgeDisplayNames[consequence.relationship]} from ${consequence.type}: ${consequence.title}`);
    }
  } else {
    lines.push("- No prerequisites or references yet.");
  }

  return lines.join("\n");
}
