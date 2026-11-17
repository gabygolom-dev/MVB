import panel from "../src/worker.js";

export function onRequest({ request, env }) {
  return panel.fetch(request, {
    PANEL_TOKEN: env.PANEL_TOKEN,
    CONTENT: env.CONTENT,
    ASSETS: {
      fetch(assetRequest) {
        const url = new URL(assetRequest.url);
        // Pages serves index.html at the directory URL.
        if (url.pathname === "/index.html") url.pathname = "/";
        return env.ASSETS.fetch(new Request(url, assetRequest));
      },
    },
  });
}
