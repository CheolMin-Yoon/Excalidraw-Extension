import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderNative } from "./renderer.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(resolve(directory, "config.json"), "utf8"));
const normalizeOrigin = (origin) => origin.replace(/\/$/u, "");
const allowedOrigins = new Set(
  (config.allowedOrigins ?? []).map(normalizeOrigin),
);

function send(response, status, value, origin = "") {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(body);
}

const server = createServer((request, response) => {
  const origin = normalizeOrigin(request.headers.origin ?? "");
  const remote = request.socket.remoteAddress ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
    send(response, 403, { ok: false, error: "Loopback connections only." });
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { ok: true, service: "excalidraw-vector-latex" });
    return;
  }
  if (!allowedOrigins.has(origin)) {
    send(response, 403, { ok: false, error: "This extension origin is not allowed." });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    });
    response.end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/render") {
    send(response, 404, { ok: false, error: "Not found." }, origin);
    return;
  }
  let size = 0;
  const chunks = [];
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > 65536) request.destroy();
    else chunks.push(chunk);
  });
  request.on("end", () => {
    void (async () => {
      try {
        const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (message.type !== "render") throw new Error("지원하지 않는 요청입니다.");
        const svg = await renderNative(message.latex, message.settings, config);
        send(response, 200, { ok: true, svg }, origin);
      } catch (error) {
        send(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }, origin);
      }
    })();
  });
});

server.listen(18743, "127.0.0.1", async () => {
  await writeFile(resolve(directory, "server.pid"), String(process.pid));
});
