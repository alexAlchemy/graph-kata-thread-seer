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
      await tx.run("CREATE CONSTRAINT beat_world_title IF NOT EXISTS FOR (b:Beat) REQUIRE (b.world, b.title) IS UNIQUE");
      await tx.run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT entity_world_name IF NOT EXISTS FOR (e:Entity) REQUIRE (e.world, e.name) IS UNIQUE");
    });
  } finally {
    await session.close();
  }
}
