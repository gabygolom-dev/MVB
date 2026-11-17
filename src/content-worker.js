export default {
  fetch(request, env) {
    if (new URL(request.url).hostname !== "conteudo.interno") return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
