import { Command } from "commander";

import { withDriver } from "../../neo4j/connection.js";
import { listSourcebookThreadSeeds } from "../../neo4j/gameQueries.js";
import { findSourcebook, sourcebookHandle } from "../../neo4j/sourcebookQueries.js";
import { requireActiveSourcebook, setActiveSourcebook } from "../config.js";

export function sourcebookCommand(): Command {
  const sourcebook = new Command("sourcebook").description("Manage sourcebooks and sourcebook thread seeds");

  sourcebook.command("use").argument("<sourcebook>").action(async (reference: string) => {
    const found = await withDriver((driver) => findSourcebook(driver, reference));
    if (!found) throw new Error(`Sourcebook not found: ${reference}`);
    await setActiveSourcebook({ handle: sourcebookHandle(found), id: found.id, name: found.name });
    console.log(`Active sourcebook: ${found.name}`);
  });

  const thread = new Command("thread");
  thread.command("list").action(async () => {
    const active = await requireActiveSourcebook();
    const seeds = await withDriver((driver) => listSourcebookThreadSeeds(driver, active.handle));
    if (!seeds.length) return console.log("No sourcebook thread seeds found.");
    console.log(seeds.map((seed) => `${seed.id}  ${seed.title}`).join("\n"));
  });

  thread.command("show").argument("<thread>").action(async (reference: string) => {
    const active = await requireActiveSourcebook();
    const seeds = await withDriver((driver) => listSourcebookThreadSeeds(driver, active.handle));
    const found = seeds.find((seed) => seed.id === reference || seed.title === reference);
    if (!found) throw new Error(`Thread seed not found in ${active.name}: ${reference}`);
    console.log(`ThreadSeed: ${found.title}`);
    console.log(`ID: ${found.id}`);
  });

  sourcebook.addCommand(thread);
  return sourcebook;
}
