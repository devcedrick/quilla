import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "1.7.0";
const artifacts = {
  "win32-x64": [
    "windows-x64",
    "78da56a3d94b602e765618807ae33169b65d920ff7422d5110e373998ec1efe1",
  ],
  "linux-x64": [
    "linux-x64",
    "f091c24dace6b019655d90e754f7e8b8100eb6c2902c7919b0eccaeceed42682",
  ],
  "darwin-arm64": [
    "macos-arm64",
    "0cf4e625009b7cbcdf8f5ffa1d7217563f15205ba6356c5a76406ad067d70cc7",
  ],
};
const cache = path.join(root, "node_modules/.cache/quilla-rive", version);
const binary = path.join(
  cache,
  process.platform === "win32" ? "rive.exe" : "rive",
);
const project = "assets/rive/kuwi-auth";
const contract = JSON.parse(
  readFileSync(path.join(root, "lib/brand/kuwi-rive.json"), "utf8"),
);

export function assertSafeArchiveEntries(list) {
  for (const entry of list.trim().split(/\r?\n/)) {
    if (
      !entry ||
      path.posix.isAbsolute(entry) ||
      entry.includes("\\") ||
      entry.includes(":") ||
      entry.split("/").includes("..")
    ) {
      throw new Error("Unsafe Rive CLI archive path");
    }
    if (
      !["rive", "rive.exe", "docs", "samples"].includes(entry.split("/")[0])
    ) {
      throw new Error("Unexpected Rive CLI archive entry");
    }
  }
}

export function assertInspection(report) {
  if (!Array.isArray(report.problems) || report.problems.length)
    throw new Error("Rive inspection reported problems");
  const artboard = report.artboards?.find(
    (item) => item.name === contract.artboard,
  );
  if (
    !artboard ||
    artboard.width !== contract.width ||
    artboard.height !== contract.height
  )
    throw new Error("Unexpected Kuwi artboard");
  if (
    !artboard.children?.some(
      (item) =>
        item.type === "StateMachine" && item.name === contract.stateMachine,
    )
  )
    throw new Error("Missing Kuwi state machine");
  if (!artboard.children.some((item) => item.type === "Image"))
    throw new Error("Missing approved Kuwi pose");
  const image = artboard.children.find((item) => item.type === "Image");
  const mesh = image.children?.find((item) => item.type === "Mesh");
  const timeline = artboard.children.find(
    (item) =>
      item.type === "LinearAnimation" && item.name === contract.timeline,
  );
  if (
    !mesh?.rig?.triangles?.length ||
    !timeline?.children?.length ||
    timeline.fps !== contract.fps ||
    timeline.duration !== contract.duration ||
    timeline.enums?.loopValue !== "loop"
  )
    throw new Error("Missing native Kuwi mesh animation or unexpected timing");
  const vertexIds = new Set(
    mesh.children
      ?.filter((item) =>
        ["MeshVertex", "ContourMeshVertex"].includes(item.type),
      )
      .map((item) => item.id),
  );
  for (const keyed of timeline.children) {
    if (keyed.type !== "KeyedObject" || !vertexIds.has(keyed.objectId))
      throw new Error("Kuwi motion must target native mesh vertices only");
    for (const property of keyed.children ?? []) {
      const frames = property.children ?? [];
      if (
        ![24, 25].includes(property.propertyKey) ||
        frames[0]?.frame !== 0 ||
        frames.at(-1)?.frame !== contract.duration ||
        frames[0]?.value !== frames.at(-1)?.value
      )
        throw new Error("Kuwi mesh motion must return to its resting pose");
    }
  }
  if (
    report.roots?.some(
      (item) => item.type === "ScriptAsset" || item.type === "ShaderAsset",
    )
  )
    throw new Error("Kuwi must not contain scripts or shaders");
}

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      RIVE_ANALYTICS: "off",
      RIVE_NO_TUI: "1",
      RIVE_HOME: path.join(cache, "state"),
    },
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.stderr || result.error?.message || "Rive command failed",
    );
  return result.stdout;
}

async function install() {
  if (existsSync(binary)) {
    if (command(binary, ["--version"]).trim() !== `rive ${version}`)
      throw new Error("Unexpected cached Rive CLI version");
    console.log(`Rive CLI ${version} is available in the project cache.`);
    return;
  }
  const artifact = artifacts[`${process.platform}-${process.arch}`];
  if (!artifact) throw new Error("Unsupported Rive CLI platform");
  const [platform, expectedHash] = artifact;
  const response = await fetch(
    `https://releases.rive.app/cli/v${version}/rive-${platform}.tar.gz`,
  );
  if (!response.ok) throw new Error("Rive CLI download failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash)
    throw new Error("Rive CLI checksum mismatch");
  await mkdir(cache, { recursive: true });
  const archive = path.join(cache, "download.tar.gz");
  await writeFile(archive, bytes);
  assertSafeArchiveEntries(command("tar", ["-tzf", archive]));
  const modes = command("tar", ["-tvzf", archive]).trim().split(/\r?\n/);
  if (modes.some((line) => !["-", "d"].includes(line[0])))
    throw new Error("Rive CLI archive contains links or special files");
  command("tar", [
    "-xzf",
    archive,
    "-C",
    cache,
    process.platform === "win32" ? "rive.exe" : "rive",
    "docs",
    "samples",
  ]);
  if (command(binary, ["--version"]).trim() !== `rive ${version}`)
    throw new Error("Installed Rive CLI version mismatch");
  console.log(
    `Installed verified Rive CLI ${version} in the project cache; PATH unchanged.`,
  );
}

async function main(args) {
  if (args[0] === "install") return install();
  if (!existsSync(binary))
    throw new Error("Rive CLI is missing. Run npm run rive:install first.");
  if (args[0] === "build" || args[0] === "verify") {
    const verification = JSON.parse(
      command(binary, [project, "--verify", "--format=json"]),
    );
    if (!verification.success) throw new Error("Rive verification failed");
    assertInspection(
      JSON.parse(command(binary, ["inspect", project, "--json"])),
    );
    if (args[0] === "verify")
      return console.log("Kuwi Rive project verified and inspected.");
    const built = JSON.parse(
      command(binary, [project, "--once", "--format=json"]),
    );
    if (!built.success) throw new Error("Rive build failed");
    const output = path.join(root, "public/brand/kuwi/rive");
    await mkdir(output, { recursive: true });
    const riv = readFileSync(path.join(root, project, "build/kuwi-auth.riv"));
    if (riv.subarray(0, 4).toString() !== "RIVE")
      throw new Error("Invalid Rive output header");
    const runtime = path.dirname(
      fileURLToPath(import.meta.resolve("@rive-app/canvas")),
    );
    const runtimePackage = JSON.parse(
      readFileSync(path.join(runtime, "package.json"), "utf8"),
    );
    if (runtimePackage.version !== contract.runtimeVersion)
      throw new Error("Rive runtime version does not match the asset contract");
    for (const [source, destination] of [
      [path.join(root, project, "build/kuwi-auth.riv"), "kuwi-auth.riv"],
      [
        path.join(runtime, "rive.wasm"),
        `runtime-${contract.runtimeVersion}.wasm`,
      ],
      [
        path.join(runtime, "rive_fallback.wasm"),
        `runtime-${contract.runtimeVersion}-fallback.wasm`,
      ],
    ]) {
      await copyFile(source, path.join(output, `${destination}.tmp`));
      await rename(
        path.join(output, `${destination}.tmp`),
        path.join(output, destination),
      );
    }
    console.log(
      "Verified and built Kuwi .riv and same-origin WASM assets. No publishing or account access used.",
    );
    return;
  }
  process.stdout.write(command(binary, args));
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
