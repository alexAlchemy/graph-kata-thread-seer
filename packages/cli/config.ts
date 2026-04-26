import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ActiveSourcebook = {
  handle: string;
  id: string;
  name: string;
};

export type ActiveGame = {
  handle: string;
  id: string;
  name: string;
  sourcebook: string;
};

export type CliConfig = {
  activeSourcebook?: ActiveSourcebook;
  activeGame?: ActiveGame;
  // legacy compatibility
  activeWorld?: ActiveSourcebook;
};

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

export async function setActiveSourcebook(sourcebook: ActiveSourcebook): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    activeSourcebook: sourcebook,
    activeWorld: sourcebook,
  });
}

export async function setActiveGame(game: ActiveGame): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, activeGame: game });
}

export async function requireActiveSourcebook(): Promise<ActiveSourcebook> {
  const config = await readConfig();
  const sourcebook = config.activeSourcebook ?? config.activeWorld;
  if (!sourcebook?.handle) {
    throw new Error("Please set active sourcebook");
  }

  return sourcebook;
}

export async function requireActiveGame(): Promise<ActiveGame> {
  const config = await readConfig();
  if (!config.activeGame?.handle) {
    throw new Error("Please set active game");
  }

  return config.activeGame;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
