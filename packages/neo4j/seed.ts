import type { Driver, ManagedTransaction } from "neo4j-driver";

import { type EdgeType, edgeTypes } from "../domain/edges.js";
import { entityTypes, nodeTypes, type NodeType } from "../domain/nodes.js";
import { type SeedGraph, seedGraphSchema } from "../domain/schemas.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";
import { createWorld } from "./worldQueries.js";

export const ashKingdomSeed = seedGraphSchema.parse({
  world: "ash-kingdom",
  nodes: [
    { id: "thread-crown", type: "Thread", title: "The Crown Without a King" },
    { id: "pressure-court-paranoia", type: "Pressure", title: "Court paranoia" },
    { id: "pressure-famine-unrest", type: "Pressure", title: "Famine unrest" },
    { id: "secret-mara-heir", type: "Secret", title: "Mara is the true heir" },
    { id: "entity-mara", type: "Character", title: "Mara" },
    { id: "entity-regent", type: "Character", title: "The regent" },
    { id: "entity-northern-houses", type: "Faction", title: "The northern houses" },
    { id: "entity-feast-hall", type: "Location", title: "The feast hall" },
    {
      id: "beat-mara-reveals",
      type: "Beat",
      title: "Mara reveals herself at the feast",
      status: "possible",
    },
    {
      id: "beat-regent-fraud",
      type: "Beat",
      title: "The regent brands Mara a fraud",
      status: "possible",
    },
    {
      id: "beat-northern-houses",
      type: "Beat",
      title: "The northern houses rally behind Mara",
      status: "possible",
    },
    {
      id: "beat-assassin-feast",
      type: "Beat",
      title: "The assassin strikes during the feast",
      status: "possible",
    },
    {
      id: "beat-mara-secret",
      type: "Beat",
      title: "Mara continues operating in secret",
      status: "possible",
    },
    {
      id: "beat-mara-evidence",
      type: "Beat",
      title: "Mara gathers evidence quietly",
      status: "possible",
    },
    {
      id: "beat-regent-exposes",
      type: "Beat",
      title: "The regent exposes himself before knowing Mara lives",
      status: "possible",
    },
    { id: "state-public-claimant", type: "State", title: "Mara becomes a public claimant" },
    { id: "state-factions-split", type: "State", title: "Court factions openly split" },
  ],
  edges: [
    { from: "beat-mara-reveals", type: "REQUIRES", to: "secret-mara-heir" },
    { from: "beat-mara-reveals", type: "REVEALS", to: "secret-mara-heir" },
    { from: "beat-mara-reveals", type: "CREATES", to: "state-public-claimant" },
    { from: "beat-mara-reveals", type: "CREATES", to: "state-factions-split" },
    { from: "beat-mara-reveals", type: "ESCALATES", to: "thread-crown" },
    { from: "beat-mara-reveals", type: "ESCALATES", to: "pressure-court-paranoia" },
    { from: "beat-mara-reveals", type: "ENABLES", to: "beat-northern-houses" },
    { from: "beat-mara-reveals", type: "ENABLES", to: "beat-regent-fraud" },
    { from: "beat-mara-reveals", type: "BLOCKS", to: "beat-mara-secret" },
    { from: "beat-mara-reveals", type: "BLOCKS", to: "beat-mara-evidence" },
    { from: "beat-mara-reveals", type: "BLOCKS", to: "beat-regent-exposes" },
    { from: "beat-mara-reveals", type: "INVOLVES", to: "entity-mara" },
    { from: "beat-mara-reveals", type: "INVOLVES", to: "entity-feast-hall" },
    { from: "beat-regent-fraud", type: "INVOLVES", to: "entity-regent" },
    { from: "beat-northern-houses", type: "INVOLVES", to: "entity-northern-houses" },
    { from: "beat-assassin-feast", type: "ESCALATES", to: "pressure-court-paranoia" },
    { from: "pressure-famine-unrest", type: "ESCALATES", to: "thread-crown" },
  ],
} satisfies SeedGraph);

export function seedForName(name: string): SeedGraph {
  if (name !== ashKingdomSeed.world) {
    throw new Error(`Unknown seed "${name}". Available seeds: ${ashKingdomSeed.world}`);
  }

  return ashKingdomSeed;
}

export async function seedGraph(driver: Driver, graph: SeedGraph): Promise<void> {
  await ensureSchema(driver);
  await createWorld(
    driver,
    "Ash Kingdom",
    "A brittle succession crisis under pressure from court paranoia and famine unrest.",
    graph.world,
  );

  const session = driver.session({ database: configFromEnv().database });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run("MATCH (n {world: $world}) DETACH DELETE n", { world: graph.world });

      for (const node of graph.nodes) {
        assertNodeType(node.type);
        const labels = labelsForNodeType(node.type);
        await tx.run(
          `CREATE (n:${labels} {id: $id, world: $world, title: $title, name: $name, status: $status})`,
          {
            id: node.id,
            world: graph.world,
            title: node.title,
            name: entityTypes.includes(node.type as (typeof entityTypes)[number])
              ? node.title
              : null,
            status: node.status ?? null,
          },
        );
      }

      for (const edge of graph.edges) {
        await createEdge(tx, graph.world, edge.from, edge.type, edge.to);
      }
    });
  } finally {
    await session.close();
  }
}

function labelsForNodeType(type: NodeType): string {
  if (entityTypes.includes(type as (typeof entityTypes)[number])) {
    return `Entity:${type}`;
  }

  return type;
}

function assertNodeType(type: NodeType): void {
  if (!nodeTypes.includes(type)) {
    throw new Error(`Unsupported node type: ${type}`);
  }
}

async function createEdge(
  tx: ManagedTransaction,
  world: string,
  from: string,
  type: EdgeType,
  to: string,
): Promise<void> {
  if (!edgeTypes.includes(type)) {
    throw new Error(`Unsupported edge type: ${type}`);
  }

  await tx.run(
    `
    MATCH (from {world: $world, id: $from})
    MATCH (to {world: $world, id: $to})
    CREATE (from)-[:${type}]->(to)
    `,
    { world, from, to },
  );
}
