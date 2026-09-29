import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { parseJson, readStored, writeStored } from "../../app/persistence";
import type { Role } from "../../lib/studioPlan";

/** What the Content Studio composer is building. */
export interface StudioDraft {
  topic: string;
  tone: string;
  roles: Role[];
  /** Not persisted: accounts are per project and may disappear. */
  socialAccountId: string;
}

// Same key as before v2.2, so an unfinished brief survives the upgrade.
export const DRAFT_KEY = "agentry.studio.draft";
const EMPTY: StudioDraft = { topic: "", tone: "", roles: ["search", "text", "image"], socialAccountId: "" };

export function loadDraft(): StudioDraft {
  const saved = readStored(DRAFT_KEY, (r) => parseJson<Partial<StudioDraft>>(r), null);
  return saved && typeof saved.topic === "string" ? { ...EMPTY, ...saved, socialAccountId: "" } : EMPTY;
}

const studioSlice = createSlice({
  name: "studio",
  initialState: () => ({ draft: loadDraft() }),
  reducers: {
    setDraft(state, action: PayloadAction<StudioDraft>) {
      state.draft = action.payload;
    },
  },
});

export const { setDraft } = studioSlice.actions;
export const studioReducer = studioSlice.reducer;

export function persistDraft(d: StudioDraft) {
  writeStored(DRAFT_KEY, JSON.stringify({ topic: d.topic, tone: d.tone, roles: d.roles }));
}
