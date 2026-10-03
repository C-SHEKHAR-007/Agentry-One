/** One page of a newest-first list (`?paged=1`); pass `nextCursor` back as
 * `cursor` for the next page. `null` means there are no more. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
