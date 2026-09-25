/**
 * A small, tolerant CSV parser/formatter pair for cleaning up CSV files
 * that came out of some other tool (a spreadsheet export, a legacy system,
 * whatever) with inconsistent line endings, stray whitespace, or a BOM.
 *
 * The delimiter defaults to a comma but can be overridden (semicolon, tab,
 * whatever the source system used). It handles the handful of real-world
 * quirks that actually show up in the wild rather than aiming for a full
 * RFC 4180 implementation.
 */

/**
 * What to do with a row whose field count does not match the first row's:
 *  - "allow": leave it as-is (the old, and still default, behavior).
 *  - "pad": append empty fields until it matches. Never truncates a row
 *    that has too many fields, since that would silently drop data.
 *  - "reject": throw, naming the offending row and the expected width.
 */
export type RaggedRowMode = "allow" | "pad" | "reject";

export interface CsvOptions {
  /** Single-character field separator. Defaults to "," (comma). */
  delimiter?: string;
  /** How to handle rows whose width does not match the first row. Defaults to "allow". */
  raggedRows?: RaggedRowMode;
}

const DEFAULT_DELIMITER = ",";

function resolveDelimiter(options: CsvOptions): string {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  if (delimiter.length !== 1) {
    throw new Error(`csv delimiter must be a single character, got ${JSON.stringify(delimiter)}`);
  }
  if (delimiter === '"' || delimiter === "\n" || delimiter === "\r") {
    throw new Error(`csv delimiter cannot be a quote or line-ending character`);
  }
  return delimiter;
}

export function parseCsv(input: string, options: CsvOptions = {}): string[][] {
  const delimiter = resolveDelimiter(options);

  // Excel and friends like to prefix UTF-8 exports with a BOM.
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let fieldWasQuoted = false;
  let i = 0;
  const n = input.length;

  const pushField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          quoted = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    // A quote only opens a quoted field if nothing but whitespace has been
    // seen so far. That lets us discard the leading whitespace some
    // exporters put before a quoted field (e.g. `foo, "bar"`).
    if (ch === '"' && field.trim() === "" && !fieldWasQuoted) {
      quoted = true;
      fieldWasQuoted = true;
      field = "";
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      pushRow();
      // Treat \r\n as a single line break, not two.
      if (ch === "\r" && input[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    field += ch;
    i += 1;
  }

  // Only emit a final row if there's something left to emit. A trailing
  // newline should not produce a phantom empty row.
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}

function needsQuoting(field: string, delimiter: string): boolean {
  if (field.includes(delimiter) || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return true;
  }
  // A field with leading/trailing whitespace needs quotes on the way out,
  // otherwise parseCsv would trim it away on the next read.
  return field !== field.trim();
}

function formatField(field: string, delimiter: string): string {
  if (needsQuoting(field, delimiter)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function formatCsv(rows: string[][], options: CsvOptions = {}): string {
  const delimiter = resolveDelimiter(options);
  const body = rows.map((row) => row.map((field) => formatField(field, delimiter)).join(delimiter)).join("\n");
  return rows.length > 0 ? body + "\n" : "";
}

/**
 * The first row sets the expected width; everything else is measured
 * against it. There's no other reasonable baseline without reading the
 * whole file twice to find a mode or max.
 */
function applyRaggedRowMode(rows: string[][], mode: RaggedRowMode): string[][] {
  if (mode === "allow" || rows.length === 0) {
    return rows;
  }

  const width = rows[0].length;

  if (mode === "reject") {
    rows.forEach((row, index) => {
      if (row.length !== width) {
        throw new Error(
          `csv row ${index + 1} has ${row.length} field(s), expected ${width} (based on row 1)`,
        );
      }
    });
    return rows;
  }

  return rows.map((row) => (row.length < width ? [...row, ...new Array(width - row.length).fill("")] : row));
}

/**
 * Runs input through parseCsv and back through formatCsv, which is enough to
 * fix mixed line endings, a stray BOM, inconsistent quoting, and padding
 * whitespace around unquoted fields. Row/column shape is left alone unless
 * `raggedRows` says otherwise (the default is still to pass ragged rows
 * through untouched, since guessing the "right" width is a different,
 * riskier problem than reformatting).
 */
export function normalizeCsv(input: string, options: CsvOptions = {}): string {
  const rows = applyRaggedRowMode(parseCsv(input, options), options.raggedRows ?? "allow");
  return formatCsv(rows, options);
}
