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

test("cli normalizes with a custom delimiter", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "messy.csv");
  writeFileSync(file, " a ; b \r\nc;d", "utf8");

  try {
    const result = runCli(["--delimiter", ";", file]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, "utf8"), "a;b\nc;d\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error for an invalid delimiter", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "messy.csv");
  writeFileSync(file, "a,b\n", "utf8");

  try {
    const result = runCli(["--delimiter", ",,", file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /csv-tidy:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error when --delimiter is missing its value", () => {
  const result = runCli(["--delimiter"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--delimiter requires a value/);
});

test("cli pads ragged rows when --ragged-rows pad is given", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "ragged.csv");
  writeFileSync(file, "a,b,c\nd,e\n", "utf8");

  try {
    const result = runCli(["--ragged-rows", "pad", file]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, "utf8"), "a,b,c\nd,e,\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error and leaves the file untouched when --ragged-rows reject finds a ragged row", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "ragged.csv");
  const before = "a,b,c\nd,e\n";
  writeFileSync(file, before, "utf8");

  try {
    const result = runCli(["--ragged-rows", "reject", file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /row 2 has 2 field\(s\), expected 3/);
    assert.equal(readFileSync(file, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error for an invalid --ragged-rows value", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-tidy-"));
  const file = join(dir, "clean.csv");
  writeFileSync(file, "a,b\n", "utf8");

  try {
    const result = runCli(["--ragged-rows", "bogus", file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--ragged-rows must be one of/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli reports an error when --ragged-rows is missing its value", () => {
  const result = runCli(["--ragged-rows"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--ragged-rows requires a value/);
});
