const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");

// Run each dependency in a bounded child so an abort regression cannot hang CI.
if (process.argv[2] !== "--child") {
  const root = path.resolve(process.argv[2] || "apps/api");
  const localRequire = createRequire(path.join(root, "package.json"));
  const cliRequire = createRequire(
    localRequire.resolve("@nestjs/cli/package.json"),
  );
  const entry = cliRequire.resolve("glob");
  console.log("Nest resolves:", entry);
  console.log("Version:", cliRequire("glob/package.json").version);
  for (const [name, resolved] of [
    ["candidate", entry],
    ...(process.argv.includes("--baseline")
      ? [["baseline", localRequire.resolve("glob-baseline")]]
      : []),
  ]) {
    const run = spawnSync(
      process.execPath,
      ["--max-old-space-size=128", __filename, "--child", resolved, name],
      { encoding: "utf8", timeout: 10000 },
    );
    process.stdout.write(run.stdout || "");
    process.stderr.write(run.stderr || "");
    assert.ifError(run.error);
    assert.equal(run.status, 0, `${name} verification failed`);
  }
} else {
  const glob = require(process.argv[3]);
  const baseline = process.argv[4] === "baseline";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mordida-glob-"));
  const files = [
    "a.txt",
    ".hidden.txt",
    "space dir/b.txt",
    "space dir/c.json",
    "deep/sub/d.txt",
    "excluded/x.txt",
  ];
  async function verify() {
    for (const file of files) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file);
    }
    fs.mkdirSync(path.join(root, "empty"));
    const normalize = (values) =>
      values.map((p) => p.replaceAll("\\", "/")).sort();
    const expected = [
      ".hidden.txt",
      "a.txt",
      "deep/sub/d.txt",
      "space dir/b.txt",
    ];
    assert.deepEqual(
      normalize(
        glob.sync("**/*.txt", {
          cwd: root,
          dot: true,
          ignore: "excluded/**",
        }),
      ),
      expected,
    );
    const prefix = root.replaceAll("\\", "/");
    assert.deepEqual(
      normalize(
        glob.sync(`${prefix}/**/*.txt`, {
          dot: true,
          ignore: `${prefix}/excluded/**`,
        }),
      ),
      expected.map((p) => `${prefix}/${p}`),
    );
    assert.deepEqual(glob.sync("missing/**/*.txt", { cwd: root }), []);
    assert.deepEqual(normalize(glob.sync("**/*.json", { cwd: root })), [
      "space dir/c.json",
    ]);
    const controller = new AbortController();
    const reason = new Error("bounded-glob-probe");
    let reads = 0;
    const instrumented = {
      ...fs,
      readdir(...args) {
        reads++;
        const callback = args.pop();
        fs.readdir(...args, (err, entries) => {
          if (!controller.signal.aborted) controller.abort(reason);
          callback(err, entries);
        });
      },
    };
    await assert.rejects(
      glob.glob("**/*", {
        cwd: root,
        fs: instrumented,
        signal: controller.signal,
      }),
      (err) => err === reason,
    );
    const atReject = reads;
    await new Promise((resolve) => setTimeout(resolve, 200));
    console.log(
      JSON.stringify({
        baseline,
        compatibilityCases: 4,
        reads,
        atReject,
        readsAfterReject: reads - atReject,
      }),
    );
    if (baseline)
      assert.ok(reads > 1, "Baseline did not reproduce continued traversal");
    else assert.equal(reads, 1, "Traversal continued after cancellation");
  }
  verify()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => fs.rmSync(root, { recursive: true, force: true }));
}
