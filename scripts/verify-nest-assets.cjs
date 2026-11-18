const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");

const dependencyRoot = path.resolve(process.argv[2] || "apps/api");
const localRequire = createRequire(path.join(dependencyRoot, "package.json"));
const cliManifest = localRequire.resolve("@nestjs/cli/package.json");
const cliRequire = createRequire(cliManifest);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mordida-nest-assets-"));
const inputs = {
  "assets/.hidden.txt": "hidden",
  "assets/space dir/template.txt": "template",
  "assets/deep/sub/data.json": '{"ok":true}',
  "assets/excluded/secret.txt": "excluded fixture, not a real secret",
  "single.txt": "single file",
  "directory/child/data.txt": "directory selection",
};
async function verify() {
  try {
    for (const [file, value] of Object.entries(inputs)) {
      const target = path.join(root, "src", file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, value);
    }
    fs.mkdirSync(path.join(root, "src/assets/empty"));
    fs.writeFileSync(
      path.join(root, "src/main.ts"),
      "export const ok: boolean = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          outDir: "./dist",
          types: [],
        },
        include: ["src/**/*.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "nest-cli.json"),
      JSON.stringify({
        sourceRoot: "src",
        compilerOptions: {
          assets: [
            { include: "assets/**/*", exclude: "assets/excluded/**" },
            "single.txt",
            "directory/**/*",
            "missing/**/*.txt",
          ],
        },
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.join(path.dirname(cliManifest), "bin/nest.js"), "build"],
      { cwd: root, encoding: "utf8", timeout: 60000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const expected = Object.keys(inputs)
      .filter((file) => !file.includes("/excluded/"))
      .sort();
    for (const file of expected) {
      assert.equal(
        fs.readFileSync(path.join(root, "dist", file), "utf8"),
        inputs[file],
      );
    }
    const copied = fs
      .readdirSync(path.join(root, "dist"), { recursive: true })
      .filter((file) => fs.statSync(path.join(root, "dist", file)).isFile())
      .map((file) => file.replaceAll("\\", "/"))
      .sort();
    assert.deepEqual(copied, [...expected, "main.js"].sort());
    const { AssetsManager } = cliRequire("./lib/compiler/assets-manager");
    const manager = new AssetsManager();
    const cwd = process.cwd();
    const source = path.join(root, "src/single.txt");
    const output = path.join(root, "watch/single.txt");
    async function waitFor(check) {
      const deadline = Date.now() + 5000;
      while (!check()) {
        assert.ok(Date.now() < deadline, "Asset watcher timed out");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    try {
      process.chdir(root);
      manager.copyAssets(
        {
          sourceRoot: "src",
          compilerOptions: {
            assets: ["single.txt"],
          },
        },
        undefined,
        path.join(root, "watch"),
        true,
      );
      await waitFor(() => fs.existsSync(output));
      fs.writeFileSync(source, "changed");
      await waitFor(() => fs.readFileSync(output, "utf8") === "changed");
      fs.unlinkSync(source);
      await waitFor(() => !fs.existsSync(output));
    } finally {
      await Promise.all(manager.watchers.map((watcher) => watcher.close()));
      process.chdir(cwd);
    }
    console.log(
      JSON.stringify({
        glob: cliRequire("glob/package.json").version,
        compiled: true,
        copiedAssets: expected,
        excludedAbsent: true,
        watcher: "initial copy, change, unlink, close passed",
      }),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
