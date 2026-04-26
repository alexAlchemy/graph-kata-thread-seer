# graph-kata-thread-seer
Graph-native narrative design tool for mapping story threads, pressures, secrets, canon beats, and possible futures.

## Milestone 1: Beat Consequence Explorer

This slice answers the first useful graph question:

```text
Given a possible beat, what does it unlock and what does it kill?
```

## Run locally

Install dependencies:

```bash
pnpm install
```

Start Neo4j:

```bash
docker compose up -d neo4j
```

Load the toy story world:

```bash
pnpm threadseer seed ash-kingdom
```

Seeding also sets Ash Kingdom as the active world for later commands.

Create a new empty story world:

```bash
threadseer world create "Ash Kingdom" "A brittle succession crisis under pressure from court paranoia and famine unrest."
```

Threadseer uses short generated application ids, such as `w_KL0lEnhTyh`, instead of slugs or Neo4j internal ids. The display name can change without changing the world identity.

Set or inspect the active world:

```bash
threadseer world use "Ash Kingdom"
threadseer world current
```

World-scoped commands read the active world from local CLI config. If none is set, they return:

```text
Please set active world
```

Explore the seeded beat:

```bash
pnpm threadseer beat show "Mara reveals herself at the feast"
pnpm threadseer beat consequences "Mara reveals herself at the feast"
pnpm threadseer beat kills "Mara reveals herself at the feast"
```

Neo4j defaults come from `docker-compose.yml`:

```text
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=threadseer-dev-password
```

## Install the CLI locally

For day-to-day local development, link the package into your shell path:

```bash
pnpm install
pnpm link --global
```

If pnpm has no global bin directory yet, set it to a directory on your `PATH` once:

```bash
pnpm config set global-bin-dir ~/.local/bin
```

Then you can run:

```bash
threadseer help
threadseer seed ash-kingdom
threadseer beat consequences "Mara reveals herself at the feast"
```

Because the global command is a symlink back to this checkout, code changes are picked up immediately. To update after pulling new code:

```bash
git pull
pnpm install
```

Re-linking is only needed if the link is removed or your global pnpm setup changes.

## Domain

Node types:

```text
Beat
Thread
Pressure
Secret
State
```

Edge types:

```text
REQUIRES
ENABLES
BLOCKS
REVEALS
ESCALATES
CREATES
```
