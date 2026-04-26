#!/usr/bin/env node
import { Command } from "commander";

import { beatCommand } from "./commands/beat.js";
import { seedCommand } from "./commands/seed.js";
import { worldCommand } from "./commands/world.js";

const program = new Command();

program
  .name("threadseer")
  .description("Graph-native narrative consequence explorer")
  .version("0.1.0");

program.addCommand(seedCommand());
program.addCommand(worldCommand());
program.addCommand(beatCommand());

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
