import { Command } from "commander";

import { readConfig, setActiveWorld } from "../config.js";
import { withDriver } from "../../neo4j/connection.js";
import { createWorld, findWorld, worldHandle } from "../../neo4j/worldQueries.js";

export function worldCommand(): Command {
  const world = new Command("world").description("Manage story worlds");

  world
    .command("create")
    .description("Create or update a story world")
    .argument("<name>", "world name")
    .argument("<description>", "world description")
    .action(async (name: string, description: string) => {
      const saved = await withDriver((driver) => createWorld(driver, name, description));
      await setActiveWorld({
        handle: worldHandle(saved),
        id: saved.id,
        name: saved.name,
      });

      console.log(`Saved World: ${saved.name}`);
      console.log(`ID: ${saved.id}`);
      console.log(`Description: ${saved.description}`);
      console.log(`Active world: ${saved.name}`);
    });

  world
    .command("use")
    .description("Set the active story world for later commands")
    .argument("<world>", "world id, key, or name")
    .action(async (reference: string) => {
      const found = await withDriver((driver) => findWorld(driver, reference));
      if (!found) {
        throw new Error(`World not found: ${reference}`);
      }

      await setActiveWorld({
        handle: worldHandle(found),
        id: found.id,
        name: found.name,
      });

      console.log(`Active world: ${found.name}`);
      console.log(`ID: ${found.id}`);
    });

  world
    .command("current")
    .description("Show the active story world")
    .action(async () => {
      const config = await readConfig();
      if (!config.activeWorld) {
        throw new Error("Please set active world");
      }

      console.log(`Active world: ${config.activeWorld.name}`);
      console.log(`ID: ${config.activeWorld.id}`);
    });

  return world;
}
