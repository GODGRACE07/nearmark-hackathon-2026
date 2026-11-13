import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

const audit = path.join(
    directory,
    "nearmark-completion-audit.py"
);

const result = spawnSync(
    "python3",
    [audit],
    {
        cwd: path.resolve(directory, ".."),
        stdio: "inherit"
    }
);

if (result.error) {
    console.error("NEARMARK audit launcher failed:", result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
