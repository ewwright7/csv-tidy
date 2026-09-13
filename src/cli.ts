/**
 * Command-line entry point: normalize one or more CSV files in place.
 *
 * Deliberately skips files that are already clean (no write, no mtime churn)
 * so running this over a directory of files you're not sure about doesn't
 * touch the ones that don't need it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { normalizeCsv } from "./normalize.ts";

function main(argv: string[]): number {
  const paths = argv.slice(2);
  if (paths.length === 0) {
    console.error("usage: csv-tidy <file.csv> [file2.csv ...]");
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

    const output = normalizeCsv(input);
    if (output !== input) {
      writeFileSync(path, output, "utf8");
    }
  }

  return hadError ? 1 : 0;
}

process.exitCode = main(process.argv);
