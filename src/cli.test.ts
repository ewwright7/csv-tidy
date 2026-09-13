import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliPath = join(import.meta.dirname, "cli.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    encoding: "utf8",
  });
}

test("cli normalizes a file in place", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "messy.csv");
  writeFileSync(file, " a , b \r\nc,d", "utf8");

  try {
    const result = runCli([file]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, "utf8"), "a,b\nc,d\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli leaves an already-clean file untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "clean.csv");
  writeFileSync(file, "a,b\nc,d\n", "utf8");
  const before = readFileSync(file, "utf8");

  try {
    const result = runCli([file]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error and a nonzero exit for a missing file", () => {
  const result = runCli(["/no/such/file.csv"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /csv-tidy:/);
});

test("cli exits nonzero and prints usage when given no files", () => {
  const result = runCli([]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage:/);
});
