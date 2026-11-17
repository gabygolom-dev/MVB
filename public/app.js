const $ = (id) => document.getElementById(id);
const types = { reel: "Reel", carousel: "Carrossel", image: "Imagem única" };
const paths = {
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18m6-18v18"/>',
  feed: '<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/>',
  reel: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 8h18m-9-5 2 5m-7-5 2 5m1 4 5 3-5 3z"/>',
  carousel: '<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 3H5a2 2 0 0 0-2 2v12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m3 17 5-4 4 3 4-5 5 4"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="m6 6 12 12m0-12L6 18"/>', play: '<path fill="currentColor" d="m9 5 11 7-11 7z"/>',
  check: '<path d="m5 12 5 5L19 7"/>', pen: '<path d="m14 6 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z"/>',
};

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function icon(name) {
  const template = document.createElement("template");
  template.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  return template.content.firstElementChild;
}

function picture(src, alt = "", lazy = true) {
  const img = el("img");
  img.alt = alt;
  img.loading = lazy ? "lazy" : "eager";
  img.decoding = "async";
  img.src = src;
  return img;
}

function dateLabel(date) {
  return date ? date.split("-").reverse().join("/") : "";
}

let activePlayer;
let round;
let feedBuilt = false;

function releasePlayer() {
  activePlayer?.();
  activePlayer = null;
}

function reel(post) {
  const item = post.media[0];
  const container = el("div", "post-media reel");
  const stage = el("div", "video-stage");
  container.append(stage);
  if (item.preview) {
    const fallback = el("p", "reel-help", "Se o player não abrir, ");
    const link = el("a", "", "Abrir no Drive");
    link.href = item.external;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    fallback.append(link);
    container.append(fallback);

    function showPoster() {
      const cover = picture(post.cover, "", false);
      cover.className = "reel-poster";
      const play = el("button", "reel-play");
      play.type = "button";
      play.setAttribute("aria-label", `Reproduzir ${post.label}`);
      play.append(icon("play"));
      play.addEventListener("click", showPlayer);
      stage.replaceChildren(cover, play);
    }

    function showPlayer() {
      releasePlayer();
      const frame = el("iframe");
      frame.title = `Player do Google Drive · ${post.label}`;
      frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "no-referrer";
      frame.src = item.preview;
      stage.replaceChildren(frame);
      activePlayer = showPoster;
    }

    showPoster();
    if (post.openPlayer) showPlayer();
  } else {
    const video = el("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.poster = post.cover;
    video.src = item.src;
    video.setAttribute("aria-label", post.label);
    video.addEventListener("play", () => {
      releasePlayer();
      activePlayer = () => video.pause();
    });
    video.addEventListener("error", () => {
      if (!container.querySelector(".reel-help")) container.append(el("p", "reel-help", "Não foi possível reproduzir. Peça à equipe um MP4 compatível ou um link compartilhável do Drive."));
    });
    stage.append(video);
  }
  return container;
}

function postMedia(post) {
  if (post.type === "reel") return reel(post);
  const container = el("div", "post-media");
  const frame = el("figure", "photo-frame");
  const first = post.media[0];
  const image = picture(first.src, first.alt);
  frame.append(image);
  container.append(frame);
  if (post.type !== "carousel") return container;

  frame.classList.add("carousel");
  image.draggable = false;
  const controls = el("div", "carousel-controls");
  const previous = el("button", "icon-button");
  const next = el("button", "icon-button");
  for (const [button, label, name] of [[previous, "Imagem anterior", "left"], [next, "Próxima imagem", "right"]]) {
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.append(icon(name));
  }
  const count = el("span");
  count.setAttribute("aria-live", "polite");
  controls.append(previous, count, next);
  container.append(controls);
  let index = 0;
  function move(delta) {
    index = Math.min(post.media.length - 1, Math.max(0, index + delta));
    const item = post.media[index];
    if (image.getAttribute("src") !== item.src) image.src = item.src;
    image.alt = item.alt;
    count.textContent = `${index + 1} de ${post.media.length}`;
    previous.disabled = index === 0;
    next.disabled = index === post.media.length - 1;
  }
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  container.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });
  let start;
  frame.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    start = { x: event.clientX, y: event.clientY };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener("pointercancel", () => { start = null; });
  frame.addEventListener("pointerup", (event) => {
    if (!start) return;
    const delta = event.clientX - start.x;
    if (Math.abs(delta) > 38 && Math.abs(delta) > Math.abs(event.clientY - start.y)) move(delta > 0 ? -1 : 1);
    start = null;
  });
  move(0);
  return container;
}

function publication(post, inDialog = false) {
  const preview = el("div", "post-preview");
  const details = el("div", "post-details");
  const title = el(inDialog ? "h2" : "h3", "", post.label);
  if (inDialog) title.id = "post-dialog-title";
  const meta = [types[post.type], dateLabel(post.date)].filter(Boolean).join(" · ");
  const caption = el("p", post.caption ? "caption" : "caption quiet", post.caption || "Legenda pendente.");
  details.append(title, el("div", "post-meta", meta), caption);
  preview.append(postMedia(inDialog ? { ...post, openPlayer: true } : post), details);
  return preview;
}

function showPost(post) {
  releasePlayer();
  $("post-dialog-type").textContent = types[post.type].toLocaleUpperCase("pt-BR");
  $("post-dialog-content").replaceChildren(publication(post, true));
  $("post-dialog").showModal();
}

function showView(view) {
  releasePlayer();
  if (view === "feed" && !feedBuilt) {
    for (const post of round.posts) {
      const card = el("article", "feed-post");
      card.append(publication(post));
      $("feed").append(card);
    }
    feedBuilt = true;
  }
  for (const current of ["grid", "feed"]) {
    $(current).hidden = current !== view;
    $(`${current}-button`).setAttribute("aria-pressed", String(current === view));
  }
}

function postWithDate(post) {
  return post.date ? `${post.label} (${dateLabel(post.date)})` : post.label;
}

function whatsappUrl(message) {
  return `https://wa.me/${round.whatsapp}?text=${encodeURIComponent(message)}`;
}

function showApproval() {
  const count = round.posts.length;
  $("approve-copy").textContent = `Esta aprovação vale para ${count === 1 ? "a publicação" : `as ${count} publicações`} da rodada ${round.label}.`;
  $("approved-list").replaceChildren(...round.posts.map((post) => el("li", "", postWithDate(post))));
  const firstLine = round.status === "demo" ? "[TESTE] Aprovação de conteúdos da MVB Planejados" : "Olá! Aprovo os conteúdos da MVB Planejados.";
  $("approve-link").href = whatsappUrl([firstLine, `Rodada: ${round.label}`, "", ...round.posts.map((post) => `• ${postWithDate(post)}`)].join("\n"));
  $("approve-dialog").showModal();
}

function addAdjustment() {
  const row = el("fieldset", "adjust-row");
  const legend = el("legend");
  const postLabel = el("label", "", "Publicação");
  const select = el("select");
  select.required = true;
  const empty = el("option", "", "Selecione um conteúdo");
  empty.value = "";
  empty.disabled = true;
  empty.selected = true;
  select.append(empty);
  for (const post of round.posts) {
    const option = el("option", "", post.label);
    option.value = String(post.number);
    select.append(option);
  }
  postLabel.append(select);
  const noteLabel = el("label", "", "Ajuste solicitado");
  const textarea = el("textarea");
  textarea.required = true;
  textarea.maxLength = 1500;
  textarea.addEventListener("input", () => textarea.setCustomValidity(""));
  noteLabel.append(textarea);
  const remove = el("button", "remove-adjust", "Remover pedido");
  remove.type = "button";
  remove.addEventListener("click", () => { row.remove(); updateAdjustments(); });
  row.append(legend, postLabel, noteLabel, remove);
  $("adjust-items").append(row);
  updateAdjustments();
  return select;
}

function updateAdjustments() {
  const rows = [...$("adjust-items").children];
  for (const [index, row] of rows.entries()) {
    row.querySelector("legend").textContent = `Pedido ${index + 1}`;
    row.querySelector(".remove-adjust").hidden = rows.length === 1;
  }
  $("add-adjust").hidden = rows.length >= round.posts.length;
}

function showAdjustment() {
  if (!$("adjust-items").children.length) addAdjustment();
  $("adjust-dialog").showModal();
}

$("adjust-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const requests = [];
  for (const row of $("adjust-items").children) {
    const post = round.posts.find((item) => String(item.number) === row.querySelector("select").value);
    const textarea = row.querySelector("textarea");
    const note = textarea.value.trim();
    if (!note) {
      textarea.setCustomValidity("Digite o ajuste solicitado.");
      textarea.reportValidity();
      return;
    }
    requests.push(`${postWithDate(post)}\n${note}`);
  }
  const firstLine = round.status === "demo" ? "[TESTE] Ajustes de conteúdos da MVB Planejados" : "Olá! Seguem os ajustes solicitados para a MVB Planejados.";
  const link = el("a");
  link.href = whatsappUrl([firstLine, `Rodada: ${round.label}`, "", requests.join("\n\n")].join("\n"));
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
});

function render() {
  $("round-label").textContent = round.label;
  $("round-state").textContent = round.status === "demo" ? "Demonstração · dados de teste" : round.status === "preview" ? "Prévia da rodada" : "";
  if (round.logo) $("brand-mark").replaceChildren(picture(round.logo, "", false));
  $("post-count").textContent = `${round.posts.length} ${round.posts.length === 1 ? "conteúdo para revisar" : "conteúdos para revisar"}`;
  for (const [index, post] of round.posts.entries()) {
    const tile = el("button", "tile");
    tile.type = "button";
    tile.setAttribute("aria-label", `Ver ${post.label}, ${types[post.type]}`);
    const cover = el("span", "cover");
    const badge = el("span", "type-icon");
    badge.append(icon(post.type));
    cover.append(picture(post.cover, "", index >= 3), badge);
    tile.append(cover, el("span", "tile-label", post.label));
    tile.addEventListener("click", () => showPost(post));
    $("grid").append(tile);
  }
  $("status").hidden = true;
  $("panel").hidden = false;
  $("review-link").hidden = false;
}

for (const button of document.querySelectorAll(".close")) {
  button.append(icon("close"));
  button.addEventListener("click", () => button.closest("dialog").close());
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}
$("post-dialog").addEventListener("close", () => {
  releasePlayer();
  $("post-dialog-content").replaceChildren();
});
for (const name of ["grid", "feed"]) {
  $(`${name}-button`).prepend(icon(name));
  $(`${name}-button`).addEventListener("click", () => showView(name));
}
$("review-link").addEventListener("click", (event) => {
  event.preventDefault();
  $("resposta").scrollIntoView();
});
$("approve-button").prepend(icon("check"));
$("adjust-button").prepend(icon("pen"));
$("approve-button").addEventListener("click", showApproval);
$("adjust-button").addEventListener("click", showAdjustment);
$("add-adjust").addEventListener("click", () => addAdjustment().focus());

async function start() {
  const token = location.hash.slice(1);
  if (/^[\da-f]{64}$/.test(token)) {
    const access = await fetch("/api/acesso", { method: "POST", headers: { "X-MVB-Link": token } });
    if (!access.ok) return showStatus("Link indisponível", "Confira se você abriu o link completo enviado pela equipe.");
  }
  const response = await fetch("/api/rodada");
  if (response.status === 404) return showStatus("Abra pelo link da equipe", "Use o link completo de aprovação enviado pela MVB Planejados.");
  if (!response.ok) return showStatus("Rodada indisponível", "A rodada ainda não está disponível para revisão. Tente novamente mais tarde.");
  round = await response.json();
  render();
}

function showStatus(title, message) {
  $("status").replaceChildren(el("h1", "", title), el("p", "", message));
}

start().catch(() => showStatus("Não foi possível abrir o painel", "Confira sua conexão e recarregue a página."));
