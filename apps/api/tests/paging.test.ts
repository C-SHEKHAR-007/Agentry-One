import { describe, expect, it } from "vitest";
import { pageQuery, toPage } from "../src/http/paging.js";
import { ValidationError } from "../src/http/validate.js";

const row = (id: string, at: string) => ({ id, createdAt: new Date(at) });

describe("cursor paging", () => {
  it("is off unless asked for, so existing callers keep their arrays", () => {
    expect(pageQuery({}).paged).toBe(false);
    expect(pageQuery({ paged: "1" }).paged).toBe(true);
    expect(pageQuery({}).where).toEqual({});
  });

  it("fetches one extra row and only returns a cursor when there is more", () => {
    const rows = [row("c", "2026-10-03T10:00:00Z"), row("b", "2026-10-02T10:00:00Z"), row("a", "2026-10-01T10:00:00Z")];
    expect(pageQuery({}).take(2)).toBe(3);
    const first = toPage(rows, 2);
    expect(first.items.map((r) => r.id)).toEqual(["c", "b"]);
    expect(first.nextCursor).not.toBeNull();
    expect(toPage(rows.slice(0, 2), 2).nextCursor).toBeNull();
  });

  it("the cursor selects rows strictly after the last one, ties broken by id", () => {
    const { nextCursor } = toPage([row("b", "2026-10-02T10:00:00Z"), row("a", "2026-10-01T10:00:00Z")], 1);
    expect(pageQuery({ paged: "1", cursor: nextCursor! }).where).toEqual({
      OR: [
        { createdAt: { lt: new Date("2026-10-02T10:00:00Z") } },
        { createdAt: new Date("2026-10-02T10:00:00Z"), id: { lt: "b" } },
      ],
    });
  });

  it("rejects a cursor it didn't make", () => {
    expect(() => pageQuery({ paged: "1", cursor: "not-a-cursor" })).toThrow(ValidationError);
  });
});
