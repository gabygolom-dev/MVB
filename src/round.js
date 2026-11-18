export const CURRENT_ROUND_PATH = "/rodada-atual.json";

export const imageTypes = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

const mp4Types = { mp4: "video/mp4" };
const mediaNamePattern = /^[a-z0-9][a-z0-9_-]{0,79}\.[a-z0-9]+$/;
const roundIdPattern = /^[a-z0-9][a-z0-9-]{5,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const mimeType = (name) => {
  const extension = name.split(".").at(-1);
  return imageTypes[extension] ?? mp4Types[extension];
};

export const contentPath = (name) => `/midia/${name}`;
export const postLabel = (post) => `${String(post.number).padStart(2, "0")} · ${post.title}`;
export const mediaUrl = (round, name) => `/midia/${round.id}/${name}`;

function validDate(value) {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

export function driveLinks(value) {
  if (typeof value !== "string") return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.origin !== "https://drive.google.com" || url.username || url.password) return null;
  const path = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/(?:view|preview|edit))?\/?$/);
  const id = path?.[1] ?? (["/open", "/uc"].includes(url.pathname) ? url.searchParams.get("id") : null);
  const resourceKey = url.searchParams.get("resourcekey");
  if (!id || !/^[\w-]{16,200}$/.test(id) || (resourceKey && !/^[\w-]{1,200}$/.test(resourceKey))) return null;
  const base = `https://drive.google.com/file/d/${id}/`;
  const query = resourceKey ? `?resourcekey=${resourceKey}` : "";
  return { preview: `${base}preview${query}`, external: `${base}view${query}` };
}

export function validateRound(round) {
  const errors = [];
  const files = new Set();

  if (!round || typeof round !== "object") throw new Error("A rodada deve ser um objeto JSON.");
  if (typeof round.id !== "string" || !roundIdPattern.test(round.id)) errors.push("Identificador da rodada inválido.");
  if (typeof round.label !== "string" || !round.label.trim()) errors.push("Informe a identificação da semana.");
  if (!["review", "preview", "demo"].includes(round.status)) errors.push("Use status review, preview ou demo.");
  if (!/^[1-9]\d{9,14}$/.test(round.whatsapp) || typeof round.whatsapp !== "string") {
    errors.push("Informe o WhatsApp com código do país e DDD, apenas números.");
  }
  if (!Array.isArray(round.posts) || round.posts.length === 0) errors.push("Adicione pelo menos uma publicação.");

  function addFile(name, types, label) {
    if (typeof name !== "string" || !mediaNamePattern.test(name) || !Object.hasOwn(types, name.split(".").at(-1))) {
      errors.push(`${label}: referência de mídia inválida.`);
      return;
    }
    files.add(name);
  }

  if (round.logo != null) addFile(round.logo, imageTypes, "Logo");

  const numbers = new Set();
  const positions = new Set();
  for (const [index, post] of (Array.isArray(round.posts) ? round.posts : []).entries()) {
    const label = `Publicação ${index + 1}`;
    if (!post || typeof post !== "object") {
      errors.push(`${label}: dados inválidos.`);
      continue;
    }
    for (const [key, used] of [["number", numbers], ["position", positions]]) {
      const value = post[key];
      if (!Number.isSafeInteger(value) || value < 1 || used.has(value)) errors.push(`${label}: ${key} deve ser único e positivo.`);
      used.add(value);
    }
    if (typeof post.title !== "string" || !post.title.trim() || /[\r\n]/.test(post.title)) errors.push(`${label}: informe um título em uma linha.`);
    if ((post.date != null || round.status === "review") && !validDate(post.date)) errors.push(`${label}: use uma data válida no formato AAAA-MM-DD.`);
    if (typeof post.caption !== "string" || (round.status === "review" && !post.caption.trim())) errors.push(`${label}: informe a legenda.`);

    addFile(post.cover, imageTypes, `${label}, capa`);
    const count = Array.isArray(post.media) ? post.media.length : 0;
    if (post.type === "carousel" ? count < 2 : !["image", "reel"].includes(post.type) || count !== 1) {
      errors.push(`${label}: o tipo ou a quantidade de mídias é inválido.`);
    }
    if (!Array.isArray(post.media)) continue;
    for (const [mediaIndex, item] of post.media.entries()) {
      if (post.type === "reel" && item?.drive != null) {
        if (!driveLinks(item.drive)) errors.push(`${label}: forneça o link de compartilhamento de um arquivo de vídeo do Google Drive.`);
      }
      if (post.type !== "reel" || item?.drive == null || item.file != null) {
        addFile(item?.file, post.type === "reel" ? mp4Types : imageTypes, `${label}, mídia ${mediaIndex + 1}`);
      }
      if (item?.alt != null && typeof item.alt !== "string") errors.push(`${label}: o texto alternativo deve ser um texto.`);
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return files;
}

export function publicRound(round) {
  return {
    label: round.label,
    status: round.status,
    whatsapp: round.whatsapp,
    logo: round.logo ? mediaUrl(round, round.logo) : null,
    posts: round.posts.toSorted((a, b) => a.position - b.position).map((post) => ({
      number: post.number,
      title: post.title,
      label: postLabel(post),
      type: post.type,
      caption: post.caption,
      date: post.date ?? null,
      cover: mediaUrl(round, post.cover),
      media: post.media.map(({ file, alt, drive }) => ({
        ...(file ? { src: mediaUrl(round, file), alt: alt || post.title } : {}),
        ...(drive ? driveLinks(drive) : {}),
      })),
    })),
  };
}
