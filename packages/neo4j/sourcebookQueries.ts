import type { Driver } from "neo4j-driver";

import { createId } from "../domain/ids.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";

export type Sourcebook = {
  id: string;
  key?: string;
  name: string;
  description: string;
};

export async function createSourcebook(
  driver: Driver,
  name: string,
  description: string,
  key?: string,
): Promise<Sourcebook> {
  await ensureSchema(driver);
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (s:Sourcebook {name: $name})
        ON CREATE SET
          s.id = $id,
          s.key = $key,
          s.description = $description,
          s.createdAt = datetime()
        SET
          s.id = CASE WHEN s.id IS NULL THEN $id ELSE s.id END,
          s.key = coalesce(s.key, $key),
          s.description = $description,
          s.updatedAt = datetime()
        RETURN s { .id, .key, .name, .description } AS sourcebook
        `,
        { id: createId("s"), key: key ?? null, name, description },
      ),
    );

    return result.records[0]?.get("sourcebook") as Sourcebook;
  } finally {
    await session.close();
  }
}

export async function findSourcebook(driver: Driver, reference: string): Promise<Sourcebook | null> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (s:Sourcebook)
        WHERE s.id = $reference OR s.key = $reference OR s.name = $reference
        RETURN s { .id, .key, .name, .description } AS sourcebook
        ORDER BY CASE WHEN s.id = $reference THEN 0 WHEN s.key = $reference THEN 1 ELSE 2 END
        LIMIT 1
        `,
        { reference },
      ),
    );

    return (result.records[0]?.get("sourcebook") as Sourcebook | undefined) ?? null;
  } finally {
    await session.close();
  }
}

export function sourcebookHandle(sourcebook: Sourcebook): string {
  return sourcebook.key ?? sourcebook.id;
}
