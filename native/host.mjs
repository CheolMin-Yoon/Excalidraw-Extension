import { readFile } from "node:fs/promises";
import { renderNative } from "./renderer.mjs";

function respond(value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([length, body]));
}

let input = Buffer.alloc(0);
let received = false;
process.stdin.on("data", (chunk) => {
  if (received) return;
  input = Buffer.concat([input, chunk]);
  if (input.length < 4) return;
  const size = input.readUInt32LE(0);
  if (size > 65536) {
    received = true;
    respond({ ok: false, error: "요청이 너무 큽니다." });
    process.stdin.destroy();
    return;
  }
  if (input.length < size + 4) return;
  received = true;
  process.stdin.pause();
  void (async () => {
    try {
      const request = JSON.parse(input.subarray(4, size + 4).toString("utf8"));
      if (request.type !== "render") throw new Error("지원하지 않는 요청입니다.");
      const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
      const svg = await renderNative(request.latex, request.settings, config);
      respond({ ok: true, svg });
    } catch (error) {
      respond({ ok: false, error: error.message || String(error) });
    } finally {
      process.stdin.destroy();
    }
  })();
});
