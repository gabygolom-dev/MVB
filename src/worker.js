import { CURRENT_ROUND_PATH, contentPath, mimeType, publicRound, validateRound } from "./round.js";

const cookieName = "__Host-mvb-view";
const encoder = new TextEncoder();
const publicAssets = new Set(["/index.html", "/styles.css", "/app.js", "/dm-sans.woff2", "/instrument-serif.woff2"]);
const securityHeaders = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-src https://drive.google.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Cache-Control": "private, no-store",
};

function secure(response, method) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(method === "HEAD" ? null : response.body, { status: response.status, headers });
}

const notFound = () => new Response("Não encontrado.", { status: 404 });
const unavailable = () => new Response("A rodada ainda não está disponível.", { status: 503 });

async function sameToken(input, token) {
  if (typeof input !== "string" || !/^[\da-f]{64}$/.test(input)) return false;
  const challenge = encoder.encode("mvb-link:v1");
  const [known, candidate] = await Promise.all([sessionKey(token), sessionKey(input)]);
  const proof = await crypto.subtle.sign("HMAC", known, challenge);
  return crypto.subtle.verify("HMAC", candidate, proof, challenge);
}

async function sessionKey(token) {
  return crypto.subtle.importKey("raw", encoder.encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const sessionMessage = (expires) => encoder.encode(`mvb-view:v1:${expires}`);

async function openSession(request, url, token) {
  const input = request.headers.get("X-MVB-Link");
  if (request.headers.get("Origin") !== url.origin || !await sameToken(input, token)) return notFound();
  const expires = Math.floor(Date.now() / 1000) + 86400;
  const mac = await crypto.subtle.sign("HMAC", await sessionKey(token), sessionMessage(expires));
  const value = `${expires}.${Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400` },
  });
}

async function hasSession(request, token) {
  const cookie = request.headers.get("Cookie")?.split(/;\s*/).find((entry) => entry.startsWith(`${cookieName}=`));
  const match = cookie?.slice(cookieName.length + 1).match(/^(\d{10})\.([\da-f]{64})$/);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  const signature = Uint8Array.from(match[2].match(/../g), (value) => parseInt(value, 16));
  return crypto.subtle.verify("HMAC", await sessionKey(token), signature, sessionMessage(match[1]));
}

// Unsupported units and multiple ranges fall back to a complete response.
export function parseRange(header, size) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) return null;
  if (size === 0) return false;
  if (!match[1]) {
    const length = Math.min(Number(match[2]), size);
    return length > 0 ? { offset: size - length, length } : false;
  }
  const offset = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return offset < size && end >= offset ? { offset, length: end - offset + 1 } : false;
}

function rangeStream(body, offset, length) {
  const reader = body.getReader();
  return new ReadableStream({
    async pull(controller) {
      try {
        while (length > 0) {
          const { value, done } = await reader.read();
          if (done) { controller.error(new Error("Mídia incompleta.")); return; }
          const start = Math.min(offset, value.length);
          offset -= start;
          if (start === value.length) continue;
          const part = value.subarray(start, start + length);
          length -= part.length;
          controller.enqueue(part);
          if (length === 0) {
            controller.close();
            await reader.cancel();
          }
          return;
        }
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function deliverMedia(request, content, name, storedSize) {
  const method = request.method;
  const source = await content.fetch(`https://conteudo.interno${contentPath(name)}`, { method });
  if (!source.ok) return notFound();
  const headers = new Headers(source.headers);
  headers.set("Content-Type", mimeType(name));
  headers.set("Accept-Ranges", "bytes");
  const total = Number.isSafeInteger(storedSize) && storedSize >= 0
    ? storedSize
    : source.headers.has("Content-Length") ? Number(source.headers.get("Content-Length")) : null;
  if (total !== null) headers.set("Content-Length", String(total));
  const ifRange = request.headers.get("If-Range");
  const range = method === "GET" && total !== null && (!ifRange || ifRange === source.headers.get("ETag"))
    ? parseRange(request.headers.get("Range"), Number(total))
    : null;
  if (range === false) {
    await source.body?.cancel();
    headers.set("Content-Range", `bytes */${total}`);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${total}`);
    headers.set("Content-Length", String(range.length));
    return new Response(rangeStream(source.body, range.offset, range.length), { status: 206, headers });
  }
  return new Response(source.body, { status: 200, headers });
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/acesso" && request.method === "POST") {
    return env.PANEL_TOKEN ? openSession(request, url, env.PANEL_TOKEN) : unavailable();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  if (path === "/" || publicAssets.has(path)) {
    if (path === "/") url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
  if (path === "/robots.txt") return new Response("User-agent: *\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const match = path.match(/^\/midia\/([a-z0-9-]+)\/([a-z0-9_.-]+)$/);
  if (path !== "/api/rodada" && !match) return notFound();
  if (!env.PANEL_TOKEN || !await hasSession(request, env.PANEL_TOKEN)) return notFound();
  const current = await env.CONTENT.fetch(`https://conteudo.interno${CURRENT_ROUND_PATH}`);
  if (!current.ok) return match ? notFound() : unavailable();

  const round = await current.json();
  const files = validateRound(round);
  if (!match) return Response.json(publicRound(round));
  const [, id, name] = match;
  if (round.id !== id || !files.has(name)) return notFound();
  return deliverMedia(request, env.CONTENT, name, round.sizes?.[name]);
}

export default {
  async fetch(request, env) {
    try {
      return secure(await route(request, env), request.method);
    } catch (error) {
      console.error(JSON.stringify({ message: "Falha ao servir a rodada", type: error.name }));
      return secure(unavailable(), request.method);
    }
  },
};
