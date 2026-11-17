import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { CURRENT_ROUND_PATH, validateRound } from "../src/round.js";

const maxAssetSize = 25 * 1024 * 1024;
const [source, option] = process.argv.slice(2);
if (!source || (option && option !== "--deploy")) {
  console.error("Uso: npm run rodada:publicar -- .rounds/minha-rodada [--deploy]");
  process.exit(1);
}

const folder = resolve(source);
const configFile = resolve(folder, "rodada.json");
const mediaFolder = resolve(folder, "midia");
const bundle = resolve(".rounds/bundle");
try {
  if (folder === bundle) throw new Error("Escolha uma pasta de origem diferente de .rounds/bundle.");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const files = validateRound(config);
  for (const name of files) {
    const asset = resolve(mediaFolder, name);
    const info = await stat(asset);
    if (!info.isFile() || !info.size || info.size > maxAssetSize) throw new Error(`${name}: arquivo vazio ou acima de 25 MiB.`);
  }

  // This directory contains a generated deployment bundle only.
  await rm(bundle, { recursive: true, force: true });
  await mkdir(resolve(bundle, "midia"), { recursive: true });
  for (const name of files) await copyFile(resolve(mediaFolder, name), resolve(bundle, "midia", name));
  await writeFile(resolve(bundle, basename(CURRENT_ROUND_PATH)), JSON.stringify(config));

  console.log(`Rodada ${config.id} validada. ${config.posts.length} publicações e ${files.size} arquivos no pacote privado.`);
  if (option === "--deploy") {
    const result = spawnSync("wrangler", ["deploy", "--config", "wrangler.conteudo.jsonc"], { stdio: "inherit" });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
