import assert from "node:assert/strict";
import test from "node:test";

import { AdapterError } from "../lib/evalgate/adapters/errors.ts";
import { isBlockedAddress, resolvePublicAddress, validateTargetUrl } from "../lib/evalgate/adapters/network-guard.ts";
import { guardedLookup } from "../lib/evalgate/adapters/transport.ts";

test("blocks private, loopback, link-local, metadata and reserved addresses", () => {
  for (const address of [
    "127.0.0.1", "10.0.0.1", "172.16.5.5", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:a00:1::1",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test("allows ordinary public addresses", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("URL validation requires https and a public host", () => {
  assert.equal(validateTargetUrl("https://api.example.com/v1").hostname, "api.example.com");
  for (const bad of ["ftp://x.com", "http://x.com", "https://localhost", "https://foo.local", "https://intranet", "https://[fd00::1]/"]) {
    assert.throws(() => validateTargetUrl(bad), AdapterError, bad);
  }
});

test("DNS answers are checked: any private address refuses the host", async () => {
  await assert.rejects(
    resolvePublicAddress("rebind.example.com", async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }]),
    (error: unknown) => error instanceof AdapterError && error.code === "blocked_address",
  );
  const ok = await resolvePublicAddress("ok.example.com", async () => [{ address: "93.184.216.34", family: 4 }]);
  assert.equal(ok.address, "93.184.216.34");
  await assert.rejects(
    resolvePublicAddress("nx.example.com", async () => { throw new Error("ENOTFOUND"); }),
    (error: unknown) => error instanceof AdapterError && error.code === "dns_error",
  );
});

test("the socket lookup used for connecting refuses private answers", async () => {
  const lookup = guardedLookup(async () => [{ address: "169.254.169.254", family: 4 }]);
  const error = await new Promise<unknown>((resolve) => {
    (lookup as unknown as (h: string, o: object, cb: (e: unknown) => void) => void)("evil.example.com", {}, (e) => resolve(e));
  });
  assert.ok(error instanceof AdapterError && error.code === "blocked_address");

  const good = guardedLookup(async () => [{ address: "93.184.216.34", family: 4 }]);
  const result = await new Promise<unknown[]>((resolve) => {
    (good as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)("ok.example.com", { all: true }, (...args) => resolve(args));
  });
  assert.equal(result[0], null);
  assert.deepEqual(result[1], [{ address: "93.184.216.34", family: 4 }]);
});
