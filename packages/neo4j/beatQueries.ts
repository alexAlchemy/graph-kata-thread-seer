import type { Driver } from "neo4j-driver";

import type { Consequence } from "../domain/consequenceView.js";
import { createId } from "../domain/ids.js";
import { primaryNodeType, type BeatStatus } from "../domain/nodes.js";
import { configFromEnv } from "./connection.js";
import { findGame } from "./gameQueries.js";
import { ensureSchema } from "./schema.js";

export type BeatView = {
  id: string;
  type: "Beat";
  title: string;
  status?: BeatStatus;
  outgoing: Consequence[];
  incoming: Consequence[];
};

export async function addBeat(
  driver: Driver,
  gameReference: string,
  title: string,
  status: BeatStatus,
  threadReference?: string,
): Promise<void> {
  await ensureSchema(driver);
  const game = await findGame(driver, gameReference);
  if (!game) {
    throw new Error(`Game not found: ${gameReference}`);
  }

  const session = driver.session({ database: configFromEnv().database });

  try {
    await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (b:Beat {game: $game, title: $title})
        ON CREATE SET b.id = $id, b.createdAt = datetime()
        SET b.status = $status, b.updatedAt = datetime()
        WITH b
        OPTIONAL MATCH (t:GameThread {game: $game})
        WHERE $threadReference IS NOT NULL AND (t.id = $threadReference OR t.title = $threadReference)
        FOREACH (_ IN CASE WHEN t IS NULL THEN [] ELSE [1] END | MERGE (b)-[:ADVANCES]->(t))
        `,
        { game: game.id, title, status, id: createId("b"), threadReference: threadReference ?? null },
      ),
    );
  } finally {
    await session.close();
  }
}

export async function findBeat(driver: Driver, gameReference: string, reference: string): Promise<BeatView | null> {
  const game = await findGame(driver, gameReference);
  if (!game) {
    throw new Error(`Game not found: ${gameReference}`);
  }

  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (b:Beat {game: $game})
        WHERE b.id = $reference OR b.title = $reference
        OPTIONAL MATCH (b)-[out]->(target)
        OPTIONAL MATCH (source)-[incoming]->(b)
        RETURN b { .id, .title, .status } AS beat,
          collect(DISTINCT { relationship: type(out), title: target.title, labels: labels(target) }) AS outgoing,
          collect(DISTINCT { relationship: type(incoming), title: source.title, labels: labels(source) }) AS incoming
        LIMIT 1
        `,
        { game: game.id, reference },
      ),
    );

    const record = result.records[0];
    if (!record) return null;
    const beat = record.get("beat") as { id: string; title: string; status?: BeatStatus };
    return {
      id: beat.id,
      title: beat.title,
      status: beat.status,
      type: "Beat",
      outgoing: toConsequences(record.get("outgoing")),
      incoming: toConsequences(record.get("incoming")),
    };
  } finally {
    await session.close();
  }
}

export async function collapseBeat(driver: Driver, gameReference: string, beatReference: string): Promise<{
  eventTitle: string;
  beatTitle: string;
  revealedSecrets: string[];
  activatedStates: string[];
  escalatedPressures: string[];
  invalidatedBeats: string[];
} | null> {
  await ensureSchema(driver);
  const game = await findGame(driver, gameReference);
  if (!game) {
    throw new Error(`Game not found: ${gameReference}`);
  }
  const session = driver.session({ database: configFromEnv().database });
  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MATCH (b:Beat {game: $game})
        WHERE b.id = $beat OR b.title = $beat
        MERGE (e:Event {game: $game, title: b.title})
        ON CREATE SET e.id = $eventId, e.createdAt = datetime()
        SET e.updatedAt = datetime()
        MERGE (e)-[:REALIZED]->(b)
        SET b.status = 'collapsed', b.updatedAt = datetime()
        WITH b, e
        OPTIONAL MATCH (b)-[:REVEALS]->(secret:Secret)
        FOREACH (_ IN CASE WHEN secret IS NULL THEN [] ELSE [1] END | MERGE (e)-[:REVEALED]->(secret))
        WITH b, e, collect(DISTINCT secret.title) AS revealedSecrets
        OPTIONAL MATCH (b)-[:CREATES]->(state:State)
        FOREACH (_ IN CASE WHEN state IS NULL THEN [] ELSE [1] END | MERGE (e)-[:ACTIVATED]->(state))
        WITH b, e, revealedSecrets, collect(DISTINCT state.title) AS activatedStates
        OPTIONAL MATCH (b)-[:ESCALATES]->(pressure:Pressure)
        FOREACH (_ IN CASE WHEN pressure IS NULL THEN [] ELSE [1] END | MERGE (e)-[:ESCALATED]->(pressure))
        WITH b, e, revealedSecrets, activatedStates, collect(DISTINCT pressure.title) AS escalatedPressures
        OPTIONAL MATCH (b)-[:BLOCKS]->(blocked:Beat {game: $game})
        SET blocked.status = 'invalidated', blocked.updatedAt = datetime()
        FOREACH (_ IN CASE WHEN blocked IS NULL THEN [] ELSE [1] END | MERGE (e)-[:INVALIDATED]->(blocked))
        RETURN b.title AS beatTitle, e.title AS eventTitle,
          [x IN revealedSecrets WHERE x IS NOT NULL] AS revealedSecrets,
          [x IN activatedStates WHERE x IS NOT NULL] AS activatedStates,
          [x IN escalatedPressures WHERE x IS NOT NULL] AS escalatedPressures,
          [x IN collect(DISTINCT blocked.title) WHERE x IS NOT NULL] AS invalidatedBeats
        LIMIT 1
        `,
        { game: game.id, beat: beatReference, eventId: createId("ev") },
      ),
    );

    const record = result.records[0];
    if (!record) return null;
    return {
      eventTitle: record.get("eventTitle") as string,
      beatTitle: record.get("beatTitle") as string,
      revealedSecrets: record.get("revealedSecrets") as string[],
      activatedStates: record.get("activatedStates") as string[],
      escalatedPressures: record.get("escalatedPressures") as string[],
      invalidatedBeats: record.get("invalidatedBeats") as string[],
    };
  } finally {
    await session.close();
  }
}

function toConsequences(value: unknown): Consequence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.relationship !== "string" || typeof candidate.title !== "string" || !Array.isArray(candidate.labels)) {
      return [];
    }

    return [{ relationship: candidate.relationship as never, title: candidate.title, type: primaryNodeType(candidate.labels as string[]) }];
  });
}
