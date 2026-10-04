import type { Prompt } from "../../models";
import { extractPlaceholders } from "../../lib/promptText";

/** All versions of one prompt (same agent + key), newest first. */
export interface PromptGroup {
  id: string; // `${agentId}:${key}`
  agentId: string;
  key: string;
  versions: Prompt[];
  latest: Prompt;
  placeholders: string[];
}

export function groupPrompts(prompts: Prompt[]): PromptGroup[] {
  const map = new Map<string, Prompt[]>();
  for (const p of prompts) {
    const id = `${p.agentId}:${p.key}`;
    map.set(id, [...(map.get(id) ?? []), p]);
  }
  return [...map.entries()].map(([id, versions]) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return {
      id,
      agentId: sorted[0].agentId,
      key: sorted[0].key,
      versions: sorted,
      latest: sorted[0],
      placeholders: extractPlaceholders(sorted[0].template),
    };
  });
}
