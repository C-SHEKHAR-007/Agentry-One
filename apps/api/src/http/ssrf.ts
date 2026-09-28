import { lookup } from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  statusCode = 400;
}

/** CIDR ranges that must never be reachable from a user-supplied URL, even
 * when allowlisted: link-local covers cloud metadata endpoints
 * (169.254.169.254, fe80::) that hand out instance credentials. */
const ALWAYS_BLOCKED: Array<[string, number, 4 | 6]> = [
  ["0.0.0.0", 8, 4],
  ["169.254.0.0", 16, 4],
  ["100.100.100.200", 32, 4], // Alibaba metadata
  ["224.0.0.0", 4, 4],
  ["fe80::", 10, 6],
  ["fd00:ec2::", 32, 6], // AWS IPv6 metadata
];

/** Internal ranges: reachable only for explicitly allowlisted hosts (e.g. a
 * local Ollama), never for arbitrary user input. */
const PRIVATE: Array<[string, number, 4 | 6]> = [
  ["10.0.0.0", 8, 4],
  ["172.16.0.0", 12, 4],
  ["192.168.0.0", 16, 4],
  ["127.0.0.0", 8, 4],
  ["100.64.0.0", 10, 4],
  ["::1", 128, 6],
  ["fc00::", 7, 6],
];

/** The IPv4 address inside an IPv4-mapped IPv6 address, in either the dotted
 * (::ffff:1.2.3.4) or hex (::ffff:0102:0304) form; null otherwise. */
function ipv4Mapped(ip: string): string | null {
  const m = /^(?:0{0,4}:){0,4}:?(?:0{0,4}:)?ffff:(.+)$/i.exec(ip) ?? /^::ffff:(.+)$/i.exec(ip);
  if (!m) return null;
  const tail = m[1];
  if (net.isIPv4(tail)) return tail;
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function inRanges(ip: string, ranges: Array<[string, number, 4 | 6]>): boolean {
  const family = net.isIP(ip);
  const list = new net.BlockList();
  for (const [addr, prefix, fam] of ranges) {
    if (fam === family) list.addSubnet(addr, prefix, fam === 4 ? "ipv4" : "ipv6");
  }
  const mapped = family === 6 ? ipv4Mapped(ip) : null;
  if (mapped) {
    // IPv4-mapped IPv6 (::ffff:169.254.169.254, which URL parsing normalises
    // to ::ffff:a9fe:a9fe) must be judged as the IPv4 address it carries.
    return inRanges(mapped, ranges);
  }
  return list.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/** Hosts allowed to resolve to private/loopback addresses. Defaults cover a
 * local Ollama; extend with PROVIDER_PRIVATE_HOSTS (comma-separated). */
function privateHostAllowlist(): Set<string> {
  const hosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
  for (const h of (process.env.PROVIDER_PRIVATE_HOSTS ?? "").split(",")) if (h.trim()) hosts.add(h.trim().toLowerCase());
  try {
    if (process.env.OLLAMA_HOST) hosts.add(new URL(process.env.OLLAMA_HOST).hostname.toLowerCase());
  } catch {
    /* ignore malformed OLLAMA_HOST */
  }
  return hosts;
}

/** Throws UnsafeUrlError unless `raw` is an http(s) URL whose host resolves
 * only to addresses a server-side request may reach. */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("baseUrl must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("baseUrl must use http or https");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("baseUrl must not contain credentials");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      throw new UnsafeUrlError(`could not resolve host '${host}'`);
    }
  }

  const allowPrivate = privateHostAllowlist().has(host);
  for (const ip of addresses) {
    if (inRanges(ip, ALWAYS_BLOCKED)) throw new UnsafeUrlError(`baseUrl resolves to a blocked address (${ip})`);
    if (!allowPrivate && inRanges(ip, PRIVATE)) {
      throw new UnsafeUrlError(
        `baseUrl resolves to a private address (${ip}); add '${host}' to PROVIDER_PRIVATE_HOSTS to allow it`,
      );
    }
  }
  return url;
}

/** fetch() for user-configured URLs: re-validates the target and refuses
 * redirects (which could otherwise bounce to an internal address). */
export async function safeFetch(raw: string, init: RequestInit = {}): Promise<Response> {
  await assertSafeOutboundUrl(raw);
  return fetch(raw, { ...init, redirect: "error", signal: init.signal ?? AbortSignal.timeout(15_000) });
}
