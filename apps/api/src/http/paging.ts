import { parse, ValidationError, z } from "./validate.js";

/** Cursor paging for newest-first lists. Opt-in with `?paged=1`, so existing
 * callers keep getting a plain array; paged callers get
 * `{ items, nextCursor }` and pass `cursor` back for the next page.
 *
 * The cursor is the last row's (createdAt, id), not an offset: rows added
 * while someone pages don't shift the pages, and a deleted row doesn't
 * break the cursor. */
const PageQuery = z.object({
  paged: z.enum(["1", "true"]).optional(),
  cursor: z.string().max(200).optional(),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface Cursor {
  createdAt: Date;
  id: string;
}

const encode = (row: Cursor) => Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");

function decode(cursor: string): Cursor {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(at ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw new ValidationError([{ path: "cursor", message: "invalid cursor" }]);
  return { createdAt, id };
}

/** Newest first, with the id breaking ties so the order is total. */
export const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/** Reads `paged` and `cursor` from a query string. */
export function pageQuery(query: unknown) {
  const { paged, cursor } = parse(PageQuery, query);
  const after = cursor ? decode(cursor) : null;
  return {
    paged: Boolean(paged),
    /** A `where` fragment selecting the rows after the cursor (AND it in). */
    where: after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {},
    /** Fetch one extra row to know whether another page exists. */
    take: (limit: number) => limit + 1,
  };
}

/** Trims the extra row and works out the next cursor. */
export function toPage<T extends Cursor>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? encode(items[items.length - 1]!) : null };
}
