import { z } from "zod";

import { edgeTypes } from "./edges.js";
import { nodeTypes } from "./nodes.js";

export const storyNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(nodeTypes),
  title: z.string().min(1),
  status: z.enum(["possible", "canon"]).optional(),
});

export const storyEdgeSchema = z.object({
  from: z.string().min(1),
  type: z.enum(edgeTypes),
  to: z.string().min(1),
});

export const seedGraphSchema = z.object({
  world: z.string().min(1),
  nodes: z.array(storyNodeSchema),
  edges: z.array(storyEdgeSchema),
});

export type SeedGraph = z.infer<typeof seedGraphSchema>;
