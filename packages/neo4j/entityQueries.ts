import type { Driver } from "neo4j-driver";

import { createId } from "../domain/ids.js";
import { entityTypes, type EntityType } from "../domain/nodes.js";
import { configFromEnv } from "./connection.js";
import { ensureSchema } from "./schema.js";

export type Entity = {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
};

export type BeatEntityAttachment = {
  beat: {
    id: string;
    title: string;
  };
  entity: Entity;
};

export async function createEntity(
  driver: Driver,
  world: string,
  type: EntityType,
  name: string,
  description?: string,
): Promise<Entity> {
  assertEntityType(type);
  await ensureSchema(driver);

  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MERGE (e:Entity:${type} {world: $world, name: $name})
        ON CREATE SET
          e.id = $id,
          e.createdAt = datetime()
        SET
          e.title = $name,
          e.description = $description,
          e.updatedAt = datetime()
        RETURN e {
          .id,
          .name,
          .description,
          labels: labels(e)
        } AS entity
        `,
        {
          world,
          type,
          name,
          description: description ?? null,
          id: createId("e"),
        },
      ),
    );

    return toEntity(result.records[0]?.get("entity"));
  } finally {
    await session.close();
  }
}

export async function listEntities(driver: Driver, world: string): Promise<Entity[]> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (e:Entity {world: $world})
        RETURN e {
          .id,
          .name,
          .description,
          labels: labels(e)
        } AS entity
        ORDER BY e.name
        `,
        { world },
      ),
    );

    return result.records.map((record) => toEntity(record.get("entity")));
  } finally {
    await session.close();
  }
}

export async function attachEntityToBeat(
  driver: Driver,
  world: string,
  beatReference: string,
  entityReference: string,
): Promise<BeatEntityAttachment | null> {
  await ensureSchema(driver);

  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
        MATCH (b:Beat {world: $world})
        WHERE b.id = $beatReference OR b.title = $beatReference
        MATCH (e:Entity {world: $world})
        WHERE e.id = $entityReference OR e.name = $entityReference
        MERGE (b)-[:INVOLVES]->(e)
        RETURN
          b { .id, .title } AS beat,
          e {
            .id,
            .name,
            .description,
            labels: labels(e)
          } AS entity
        LIMIT 1
        `,
        { world, beatReference, entityReference },
      ),
    );

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return {
      beat: record.get("beat") as { id: string; title: string },
      entity: toEntity(record.get("entity")),
    };
  } finally {
    await session.close();
  }
}

export async function entitiesForBeat(
  driver: Driver,
  world: string,
  beatReference: string,
): Promise<{ beat: { id: string; title: string }; entities: Entity[] } | null> {
  const session = driver.session({ database: configFromEnv().database });

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (b:Beat {world: $world})
        WHERE b.id = $beatReference OR b.title = $beatReference
        OPTIONAL MATCH (b)-[:INVOLVES]->(e:Entity)
        RETURN
          b { .id, .title } AS beat,
          collect(e {
            .id,
            .name,
            .description,
            labels: labels(e)
          }) AS entities
        LIMIT 1
        `,
        { world, beatReference },
      ),
    );

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return {
      beat: record.get("beat") as { id: string; title: string },
      entities: toEntityList(record.get("entities")),
    };
  } finally {
    await session.close();
  }
}

function toEntityList(value: unknown): Entity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    if (!candidate.id || !candidate.name) {
      return [];
    }

    return [toEntity(item)];
  });
}

function toEntity(value: unknown): Entity {
  if (!value || typeof value !== "object") {
    throw new Error("Expected entity record.");
  }

  const candidate = value as Record<string, unknown>;
  const labels = Array.isArray(candidate.labels)
    ? candidate.labels.filter((label): label is string => typeof label === "string")
    : [];
  const type = labels.find((label): label is EntityType =>
    entityTypes.includes(label as EntityType),
  );

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !type
  ) {
    throw new Error("Expected entity record with id, name, and entity type label.");
  }

  return {
    id: candidate.id,
    type,
    name: candidate.name,
    description:
      typeof candidate.description === "string" ? candidate.description : undefined,
  };
}

function assertEntityType(type: string): asserts type is EntityType {
  if (!entityTypes.includes(type as EntityType)) {
    throw new Error(`Unsupported entity type: ${type}. Use Character, Faction, or Location.`);
  }
}
