import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { AdapterError } from "./errors.ts";
import { resolvePublicAddress, validateTargetUrl, type Resolver } from "./network-guard.ts";

export type TransportRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
};

export type TransportResponse = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
};

/** Sends one POST. Never follows redirects. Throws AdapterError on transport failure. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export const MAX_RESPONSE_BYTES = 1_000_000;

const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

/** A socket lookup that only ever hands back a public address. */
export function guardedLookup(resolver: Resolver = systemResolver, isBlocked?: (address: string) => boolean): LookupFunction {
  return ((hostname: string, options: { all?: boolean } | number | undefined, callback: (...args: unknown[]) => void) => {
    const wantsAll = typeof options === "object" && options !== null && options.all === true;
    resolvePublicAddress(hostname, resolver, isBlocked).then(
      (entry) => (wantsAll ? callback(null, [entry]) : callback(null, entry.address, entry.family)),
      (error) => callback(error),
    );
  }) as LookupFunction;
}

export type HttpsTransportOptions = {
  resolver?: Resolver;
  /** Extra trusted CA (tests only). */
  ca?: string;
  /** Address policy override. TESTS ONLY: production always uses the default block list. */
  isBlocked?: (address: string) => boolean;
  maxResponseBytes?: number;
};

export function createHttpsTransport(options: HttpsTransportOptions = {}): Transport {
  const maxBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  return (request) => sendOnce(request, options, maxBytes);
}

function sendOnce(request: TransportRequest, options: HttpsTransportOptions, maxBytes: number): Promise<TransportResponse> {
  const url = validateTargetUrl(request.url);
  return new Promise<TransportResponse>((resolve, reject) => {
    let settled = false;
    const fail = (error: AdapterError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const req = httpsRequest(url, {
      method: "POST",
      headers: { ...request.headers, "content-length": Buffer.byteLength(request.body).toString() },
      lookup: guardedLookup(options.resolver ?? systemResolver, options.isBlocked),
      ...(options.ca ? { ca: options.ca } : {}),
      timeout: request.timeoutMs,
      agent: false,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          clearTimeout(overall);
          fail(new AdapterError("response_too_large", `Response exceeded ${maxBytes} bytes.`, res.statusCode));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(overall);
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === "string") headers[key.toLowerCase()] = value;
          else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(", ");
        }
        resolve({ status: res.statusCode ?? 0, headers, bodyText: Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", () => {
        clearTimeout(overall);
        fail(new AdapterError("network_error", "The connection failed while reading the response."));
      });
    });

    // Hard deadline for the whole exchange, not just socket inactivity.
    const overall = setTimeout(() => {
      req.destroy();
      fail(new AdapterError("timeout", `No complete response within ${request.timeoutMs} ms.`));
    }, request.timeoutMs);

    req.on("timeout", () => {
      req.destroy();
      clearTimeout(overall);
      fail(new AdapterError("timeout", `No complete response within ${request.timeoutMs} ms.`));
    });
    req.on("error", (error) => {
      clearTimeout(overall);
      if (error instanceof AdapterError) fail(error);
      else fail(new AdapterError("network_error", "The request failed before a response was received."));
    });
    req.end(request.body);
  });
}

/** Production transport: real DNS, default address block list, no redirects. */
export const httpsTransport: Transport = createHttpsTransport();
