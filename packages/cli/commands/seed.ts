import { Command } from "commander";

import { setActiveGame, setActiveSourcebook } from "../config.js";
import { seedForName, seedGraph } from "../../neo4j/seed.js";
import { withDriver } from "../../neo4j/connection.js";
import { findGame } from "../../neo4j/gameQueries.js";
import { findSourcebook } from "../../neo4j/sourcebookQueries.js";

export function seedCommand(): Command {
  return new Command("seed")
    .description("Load a built-in sourcebook and demo game seed")
    .argument("<name>", "seed name, e.g. ash-kingdom")
    .action(async (name: string) => {
      const graph = seedForName(name);

      const seeded = await withDriver((driver) => seedGraph(driver, graph));
      const sourcebook = await withDriver((driver) => findSourcebook(driver, seeded.sourcebookHandle));
      const game = await withDriver((driver) => findGame(driver, seeded.gameId));

      if (sourcebook) {
        await setActiveSourcebook({ handle: seeded.sourcebookHandle, id: sourcebook.id, name: sourcebook.name });
      }

      if (game) {
        await setActiveGame({ handle: game.id, id: game.id, name: game.name, sourcebook: game.sourcebook });
      }

      console.log(`Seeded Sourcebook: ${graph.sourcebookName}`);
      console.log(`Seeded Game: ${graph.gameName}`);
      console.log(`Nodes: ${graph.nodes.length}, edges: ${graph.edges.length}.`);
    });
}
