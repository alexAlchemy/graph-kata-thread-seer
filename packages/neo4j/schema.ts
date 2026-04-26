import type { Driver } from "neo4j-driver";

import { configFromEnv } from "./connection.js";

export async function ensureSchema(driver: Driver): Promise<void> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run("CREATE CONSTRAINT sourcebook_id IF NOT EXISTS FOR (s:Sourcebook) REQUIRE s.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT sourcebook_name IF NOT EXISTS FOR (s:Sourcebook) REQUIRE s.name IS UNIQUE");
      await tx.run("CREATE CONSTRAINT sourcebook_key IF NOT EXISTS FOR (s:Sourcebook) REQUIRE s.key IS UNIQUE");
      await tx.run("CREATE CONSTRAINT game_id IF NOT EXISTS FOR (g:Game) REQUIRE g.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT game_sourcebook_name IF NOT EXISTS FOR (g:Game) REQUIRE (g.sourcebook, g.name) IS UNIQUE");
      await tx.run("CREATE CONSTRAINT beat_id IF NOT EXISTS FOR (b:Beat) REQUIRE b.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT beat_game_title IF NOT EXISTS FOR (b:Beat) REQUIRE (b.game, b.title) IS UNIQUE");
      await tx.run("CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT game_thread_id IF NOT EXISTS FOR (t:GameThread) REQUIRE t.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT thread_seed_id IF NOT EXISTS FOR (t:ThreadSeed) REQUIRE t.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE");
      await tx.run("CREATE CONSTRAINT entity_sourcebook_name IF NOT EXISTS FOR (e:Entity) REQUIRE (e.sourcebook, e.name) IS UNIQUE");
    });
  } finally {
    await session.close();
  }
}
