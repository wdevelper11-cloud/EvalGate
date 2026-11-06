import { isIP } from "node:net";
import { AdapterError } from "./errors.ts";

/**
 * Blocks requests to loopback, private, link-local, carrier-grade NAT,
 * multicast, reserved and cloud-metadata addresses, so a target URL (or a DNS
 * answer for it) can never reach our own infrastructure.
 */

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

const blockedIpv4Ranges: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  if (value === null) return true;
  return blockedIpv4Ranges.some(([base, bits]) => {
    const baseValue = ipv4ToNumber(base)!;
    const size = 2 ** (32 - bits);
    return value >= baseValue && value < baseValue + size;
  });
}

function expandIpv6(address: string): number[] | null {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  // Embedded IPv4 tail, e.g. ::ffff:10.0.0.1
  let tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  const maybeV4 = text.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const v4 = ipv4ToNumber(maybeV4);
    if (v4 === null) return null;
    tail = [Math.floor(v4 / 65536), v4 % 65536];
    text = `${text.slice(0, lastColon + 1)}0:0`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (groups.length !== 8) return null;
  const values = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  if (values.some(Number.isNaN)) return null;
  if (tail.length) values.splice(6, 2, ...tail);
  return values;
}

function isBlockedIpv6(address: string): boolean {
  const g = expandIpv6(address);
  if (!g) return true;
  const allZeroPrefix = (n: number) => g.slice(0, n).every((value) => value === 0);

  if (allZeroPrefix(8)) return true; // ::
  if (allZeroPrefix(7) && g[7] === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d -> judge the IPv4 part
  if (allZeroPrefix(5) && (g[5] === 0xffff || g[5] === 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return isBlockedIpv4(v4);
  }
  // SIIT ::ffff:0:a.b.c.d -> judge the IPv4 part
  if (allZeroPrefix(4) && g[4] === 0xffff && g[5] === 0) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return isBlockedIpv4(v4);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
  if (g[0] === 0x100 && g.slice(1, 4).every((value) => value === 0)) return true; // 100::/64 discard
  // NAT64 64:ff9b::/96 -> judge the IPv4 part
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((value) => value === 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return isBlockedIpv4(v4);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x2002) return true; // 6to4 can embed private IPv4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  return false;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

/** Validates a target URL before any DNS lookup. Throws AdapterError. */
export function validateTargetUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AdapterError("invalid_configuration", "Endpoint URL is not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new AdapterError("invalid_configuration", "Endpoint URL must use https://.");
  }
  if (url.username || url.password) {
    throw new AdapterError("invalid_configuration", "Endpoint URL must not contain a username or password.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) throw new AdapterError("invalid_configuration", "Endpoint URL has no host.");
  if (host === "localhost" || blockedHostnameSuffixes.some((suffix) => host.endsWith(suffix))) {
    throw new AdapterError("blocked_address", "Endpoint host is a local or internal name.");
  }
  if (isIP(host) && isBlockedAddress(host)) {
    throw new AdapterError("blocked_address", "Endpoint address is private, local or reserved.");
  }
  if (!isIP(host) && !host.includes(".")) {
    throw new AdapterError("blocked_address", "Endpoint host must be a public domain name.");
  }
  return url;
}

export type ResolvedAddress = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

/**
 * Resolves a hostname and refuses it if ANY returned address is blocked.
 * Used as the socket's lookup function, so the address checked is the address
 * connected to (no gap for DNS rebinding between check and connect).
 */
export async function resolvePublicAddress(
  hostname: string,
  resolver: Resolver,
  isBlocked: (address: string) => boolean = isBlockedAddress,
): Promise<ResolvedAddress> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isBlocked(host)) throw new AdapterError("blocked_address", "Endpoint address is private, local or reserved.");
    return { address: host, family: isIP(host) };
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new AdapterError("dns_error", "Endpoint host name could not be resolved.");
  }
  if (addresses.length === 0) throw new AdapterError("dns_error", "Endpoint host name has no addresses.");
  if (addresses.some((entry) => isBlocked(entry.address))) {
    throw new AdapterError("blocked_address", "Endpoint host resolves to a private, local or reserved address.");
  }
  return addresses[0];
}
