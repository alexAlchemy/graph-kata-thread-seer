import type { Driver } from "neo4j-driver";

import { createId } from "../domain/ids.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";
import { findSourcebook, sourcebookHandle } from "./sourcebookQueries.js";

export type Game = {
  id: string;
  sourcebook: string;
  name: string;
  description?: string;
};

export async function createGame(
  driver: Driver,
  sourcebookReference: string,
  name: string,
  description?: string,
): Promise<Game> {
  await ensureSchema(driver);
  const sourcebook = await findSourcebook(driver, sourcebookReference);
  if (!sourcebook) {
    throw new Error(`Sourcebook not found: ${sourcebookReference}`);
  }

  const sourcebookHandleValue = sourcebookHandle(sourcebook);
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MATCH (s:Sourcebook {id: $sourcebookId})
        MERGE (g:Game {sourcebook: $sourcebookHandle, name: $name})
        ON CREATE SET g.id = $id, g.createdAt = datetime()
        SET g.description = $description, g.updatedAt = datetime()
        MERGE (g)-[:USES_SOURCEBOOK]->(s)
        RETURN g { .id, .sourcebook, .name, .description } AS game
        `,
        {
          id: createId("g"),
          sourcebookId: sourcebook.id,
          sourcebookHandle: sourcebookHandleValue,
          name,
          description: description ?? null,
        },
      ),
    );

    return result.records[0]?.get("game") as Game;
  } finally {
    await session.close();
  }
}

export async function findGame(driver: Driver, reference: string): Promise<Game | null> {
  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (g:Game)
        WHERE g.id = $reference OR g.name = $reference
        RETURN g { .id, .sourcebook, .name, .description } AS game
        ORDER BY CASE WHEN g.id = $reference THEN 0 ELSE 1 END
        LIMIT 1
        `,
        { reference },
      ),
    );

    return (result.records[0]?.get("game") as Game | undefined) ?? null;
  } finally {
    await session.close();
  }
}

export function gameHandle(game: Game): string {
  return game.id;
}

export async function listSourcebookThreadSeeds(
  driver: Driver,
  sourcebookReference: string,
): Promise<Array<{ id: string; title: string }>> {
  const sourcebook = await findSourcebook(driver, sourcebookReference);
  if (!sourcebook) {
    throw new Error(`Sourcebook not found: ${sourcebookReference}`);
  }

  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `MATCH (t:ThreadSeed {sourcebook: $sourcebook}) RETURN t { .id, .title } AS thread ORDER BY t.title`,
        { sourcebook: sourcebookHandle(sourcebook) },
      ),
    );
    return result.records.map((record) => record.get("thread") as { id: string; title: string });
  } finally {
    await session.close();
  }
}
