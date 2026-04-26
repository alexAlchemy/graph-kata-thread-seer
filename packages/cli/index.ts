#!/usr/bin/env node
import { Command } from "commander";

import { beatCommand } from "./commands/beat.js";
import { gameCommand } from "./commands/game.js";
import { seedCommand } from "./commands/seed.js";
import { sourcebookCommand } from "./commands/sourcebook.js";
import { worldCommand } from "./commands/world.js";

const program = new Command();

program
  .name("threadseer")
  .description("Graph-native narrative consequence explorer")
  .version("0.2.0");

program.addCommand(seedCommand());
program.addCommand(sourcebookCommand());
program.addCommand(gameCommand());
program.addCommand(beatCommand());
program.addCommand(worldCommand());

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
