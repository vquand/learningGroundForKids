import { open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function saveRootCredential(path: string, password: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error("ROOT_PASSWORD_FILE must be an absolute path.");
  const repository = await realpath(fileURLToPath(new URL("../../../", import.meta.url)));
  const destination = resolve(await realpath(dirname(path)), basename(path));
  const fromRepository = relative(repository, destination);
  if (fromRepository !== ".." && !fromRepository.startsWith(`..${sep}`)) {
    throw new Error("ROOT_PASSWORD_FILE must be outside the repository.");
  }
  // Exclusive creation rejects existing files and symlinks; never overwrite a
  // previously issued credential. Mode 0600 limits access to this OS user.
  const file = await open(destination, "wx", 0o600);
  try {
    await file.writeFile(`${password}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}
