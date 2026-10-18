import type { ProviderConfig } from "../models";

/** The model a provider uses unless told otherwise. */
export const currentModelOf = (p: ProviderConfig): string =>
  (p.config?.model as string | undefined) || (p.models && p.models.length > 0 ? p.models[0].modelId : "");
