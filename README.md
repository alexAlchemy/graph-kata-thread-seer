# graph-kata-thread-seer
Graph-native narrative design tool for mapping sourcebook ingredients, game-local threads, beats, and event consequences.

## Milestone 2: Sourcebook-to-Game Lifecycle

This slice answers:

```text
Given a possible beat, what does it unlock and what does it kill?
```

…and now does so in a game-local lifecycle:

```text
Sourcebook thread seeds -> game threads -> proposed beats -> collapsed events.
```

## Run locally

```bash
pnpm install
docker compose up -d neo4j
pnpm threadseer seed ash-kingdom
```

The seed creates:

- Sourcebook: Ash Kingdom
- Game: Ash Kingdom Demo Game
- ThreadSeed: The Crown Without a King
- GameThread instantiated from that seed
- Demo game-local beats

## Core commands

```bash
threadseer game current
threadseer sourcebook thread list
threadseer game thread create --from "The Crown Without a King"
threadseer game beat add "Mara reveals herself at the feast" --thread "The Crown Without a King"
threadseer game beat consequences "Mara reveals herself at the feast"
threadseer game beat kills "Mara reveals herself at the feast"
threadseer game beat collapse "Mara reveals herself at the feast"
```

Compatibility aliases still work:

```bash
threadseer beat show "Mara reveals herself at the feast"
threadseer beat consequences "Mara reveals herself at the feast"
threadseer beat kills "Mara reveals herself at the feast"
```
