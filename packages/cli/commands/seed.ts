import { Command } from "commander";

import { setActiveWorld } from "../config.js";
import { seedForName, seedGraph } from "../../neo4j/seed.js";
import { withDriver } from "../../neo4j/connection.js";
import { findWorld, worldHandle } from "../../neo4j/worldQueries.js";

export function seedCommand(): Command {
  return new Command("seed")
    .description("Load a built-in story graph seed")
    .argument("<name>", "seed name, e.g. ash-kingdom")
    .action(async (name: string) => {
      const graph = seedForName(name);

      const world = await withDriver(async (driver) => {
        await seedGraph(driver, graph);
        return findWorld(driver, graph.world);
      });

      if (world) {
        await setActiveWorld({
          handle: worldHandle(world),
          id: world.id,
          name: world.name,
        });
      }

      console.log(`Seeded ${graph.world}: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
      if (world) {
        console.log(`Active world: ${world.name}`);
      }
    });
}
