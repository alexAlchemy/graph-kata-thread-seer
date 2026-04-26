import { Command } from "commander";

import { requireActiveWorld } from "../config.js";
import { formatBeatView, formatConsequences, formatKills } from "../../domain/consequenceView.js";
import { withDriver } from "../../neo4j/connection.js";
import { addBeat, findBeat, outgoingConsequences } from "../../neo4j/beatQueries.js";
import { findWorld, worldHandle } from "../../neo4j/worldQueries.js";

export function beatCommand(): Command {
  const beat = new Command("beat")
    .description("Explore beat consequences")
    .addHelpText(
      "after",
      `

World selection:
  Beat commands use the active world set by "threadseer world use".
  Pass --world to override it for one command.
  Without either, commands return "Please set active world".`,
    );

  beat
    .command("show")
    .description("Show a beat and its direct graph relationships")
    .argument("<title>", "beat title")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (title: string, options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const view = await withDriver((driver) => findBeat(driver, world, title));
      if (!view) {
        throw new Error(`Beat not found in ${world}: ${title}`);
      }

      console.log(formatBeatView(view));
    });

  beat
    .command("consequences")
    .description("Show what a beat requires, reveals, creates, escalates, and enables")
    .argument("<title>", "beat title")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (title: string, options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const consequences = await withDriver((driver) =>
        outgoingConsequences(driver, world, title),
      );
      if (!consequences) {
        throw new Error(`Beat not found in ${world}: ${title}`);
      }

      console.log(formatConsequences(title, consequences));
    });

  beat
    .command("kills")
    .description("Show futures directly blocked or invalidated by a beat")
    .argument("<title>", "beat title")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (title: string, options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const consequences = await withDriver((driver) =>
        outgoingConsequences(driver, world, title),
      );
      if (!consequences) {
        throw new Error(`Beat not found in ${world}: ${title}`);
      }

      console.log(formatKills(title, consequences));
    });

  beat
    .command("add")
    .description("Add or update a beat without wiring relationships yet")
    .argument("<title>", "beat title")
    .option("--status <status>", "beat status: possible or canon", "possible")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (title: string, options: { status: string; world?: string }) => {
      if (options.status !== "possible" && options.status !== "canon") {
        throw new Error(`Unsupported beat status: ${options.status}`);
      }

      const world = await resolveWorldOption(options.world);
      const status = options.status;
      await withDriver((driver) => addBeat(driver, world, title, status));
      console.log(`Saved Beat: ${title}`);
      console.log(`Status: ${status}`);
    });

  return beat;
}

async function resolveWorldOption(world?: string): Promise<string> {
  if (world) {
    const found = await withDriver((driver) => findWorld(driver, world));
    if (!found) {
      throw new Error(`World not found: ${world}`);
    }

    return worldHandle(found);
  }

  return (await requireActiveWorld()).handle;
}
