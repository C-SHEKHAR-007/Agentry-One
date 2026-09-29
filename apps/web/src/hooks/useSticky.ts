import { useRef } from "react";

/** The last non-null value seen. Lets a dialog keyed on a nullable value
 * (open while `editing` is set) keep rendering its content while its close
 * animation plays, after the value has already been cleared. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(value ?? null);
  if (value !== null && value !== undefined) ref.current = value;
  return ref.current;
}
