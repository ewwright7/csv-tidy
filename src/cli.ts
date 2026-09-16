/**
 * Command-line entry point: normalize one or more CSV files in place.
 *
 * Deliberately skips files that are already clean (no write, no mtime churn)
 * so running this over a directory of files you're not sure about doesn't
 * touch the ones that don't need it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { normalizeCsv } from "./normalize.ts";

const USAGE = "usage: csv-tidy [--delimiter <char>] <file.csv> [file2.csv ...]";

function parseArgs(argv: string[]): { delimiter?: string; paths: string[] } | { error: string } {
  const args = argv.slice(2);
  let delimiter: string | undefined;
  const paths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--delimiter" || arg === "-d") {
      const value = args[i + 1];
      if (value === undefined) {
        return { error: "csv-tidy: --delimiter requires a value" };
      }
      delimiter = value;
      i += 1;
      continue;
    }
    paths.push(arg);
  }

  return { delimiter, paths };
}

function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(parsed.error);
    return 1;
  }

  const { delimiter, paths } = parsed;
  if (paths.length === 0) {
    console.error(USAGE);
    return 1;
  }

  let hadError = false;

  for (const path of paths) {
    let input: string;
    try {
      input = readFileSync(path, "utf8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`csv-tidy: ${path}: ${message}`);
      hadError = true;
      continue;
    }

    let output: string;
    try {
      output = normalizeCsv(input, { delimiter });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`csv-tidy: ${path}: ${message}`);
      hadError = true;
      continue;
    }

    if (output !== input) {
      writeFileSync(path, output, "utf8");
    }
  }

  return hadError ? 1 : 0;
}

process.exitCode = main(process.argv);
