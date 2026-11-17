import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { parseRange } from "../src/worker.js";
import { driveLinks, validateRound } from "../src/round.js";

const origin = "https://painel.example";
const token = "a".repeat(64);
const media = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const demo = {
  id: "rodada-demo",
  label: "16 a 22 de novembro",
  status: "demo",
  whatsapp: "5548988273434",
  sizes: { "video.mp4": 10 },
  posts: [
    { number: 1, position: 2, title: "Reel", type: "reel", date: "2026-11-17", cover: "capa.jpg", caption: "Um ✨\n\n#dois", media: [{ file: "video.mp4" }] },
    { number: 2, position: 1, title: "Foto", type: "image", cover: "capa.jpg", caption: "Teste", media: [{ file: "capa.jpg" }] },
  ],
};
const env = {
  PANEL_TOKEN: token,
  ASSETS: { fetch: () => new Response("painel") },
  CONTENT: {
    fetch(url, { method } = {}) {
      if (url.endsWith("/rodada-atual.json")) return Response.json(demo);
      if (!url.endsWith("/video.mp4")) return new Response(null, { status: 404 });
      return new Response(method === "HEAD" ? null : media, { headers: { ETag: '"abc"' } });
    },
  },
};
const request = (path, options) => worker.fetch(new Request(origin + path, options), env);

async function openSession() {
  const session = await request("/api/acesso", { method: "POST", headers: { Origin: origin, "X-MVB-Link": token } });
  assert.equal(session.status, 204);
  const setCookie = session.headers.get("Set-Cookie");
  assert.match(setCookie, /Secure; HttpOnly; SameSite=Strict/);
  return { Cookie: setCookie.split(";")[0] };
}

test("rejeita acesso externo e autoriza apenas a rodada atual", async () => {
  assert.equal((await request("/")).headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.equal((await request("/api/rodada")).status, 404);
  assert.equal((await request("/midia/rodada-demo/video.mp4")).status, 404);
  for (const headers of [{ Origin: "https://outro.example", "X-MVB-Link": token }, { Origin: origin, "X-MVB-Link": "b".repeat(64) }]) {
    assert.equal((await request("/api/acesso", { method: "POST", headers })).status, 404);
  }
  const headers = await openSession();
  assert.equal((await request("/midia/rodada-anterior/video.mp4", { headers })).status, 404);
  assert.equal((await request("/midia/rodada-demo/nao-listado.mp4", { headers })).status, 404);
  const response = await request("/api/rodada", { headers });
  const round = await response.json();
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(round.posts.map((post) => post.label), ["02 · Foto", "01 · Reel"]);
  assert.equal(round.posts[1].caption, "Um ✨\n\n#dois");
});

test("abre o link compartilhado sem fragmento ou sessão prévia", async () => {
  const path = "/aprovar/" + token;
  const response = await worker.fetch(new Request(origin + path + "?utm_source=whatsapp", {
    headers: { Referer: "https://web.whatsapp.com/" },
  }), {
    ...env,
    ASSETS: { fetch(asset) {
      assert.equal(asset.url, origin + "/index.html");
      return new Response("painel");
    } },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "painel");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const cookie = response.headers.get("Set-Cookie");
  assert.match(cookie, /Secure; HttpOnly; SameSite=Strict/);
  assert.equal((await request("/api/rodada", { headers: { Cookie: cookie.split(";")[0] } })).status, 200);
  assert.equal((await request(path, { method: "HEAD" })).headers.get("Set-Cookie"), null);
  const invalid = await request("/aprovar/" + "b".repeat(64));
  assert.equal(invalid.status, 404);
  assert.equal(invalid.headers.get("Set-Cookie"), null);
});

test("atende HEAD, intervalos de bytes, sufixos e requisições improcedentes", async () => {
  const path = "/midia/rodada-demo/video.mp4";
  const headers = await openSession();
  const head = await request(path, { method: "HEAD", headers });
  assert.equal(head.headers.get("Content-Length"), "10");
  assert.equal(head.headers.get("Content-Type"), "video/mp4");
  assert.equal(head.headers.get("Accept-Ranges"), "bytes");
  assert.equal(await head.text(), "");
  const partial = await request(path, { headers: { ...headers, Range: "bytes=3-6" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Range"), "bytes 3-6/10");
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [3, 4, 5, 6]);
  const bad = await request(path, { headers: { ...headers, Range: "bytes=10-" } });
  assert.equal(bad.status, 416);
  assert.equal(bad.headers.get("Content-Range"), "bytes */10");
  const whole = await request(path, { headers: { ...headers, Range: "bytes=3-6", "If-Range": '"old"' } });
  assert.equal(whole.status, 200);
  assert.deepEqual(parseRange("bytes=-3", 10), { offset: 7, length: 3 });
  assert.deepEqual(parseRange("bytes=3-", 10), { offset: 3, length: 7 });
});

test("converte o link do Drive em preview e rejeita pastas e outros domínios", () => {
  const id = "A055abcdefghjklmN0";
  assert.deepEqual(driveLinks("https://drive.google.com/file/d/" + id + "/view?usp=sharing&resourcekey=abc-123"), {
    preview: "https://drive.google.com/file/d/" + id + "/preview?resourcekey=abc-123",
    external: "https://drive.google.com/file/d/" + id + "/view?resourcekey=abc-123",
  });
  assert.equal(driveLinks("https://drive.google.com/drive/folders/" + id), null);
  assert.equal(driveLinks("https://drive.google.com.example/file/d/" + id + "/view"), null);
  assert.throws(() => validateRound({ ...demo, posts: [{ ...demo.posts[0], media: [{ drive: "https://example.com" }] }] }), /Google Drive/);
});
