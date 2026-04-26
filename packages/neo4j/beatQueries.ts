import type { Driver } from "neo4j-driver";

import type { EdgeType } from "../domain/edges.js";
import type { BeatView, Consequence } from "../domain/consequenceView.js";
import { createId } from "../domain/ids.js";
import { primaryNodeType } from "../domain/nodes.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";

export async function addBeat(
  driver: Driver,
  world: string,
  title: string,
  status: "possible" | "canon",
): Promise<void> {
  await ensureSchema(driver);

  const session = driver.session({ database: configFromEnv().database });

  try {
    await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (b:Beat {world: $world, title: $title})
        ON CREATE SET b.id = $id
        SET b.status = $status
        `,
        {
          world,
          title,
          status,
          id: createId("b"),
        },
      ),
    );
  } finally {
    await session.close();
  }
}

export async function findBeat(driver: Driver, world: string, title: string): Promise<BeatView | null> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (b:Beat {world: $world, title: $title})
        OPTIONAL MATCH (b)-[out]->(target)
        OPTIONAL MATCH (source)-[in]->(b)
        RETURN b {
          .id,
          .title,
          .status
        } AS beat,
        collect(DISTINCT {
          relationship: type(out),
          title: target.title,
          labels: labels(target)
        }) AS outgoing,
        collect(DISTINCT {
          relationship: type(in),
          title: source.title,
          labels: labels(source)
        }) AS incoming
        `,
        { world, title },
      ),
    );

    const record = result.records[0];
    if (!record) {
      return null;
    }

    const beat = record.get("beat") as { id: string; title: string; status?: "possible" | "canon" };
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


export async function outgoingConsequences(
  driver: Driver,
  world: string,
  title: string,
): Promise<Consequence[] | null> {
  const beat = await findBeat(driver, world, title);
  return beat?.outgoing ?? null;
}

function toConsequences(value: unknown): Consequence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRawConsequence(item)) {
      return [];
    }

    return [
      {
        relationship: item.relationship,
        title: item.title,
        type: primaryNodeType(item.labels),
      },
    ];
  });
}

function isRawConsequence(value: unknown): value is {
  relationship: EdgeType;
  title: string;
  labels: string[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.relationship === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.labels) &&
    candidate.labels.every((label) => typeof label === "string")
  );
}
