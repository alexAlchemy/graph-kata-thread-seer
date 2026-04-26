import type { Driver, ManagedTransaction } from "neo4j-driver";

import { type EdgeType, edgeTypes } from "../domain/edges.js";
import { entityTypes, nodeTypes, type NodeType } from "../domain/nodes.js";
import { type SeedGraph, seedGraphSchema } from "../domain/schemas.js";
import { configFromEnv } from "./connection.js";
import { createGame } from "./gameQueries.js";
import { ensureSchema } from "./schema.js";
import { createSourcebook, findSourcebook, sourcebookHandle } from "./sourcebookQueries.js";

export const ashKingdomSeed = seedGraphSchema.parse({
  sourcebook: "ash-kingdom",
  sourcebookName: "Ash Kingdom",
  sourcebookDescription: "A brittle succession crisis under pressure from court paranoia and famine unrest.",
  game: "ash-kingdom-demo-game",
  gameName: "Ash Kingdom Demo Game",
  nodes: [
    { id: "threadseed-crown", type: "ThreadSeed", title: "The Crown Without a King" },
    { id: "pressure-court-paranoia", type: "Pressure", title: "Court paranoia" },
    { id: "pressure-famine-unrest", type: "Pressure", title: "Famine unrest" },
    { id: "secret-mara-heir", type: "Secret", title: "Mara is the true heir" },
    { id: "entity-mara", type: "Character", title: "Mara" },
    { id: "entity-regent", type: "Character", title: "The regent" },
    { id: "entity-northern-houses", type: "Faction", title: "The northern houses" },
    { id: "entity-feast-hall", type: "Location", title: "The feast hall" },
    { id: "state-public-claimant", type: "State", title: "Mara becomes a public claimant" },
    { id: "state-factions-split", type: "State", title: "Court factions openly split" },
    { id: "beat-mara-reveals", type: "Beat", title: "Mara reveals herself at the feast", status: "proposed" },
    { id: "beat-regent-fraud", type: "Beat", title: "The regent brands Mara a fraud", status: "proposed" },
    { id: "beat-northern-houses", type: "Beat", title: "The northern houses rally behind Mara", status: "proposed" },
    { id: "beat-assassin-feast", type: "Beat", title: "The assassin strikes during the feast", status: "proposed" },
    { id: "beat-mara-secret", type: "Beat", title: "Mara continues operating in secret", status: "proposed" },
    { id: "beat-mara-evidence", type: "Beat", title: "Mara gathers evidence quietly", status: "proposed" },
    { id: "beat-regent-exposes", type: "Beat", title: "The regent exposes himself before knowing Mara lives", status: "proposed" },
  ],
  edges: [
    { from: "beat-mara-reveals", type: "REQUIRES", to: "secret-mara-heir" },
    { from: "beat-mara-reveals", type: "REVEALS", to: "secret-mara-heir" },
    { from: "beat-mara-reveals", type: "CREATES", to: "state-public-claimant" },
    { from: "beat-mara-reveals", type: "CREATES", to: "state-factions-split" },
    { from: "beat-mara-reveals", type: "ESCALATES", to: "threadseed-crown" },
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
    { from: "pressure-famine-unrest", type: "ESCALATES", to: "threadseed-crown" },
  ],
} satisfies SeedGraph);

export function seedForName(name: string): SeedGraph {
  if (name !== ashKingdomSeed.sourcebook) throw new Error(`Unknown seed "${name}". Available seeds: ${ashKingdomSeed.sourcebook}`);
  return ashKingdomSeed;
}

export async function seedGraph(driver: Driver, graph: SeedGraph): Promise<{sourcebookHandle: string; gameId: string}> {
  await ensureSchema(driver);
  await createSourcebook(driver, graph.sourcebookName, graph.sourcebookDescription, graph.sourcebook);
  const sourcebook = await findSourcebook(driver, graph.sourcebook);
  if (!sourcebook) throw new Error("Seed sourcebook creation failed.");
  const sourcebookKey = sourcebookHandle(sourcebook);
  const game = await createGame(driver, sourcebookKey, graph.gameName, "Demo campaign instantiated from the Ash Kingdom sourcebook.");

  const session = driver.session({ database: configFromEnv().database });
  try {
    await session.executeWrite(async (tx) => {
      await tx.run("MATCH (n {sourcebook: $sourcebook}) DETACH DELETE n", { sourcebook: sourcebookKey });
      await tx.run("MATCH (n {game: $game}) DETACH DELETE n", { game: game.id });

      for (const node of graph.nodes) {
        assertNodeType(node.type);
        const labels = labelsForNodeType(node.type);
        const scope = node.type === "Beat" ? { game: game.id, sourcebook: null } : { sourcebook: sourcebookKey, game: null };
        await tx.run(`CREATE (n:${labels} {id:$id,title:$title,name:$name,status:$status,sourcebook:$sourcebook,game:$game})`, {
          id: node.id, title: node.title, status: node.status ?? null, sourcebook: scope.sourcebook, game: scope.game,
          name: entityTypes.includes(node.type as never) ? node.title : null,
        });
      }

      await tx.run(
        `MATCH (seed:ThreadSeed {sourcebook: $sourcebook, id: 'threadseed-crown'})
         MERGE (thread:GameThread {game: $game, title: seed.title})
         ON CREATE SET thread.id = 'gamethread-crown', thread.status = 'active', thread.createdAt = datetime()
         SET thread.updatedAt = datetime()
         MERGE (thread)-[:INSTANTIATED_FROM]->(seed)`,
        { sourcebook: sourcebookKey, game: game.id },
      );

      for (const edge of graph.edges) await createEdge(tx, sourcebookKey, game.id, edge.from, edge.type, edge.to);
    });
  } finally { await session.close(); }

  return { sourcebookHandle: sourcebookKey, gameId: game.id };
}

function labelsForNodeType(type: NodeType): string { if (entityTypes.includes(type as never)) return `Entity:${type}`; return type; }
function assertNodeType(type: NodeType): void { if (!nodeTypes.includes(type)) throw new Error(`Unsupported node type: ${type}`); }
async function createEdge(tx: ManagedTransaction, sourcebook: string, game: string, from: string, type: EdgeType, to: string): Promise<void> {
  if (!edgeTypes.includes(type)) throw new Error(`Unsupported edge type: ${type}`);
  await tx.run(`MATCH (from {id:$from}) WHERE from.sourcebook = $sourcebook OR from.game = $game MATCH (to {id:$to}) WHERE to.sourcebook = $sourcebook OR to.game = $game CREATE (from)-[:${type}]->(to)`, { sourcebook, game, from, to });
}
