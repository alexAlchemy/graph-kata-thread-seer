import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type CliConfig = {
  activeWorld?: {
    handle: string;
    id: string;
    name: string;
  };
};

export type ActiveWorld = NonNullable<CliConfig["activeWorld"]>;

export function configPath(): string {
  const root = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(root, "threadseer", "config.json");
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return JSON.parse(raw) as CliConfig;
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }

    throw error;
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  const target = configPath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function setActiveWorld(world: CliConfig["activeWorld"]): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, activeWorld: world });
}

export async function requireActiveWorld(): Promise<ActiveWorld> {
  const config = await readConfig();
  if (!config.activeWorld?.handle) {
    throw new Error("Please set active world");
  }

  return config.activeWorld;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
