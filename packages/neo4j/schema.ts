import type { Driver } from "neo4j-driver";

import { configFromEnv } from "./connection.js";

export async function ensureSchema(driver: Driver): Promise<void> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run("CREATE CONSTRAINT world_id IF NOT EXISTS FOR (w:World) REQUIRE w.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT world_name IF NOT EXISTS FOR (w:World) REQUIRE w.name IS UNIQUE");
      await tx.run("CREATE CONSTRAINT world_key IF NOT EXISTS FOR (w:World) REQUIRE w.key IS UNIQUE");
      await tx.run("CREATE CONSTRAINT beat_id IF NOT EXISTS FOR (b:Beat) REQUIRE b.id IS UNIQUE");
    });
  } finally {
    await session.close();
  }
}
