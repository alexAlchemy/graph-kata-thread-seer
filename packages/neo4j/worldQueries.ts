import type { Driver } from "neo4j-driver";

import { createId } from "../domain/ids.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";

export type World = {
  id: string;
  key?: string;
  name: string;
  description: string;
};

export async function createWorld(
  driver: Driver,
  name: string,
  description: string,
  key?: string,
): Promise<World> {
  if (!name.trim()) {
    throw new Error("World name is required.");
  }

  await ensureSchema(driver);

  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (w:World {name: $name})
        ON CREATE SET
          w.id = $id,
          w.key = $key,
          w.description = $description,
          w.createdAt = datetime()
        SET
          w.id = CASE
            WHEN w.id IS NULL THEN $id
            WHEN $key IS NOT NULL AND w.id = $key THEN $id
            ELSE w.id
          END,
          w.key = coalesce(w.key, $key),
          w.name = $name,
          w.description = $description,
          w.updatedAt = datetime()
        RETURN w {
          .id,
          .key,
          .name,
          .description
        } AS world
        `,
        { id: createId("w"), key: key ?? null, name, description },
      ),
    );

    return result.records[0]?.get("world") as World;
  } finally {
    await session.close();
  }
}

export async function findWorld(driver: Driver, reference: string): Promise<World | null> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (w:World)
        WHERE w.id = $reference OR w.key = $reference OR w.name = $reference
        RETURN w {
          .id,
          .key,
          .name,
          .description
        } AS world
        ORDER BY
          CASE
            WHEN w.id = $reference THEN 0
            WHEN w.key = $reference THEN 1
            ELSE 2
          END
        LIMIT 1
        `,
        { reference },
      ),
    );

    return (result.records[0]?.get("world") as World | undefined) ?? null;
  } finally {
    await session.close();
  }
}

export function worldHandle(world: World): string {
  return world.key ?? world.id;
}
