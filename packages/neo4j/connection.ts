import neo4j, { type Driver } from "neo4j-driver";

export type Neo4jConfig = {
  uri: string;
  user: string;
  password: string;
  database?: string;
};

export function configFromEnv(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "threadseer-dev-password",
    database: process.env.NEO4J_DATABASE,
  };
}

export function createDriver(config: Neo4jConfig = configFromEnv()): Driver {
  return neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
}

export async function withDriver<T>(work: (driver: Driver) => Promise<T>): Promise<T> {
  const driver = createDriver();

  try {
    return await work(driver);
  } finally {
    await driver.close();
  }
}
