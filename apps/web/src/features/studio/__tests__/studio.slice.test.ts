import { beforeEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { DRAFT_KEY, loadDraft, setDraft } from "../studio.slice";

beforeEach(() => localStorage.clear());

describe("studio draft", () => {
  it("restores a pre-v2.2 draft and never restores the account", () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ topic: "Launch week", tone: "Playful", roles: ["text"], socialAccountId: "acc1" }));
    expect(loadDraft()).toEqual({ topic: "Launch week", tone: "Playful", roles: ["text"], socialAccountId: "" });
  });

  it("falls back to the default outputs when nothing (or junk) is stored", () => {
    localStorage.setItem(DRAFT_KEY, "{not json");
    expect(loadDraft().roles).toEqual(["search", "text", "image"]);
  });

  it("persists topic, tone and outputs as the draft changes", () => {
    const store = makeStore();
    store.dispatch(setDraft({ topic: "AI tips", tone: "", roles: ["text", "image"], socialAccountId: "acc9" }));
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual({ topic: "AI tips", tone: "", roles: ["text", "image"] });
  });
});
