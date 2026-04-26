import { Command } from "commander";

import { readConfig } from "../config.js";

export function worldCommand(): Command {
  const world = new Command("world").description("Legacy alias. Use sourcebook/game commands instead.");

  world.command("current").action(async () => {
    const config = await readConfig();
    if (!config.activeSourcebook) throw new Error("Please set active sourcebook");
    console.log(`Active sourcebook: ${config.activeSourcebook.name}`);
  });

  return world;
}
