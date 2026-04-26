import { Command } from "commander";

import { requireActiveWorld } from "../config.js";
import { formatBeatView, formatConsequences, formatKills } from "../../domain/consequenceView.js";
import { withDriver } from "../../neo4j/connection.js";
import { addBeat, findBeat } from "../../neo4j/beatQueries.js";
import {
  attachEntityToBeat,
  createEntity,
  entitiesForBeat,
  listEntities,
  type Entity,
} from "../../neo4j/entityQueries.js";
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
      const view = await withDriver((driver) => findBeat(driver, world, title));
      if (!view) {
        throw new Error(`Beat not found in ${world}: ${title}`);
      }

      console.log(formatConsequences(view.title, view.outgoing));
    });

  beat
    .command("kills")
    .description("Show futures directly blocked or invalidated by a beat")
    .argument("<title>", "beat title")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (title: string, options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const view = await withDriver((driver) => findBeat(driver, world, title));
      if (!view) {
        throw new Error(`Beat not found in ${world}: ${title}`);
      }

      console.log(formatKills(view.title, view.outgoing));
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

  beat.addCommand(beatEntityCommand());

  return beat;
}

function beatEntityCommand(): Command {
  const entity = new Command("entity")
    .description("Create, list, and attach entities used by beats")
    .addHelpText(
      "after",
      `

Entity types:
  Character, Faction, Location

References:
  Beat references can be beat ids or exact titles.
  Entity references can be entity ids or exact names.`,
    );

  entity
    .command("create")
    .description("Create or update a Character, Faction, or Location")
    .argument("<type>", "Character, Faction, or Location")
    .argument("<name>", "entity name")
    .argument("[description]", "entity description")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(
      async (
        type: "Character" | "Faction" | "Location",
        name: string,
        description: string | undefined,
        options: { world?: string },
      ) => {
        const world = await resolveWorldOption(options.world);
        const saved = await withDriver((driver) =>
          createEntity(driver, world, type, name, description),
        );

        console.log(`Saved ${saved.type}: ${saved.name}`);
        console.log(`ID: ${saved.id}`);
        if (saved.description) {
          console.log(`Description: ${saved.description}`);
        }
      },
    );

  entity
    .command("list")
    .description("List entities in the active world")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const entities = await withDriver((driver) => listEntities(driver, world));

      if (!entities.length) {
        console.log("No entities found.");
        return;
      }

      console.log(formatEntityList(entities));
    });

  entity
    .command("attach")
    .description("Attach an entity to a beat with INVOLVES")
    .requiredOption("-b, --beat <beat>", "beat id or exact title")
    .requiredOption("-e, --entity <entity>", "entity id or exact name")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (options: { beat: string; entity: string; world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const attachment = await withDriver((driver) =>
        attachEntityToBeat(driver, world, options.beat, options.entity),
      );

      if (!attachment) {
        throw new Error(`Could not attach entity "${options.entity}" to beat "${options.beat}".`);
      }

      console.log(`Attached ${attachment.entity.type}: ${attachment.entity.name}`);
      console.log(`Beat: ${attachment.beat.title}`);
    });

  entity
    .command("for")
    .description("List entities attached to a beat")
    .argument("<beat>", "beat id or exact title")
    .option("-w, --world <world>", "story world id, key, or name; defaults to active world")
    .action(async (beatReference: string, options: { world?: string }) => {
      const world = await resolveWorldOption(options.world);
      const result = await withDriver((driver) =>
        entitiesForBeat(driver, world, beatReference),
      );

      if (!result) {
        throw new Error(`Beat not found in ${world}: ${beatReference}`);
      }

      console.log(`Beat: ${result.beat.title}`);
      if (!result.entities.length) {
        console.log("No attached entities.");
        return;
      }

      console.log("");
      console.log(formatEntityList(result.entities));
    });

  return entity;
}

function formatEntityList(entities: Entity[]): string {
  return entities
    .map((entity) => {
      const description = entity.description ? ` - ${entity.description}` : "";
      return `${entity.id}  ${entity.type}: ${entity.name}${description}`;
    })
    .join("\n");
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
