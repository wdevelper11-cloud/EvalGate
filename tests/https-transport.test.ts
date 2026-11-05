import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

import { AdapterError } from "../lib/evalgate/adapters/errors.ts";
import { createHttpsTransport } from "../lib/evalgate/adapters/transport.ts";

// Real TLS server on 127.0.0.1 posing as bot.example.com, with a throwaway cert.
const host = "bot.example.com";
let server: Server;
let port = 0;
let ca = "";
let dir = "";
const received: Array<{ path: string; body: string; headers: Record<string, unknown> }> = [];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "transport-test-"));
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
    "-subj", `/CN=${host}`, "-addext", `subjectAltName=DNS:${host}`,
  ], { stdio: "ignore" });
  ca = readFileSync(join(dir, "cert.pem"), "utf8");
  server = createServer({ key: readFileSync(join(dir, "key.pem")), cert: ca }, (req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push({ path: req.url ?? "", body, headers: req.headers });
      if (req.url === "/ok") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ reply: "hello back" }));
      } else if (req.url === "/redirect") {
        res.writeHead(302, { location: `https://${host}:${port}/ok` });
        res.end();
      } else if (req.url === "/big") {
        res.writeHead(200);
        res.end("x".repeat(5000));
      } else if (req.url === "/slow") {
        // never answer
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => {
  server.closeAllConnections();
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const resolver = async () => [{ address: "127.0.0.1", family: 4 }];
// Tests only: allow loopback so we can reach the local server.
const testTransport = createHttpsTransport({ resolver, ca, isBlocked: () => false, maxResponseBytes: 1000 });

const post = (path: string, timeoutMs = 3000, transport = testTransport) =>
  transport({ url: `https://${host}:${port}${path}`, headers: { "content-type": "application/json", authorization: "Bearer k" }, body: '{"q":"hi"}', timeoutMs });

test("real TLS POST: sends exact body and headers, returns status and text", async () => {
  const response = await post("/ok");
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.bodyText), { reply: "hello back" });
  const last = received.at(-1)!;
  assert.equal(last.body, '{"q":"hi"}');
  assert.equal(last.headers.authorization, "Bearer k");
});

test("redirects are returned as-is and never followed", async () => {
  const before = received.length;
  const response = await post("/redirect");
  assert.equal(response.status, 302);
  assert.equal(received.length, before + 1);
});

test("responses over the size cap are cut off", async () => {
  await assert.rejects(post("/big"), (error: unknown) => error instanceof AdapterError && error.code === "response_too_large");
});

test("a server that never answers times out", async () => {
  await assert.rejects(post("/slow", 1000), (error: unknown) => error instanceof AdapterError && error.code === "timeout");
});

test("with the production address policy, a host resolving to loopback is refused at connect time", async () => {
  const strict = createHttpsTransport({ resolver, ca });
  const before = received.length;
  await assert.rejects(post("/ok", 3000, strict), (error: unknown) => error instanceof AdapterError && error.code === "blocked_address");
  assert.equal(received.length, before);
});
