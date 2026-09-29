import type { DiscoveredModel, ProviderConfig } from "../../models";

/** Providers matching the modality tab and search box, in a stable order
 * (capability, then name) so cards never jump when data refreshes. */
export function filterProviders(providers: ProviderConfig[], selectedModality: string, searchQuery: string): ProviderConfig[] {
  const q = searchQuery.trim().toLowerCase();

  return providers
  .filter((p) => {
    // 1. Modality Filter
    const capKey = (p.capability?.key || "").toLowerCase();
    const capLabel = (p.capability?.label || "").toLowerCase();

    let matchesModality = selectedModality === "all";
    if (!matchesModality) {
      const capMatches =
        (selectedModality === "text" && (capKey.includes("text") || capLabel.includes("text"))) ||
        (selectedModality === "image" && (capKey.includes("image") || capLabel.includes("image"))) ||
        (selectedModality === "audio" && (capKey.includes("audio") || capLabel.includes("audio") || capKey.includes("tts") || capKey.includes("speech"))) ||
        (selectedModality === "video" && (capKey.includes("video") || capLabel.includes("video"))) ||
        (selectedModality === "search" && (capKey.includes("search") || capLabel.includes("search") || capKey.includes("web")));

      const modelMatches = (p.models || []).some((m) =>
        m.outputTypes.some((t) => t.toLowerCase() === selectedModality) ||
        m.inputTypes.some((t) => t.toLowerCase() === selectedModality)
      );

      matchesModality = Boolean(capMatches || modelMatches);
    }

    if (!matchesModality) return false;

    // 2. Search Query Filter
    if (!q) return true;

    const providerMatchesQuery =
      p.name.toLowerCase().includes(q) ||
      p.providerType.toLowerCase().includes(q) ||
      capLabel.includes(q) ||
      capKey.includes(q) ||
      (p.baseUrl && p.baseUrl.toLowerCase().includes(q));

    const hasModelMatchingQuery = (p.models || []).some((m) =>
      m.name.toLowerCase().includes(q) ||
      m.modelId.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );

    return providerMatchesQuery || hasModelMatchingQuery;
  })
  .sort((a, b) => {
    // Deterministic stable ordering by capability then name so cards never jump on update
    const capOrder = (a.capability?.key || "").localeCompare(b.capability?.key || "");
    if (capOrder !== 0) return capOrder;
    return a.name.localeCompare(b.name);
  });;
}

/** A provider's models matching its own filter box and the modality tab. */
export function filterModels(models: DiscoveredModel[], query: string, selectedModality: string): DiscoveredModel[] {
  const searchInModel = query.toLowerCase();
  return models.filter((m) => {
    const matchesQuery = !searchInModel || m.name.toLowerCase().includes(searchInModel) || m.modelId.toLowerCase().includes(searchInModel);
    const matchesModality = selectedModality === "all" || m.outputTypes.includes(selectedModality) || m.inputTypes.includes(selectedModality);
    return matchesQuery && matchesModality;
  });
}

/** The model a provider uses unless told otherwise. */
export const currentModelOf = (p: ProviderConfig): string =>
  (p.config?.model as string | undefined) || (p.models && p.models.length > 0 ? p.models[0].modelId : "");
