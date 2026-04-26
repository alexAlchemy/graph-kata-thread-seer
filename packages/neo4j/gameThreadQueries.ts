import type { Driver } from "neo4j-driver";

import { createId } from "../domain/ids.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";
import { findGame } from "./gameQueries.js";

export type GameThreadStatus = "active" | "dormant" | "resolved" | "invalidated";

export async function createGameThreadFromSeed(
  driver: Driver,
  gameReference: string,
  threadSeedReference: string,
): Promise<{ id: string; title: string; status: GameThreadStatus } | null> {
  await ensureSchema(driver);
  const game = await findGame(driver, gameReference);
  if (!game) {
    throw new Error(`Game not found: ${gameReference}`);
  }

  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MATCH (g:Game {id: $gameId})
        MATCH (seed:ThreadSeed {sourcebook: g.sourcebook})
        WHERE seed.id = $threadRef OR seed.title = $threadRef
        MERGE (thread:GameThread {game: g.id, title: seed.title})
        ON CREATE SET thread.id = $threadId, thread.status = 'active', thread.createdAt = datetime()
        SET thread.updatedAt = datetime()
        MERGE (thread)-[:INSTANTIATED_FROM]->(seed)
        RETURN thread { .id, .title, .status } AS thread
        LIMIT 1
        `,
        { gameId: game.id, threadRef: threadSeedReference, threadId: createId("gt") },
      ),
    );

    return (result.records[0]?.get("thread") as { id: string; title: string; status: GameThreadStatus } | undefined) ?? null;
  } finally {
    await session.close();
  }
}

export async function listGameThreads(driver: Driver, gameReference: string): Promise<Array<{id: string; title: string; status: GameThreadStatus}>> {
  const game = await findGame(driver, gameReference);
  if (!game) {
    throw new Error(`Game not found: ${gameReference}`);
  }
  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(`MATCH (t:GameThread {game: $gameId}) RETURN t { .id, .title, .status } AS thread ORDER BY t.title`, {gameId: game.id}),
    );
    return result.records.map((r) => r.get("thread") as {id: string; title: string; status: GameThreadStatus});
  } finally { await session.close(); }
}
