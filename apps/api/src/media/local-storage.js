import fs from "node:fs/promises";
import path from "node:path";

export function storagePath(config, storageKey) {
  const resolved = path.resolve(config.storageRoot, storageKey);
  const root = `${path.resolve(config.storageRoot)}${path.sep}`;
  if (!resolved.startsWith(root)) throw new Error("Invalid storage key");
  return resolved;
}

export async function removeStoredMedia(config, media) {
  await Promise.all(media.map((item) => fs.rm(storagePath(config, item.storageKey), { force: true }).catch(() => {})));
}

export async function cleanupRawFiles(files) {
  const all = Object.values(files || {}).flat();
  await Promise.all(all.map((file) => fs.rm(file.path, { force: true }).catch(() => {})));
}
