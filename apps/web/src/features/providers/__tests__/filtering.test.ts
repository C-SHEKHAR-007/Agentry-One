import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../../../models";
import { currentModelOf, filterModels, filterProviders } from "../filtering";

const model = (modelId: string, outputTypes = ["text"]) => ({ id: modelId, modelId, name: modelId, inputTypes: ["text"], outputTypes });
const provider = (name: string, capKey: string, models = [model("m1")], config = {}) =>
  ({ id: name, name, providerType: "openai", baseUrl: null, capability: { id: capKey, key: capKey, label: capKey }, models, config }) as unknown as ProviderConfig;

const list = [provider("Zeta", "text-generation"), provider("Alpha", "text-generation"), provider("SD", "image-generation", [model("sd", ["image"])])];

describe("provider filtering", () => {
  it("orders by capability, then name", () => {
    expect(filterProviders(list, "all", "").map((p) => p.name)).toEqual(["SD", "Alpha", "Zeta"]);
  });
  it("filters by modality and by search (provider or model)", () => {
    expect(filterProviders(list, "image", "").map((p) => p.name)).toEqual(["SD"]);
    expect(filterProviders(list, "all", "zet").map((p) => p.name)).toEqual(["Zeta"]);
    expect(filterProviders(list, "all", "sd").map((p) => p.name)).toEqual(["SD"]);
  });
  it("filters a provider's models and picks its current model", () => {
    const p = provider("P", "text-generation", [model("gpt-4o"), model("dall-e", ["image"])], { model: "gpt-4o" });
    expect(filterModels(p.models!, "", "image").map((m) => m.modelId)).toEqual(["dall-e"]);
    expect(filterModels(p.models!, "gpt", "all").map((m) => m.modelId)).toEqual(["gpt-4o"]);
    expect(currentModelOf(p)).toBe("gpt-4o");
    expect(currentModelOf(provider("Q", "text-generation", [model("first")]))).toBe("first");
  });
});
