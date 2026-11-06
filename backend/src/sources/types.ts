import type { IntegrationSource } from "../modules/integrations/integration.schema.js";

export type FeedRow = Record<string, unknown>;

export interface FeedBatch {
  source: IntegrationSource;
  rows: FeedRow[];
}
