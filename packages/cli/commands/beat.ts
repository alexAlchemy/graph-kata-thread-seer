import { Command } from "commander";

import { formatBeatView, formatConsequences, formatKills } from "../../domain/consequenceView.js";
import { withDriver } from "../../neo4j/connection.js";
import { addBeat, collapseBeat, findBeat } from "../../neo4j/beatQueries.js";
import { requireActiveGame } from "../config.js";

export function beatCommand(): Command {
  const beat = new Command("beat").description("Compatibility wrapper for game beat commands");

  beat
    .command("show")
    .argument("<title>")
    .action(async (title: string) => {
      const game = await requireActiveGame();
      const view = await withDriver((driver) => findBeat(driver, game.handle, title));
      if (!view) throw new Error(`Beat not found in ${game.name}: ${title}`);
      console.log(formatBeatView(view));
    });

  beat
    .command("consequences")
    .argument("<title>")
    .action(async (title: string) => {
      const game = await requireActiveGame();
      const view = await withDriver((driver) => findBeat(driver, game.handle, title));
      if (!view) throw new Error(`Beat not found in ${game.name}: ${title}`);
      console.log(formatConsequences(view.title, view.outgoing));
    });

  beat
    .command("kills")
    .argument("<title>")
    .action(async (title: string) => {
      const game = await requireActiveGame();
      const view = await withDriver((driver) => findBeat(driver, game.handle, title));
      if (!view) throw new Error(`Beat not found in ${game.name}: ${title}`);
      console.log(formatKills(view.title, view.outgoing));
    });

  beat
    .command("add")
    .argument("<title>")
    .requiredOption("--thread <thread>", "game thread id or title")
    .option("--status <status>", "proposed|live|collapsed|invalidated|dormant", "proposed")
    .action(async (title: string, options: { status: "proposed" | "live" | "collapsed" | "invalidated" | "dormant"; thread: string }) => {
      const game = await requireActiveGame();
      await withDriver((driver) => addBeat(driver, game.handle, title, options.status, options.thread));
      console.log(`Saved Beat: ${title}`);
      console.log(`Status: ${options.status}`);
    });

  beat
    .command("collapse")
    .argument("<title>")
    .action(async (title: string) => {
      const game = await requireActiveGame();
      const summary = await withDriver((driver) => collapseBeat(driver, game.handle, title));
      if (!summary) throw new Error(`Beat not found in ${game.name}: ${title}`);
      console.log(`Created Event: ${summary.eventTitle}`);
      console.log(`Collapsed Beat: ${summary.beatTitle}`);
      console.log("\nActivated states:");
      console.log(summary.activatedStates.length ? summary.activatedStates.map((x) => `- ${x}`).join("\n") : "- None");
      console.log("\nRevealed secrets:");
      console.log(summary.revealedSecrets.length ? summary.revealedSecrets.map((x) => `- ${x}`).join("\n") : "- None");
      console.log("\nEscalated pressures:");
      console.log(summary.escalatedPressures.length ? summary.escalatedPressures.map((x) => `- ${x}`).join("\n") : "- None");
      console.log("\nInvalidated beats:");
      console.log(summary.invalidatedBeats.length ? summary.invalidatedBeats.map((x) => `- ${x}`).join("\n") : "- None");
    });

  return beat;
}
