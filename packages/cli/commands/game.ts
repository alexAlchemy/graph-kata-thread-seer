import { Command } from "commander";

import { formatBeatView, formatConsequences, formatKills } from "../../domain/consequenceView.js";
import { addBeat, collapseBeat, findBeat } from "../../neo4j/beatQueries.js";
import { withDriver } from "../../neo4j/connection.js";
import { createGame, findGame, gameHandle, listSourcebookThreadSeeds } from "../../neo4j/gameQueries.js";
import { createGameThreadFromSeed, listGameThreads } from "../../neo4j/gameThreadQueries.js";
import { setActiveGame, setActiveSourcebook, requireActiveGame, requireActiveSourcebook, readConfig } from "../config.js";

export function gameCommand(): Command {
  const game = new Command("game").description("Manage games and game-local threads/beats/events");

  game.command("create").argument("<name>").requiredOption("--sourcebook <sourcebook>").option("--description <description>")
    .action(async (name: string, options: { sourcebook: string; description?: string }) => {
      const saved = await withDriver((driver) => createGame(driver, options.sourcebook, name, options.description));
      await setActiveGame({ handle: gameHandle(saved), id: saved.id, name: saved.name, sourcebook: saved.sourcebook });
      await setActiveSourcebook({ handle: saved.sourcebook, id: saved.sourcebook, name: saved.sourcebook });
      console.log(`Saved Game: ${saved.name}`);
      console.log(`ID: ${saved.id}`);
      console.log(`Sourcebook: ${saved.sourcebook}`);
      console.log(`Active game: ${saved.name}`);
    });

  game.command("use").argument("<game>").action(async (reference: string) => {
    const found = await withDriver((driver) => findGame(driver, reference));
    if (!found) throw new Error(`Game not found: ${reference}`);
    await setActiveGame({ handle: gameHandle(found), id: found.id, name: found.name, sourcebook: found.sourcebook });
    console.log(`Active game: ${found.name}`);
    console.log(`ID: ${found.id}`);
  });

  game.command("current").action(async () => {
    const config = await readConfig();
    if (!config.activeGame) throw new Error("Please set active game");
    console.log(`Active game: ${config.activeGame.name}`);
    console.log(`ID: ${config.activeGame.id}`);
    console.log(`Sourcebook: ${config.activeGame.sourcebook}`);
  });

  const thread = new Command("thread");
  thread.command("create").requiredOption("--from <threadSeed>").action(async (options: { from: string }) => {
    const active = await requireActiveGame();
    const created = await withDriver((driver) => createGameThreadFromSeed(driver, active.handle, options.from));
    if (!created) throw new Error(`Thread seed not found: ${options.from}`);
    console.log(`Created GameThread: ${created.title}`);
    console.log(`Status: ${created.status}`);
  });

  thread.command("show").argument("<thread>").action(async (reference: string) => {
    const active = await requireActiveGame();
    const threads = await withDriver((driver) => listGameThreads(driver, active.handle));
    const found = threads.find((item) => item.id === reference || item.title === reference);
    if (!found) throw new Error(`Game thread not found: ${reference}`);
    console.log(`GameThread: ${found.title}`);
    console.log(`ID: ${found.id}`);
    console.log(`Status: ${found.status}`);
  });

  thread.command("list").action(async () => {
    const active = await requireActiveGame();
    const threads = await withDriver((driver) => listGameThreads(driver, active.handle));
    if (!threads.length) return console.log("No game threads found.");
    console.log(threads.map((t) => `${t.id}  ${t.title} (${t.status})`).join("\n"));
  });
  game.addCommand(thread);

  const beat = new Command("beat");
  beat.command("add").argument("<title>").requiredOption("--thread <thread>").option("--status <status>", "proposed|live|collapsed|invalidated|dormant", "proposed")
    .action(async (title: string, options: { thread: string; status: "proposed" | "live" | "collapsed" | "invalidated" | "dormant" }) => {
      const active = await requireActiveGame();
      await withDriver((driver) => addBeat(driver, active.handle, title, options.status, options.thread));
      console.log(`Saved Beat: ${title}`);
      console.log(`Status: ${options.status}`);
    });
  beat.command("show").argument("<title>").action(async (title: string) => {
    const active = await requireActiveGame();
    const view = await withDriver((driver) => findBeat(driver, active.handle, title));
    if (!view) throw new Error(`Beat not found: ${title}`);
    console.log(formatBeatView(view));
  });
  beat.command("consequences").argument("<title>").action(async (title: string) => {
    const active = await requireActiveGame();
    const view = await withDriver((driver) => findBeat(driver, active.handle, title));
    if (!view) throw new Error(`Beat not found: ${title}`);
    console.log(formatConsequences(view.title, view.outgoing));
  });
  beat.command("kills").argument("<title>").action(async (title: string) => {
    const active = await requireActiveGame();
    const view = await withDriver((driver) => findBeat(driver, active.handle, title));
    if (!view) throw new Error(`Beat not found: ${title}`);
    console.log(formatKills(view.title, view.outgoing));
  });
  beat.command("collapse").argument("<title>").action(async (title: string) => {
    const active = await requireActiveGame();
    const summary = await withDriver((driver) => collapseBeat(driver, active.handle, title));
    if (!summary) throw new Error(`Beat not found: ${title}`);
    console.log(`Created Event: ${summary.eventTitle}`);
    console.log(`Collapsed Beat: ${summary.beatTitle}`);
  });
  game.addCommand(beat);

  const sourcebook = new Command("sourcebook");
  sourcebook.command("thread-seeds").action(async () => {
    const active = await requireActiveSourcebook();
    const threads = await withDriver((driver) => listSourcebookThreadSeeds(driver, active.handle));
    if (!threads.length) return console.log("No thread seeds found.");
    console.log(threads.map((t) => `${t.id}  ${t.title}`).join("\n"));
  });

  return game;
}
