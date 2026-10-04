/**
 * Server-sent-event streams (EventSource). axios can't stream SSE in the
 * browser, and EventSource is the standard for it: it sends the session
 * cookie (same origin) and reconnects on its own. Every stream in the app is
 * opened through here.
 */
export function openStream<T = unknown>(url: string, onMessage: (data: T) => void, onError?: (e: Event) => void): () => void {
  const source = new EventSource(url);
  source.onmessage = (event) => {
    let data: T;
    try {
      data = JSON.parse(event.data) as T;
    } catch {
      return; // heartbeats / malformed frames
    }
    onMessage(data);
  };
  if (onError) source.onerror = onError;
  return () => source.close();
}
