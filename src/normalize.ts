/**
 * A small, tolerant CSV parser/formatter pair for cleaning up CSV files
 * that came out of some other tool (a spreadsheet export, a legacy system,
 * whatever) with inconsistent line endings, stray whitespace, or a BOM.
 *
 * This is deliberately not a full RFC 4180 implementation with configurable
 * delimiters. It assumes commas and handles the handful of real-world quirks
 * that actually show up in the wild.
 */

export function parseCsv(input: string): string[][] {
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

    if (ch === ",") {
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

function needsQuoting(field: string): boolean {
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return true;
  }
  // A field with leading/trailing whitespace needs quotes on the way out,
  // otherwise parseCsv would trim it away on the next read.
  return field !== field.trim();
}

function formatField(field: string): string {
  if (needsQuoting(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function formatCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(formatField).join(",")).join("\n");
  return rows.length > 0 ? body + "\n" : "";
}

/**
 * Runs input through parseCsv and back through formatCsv, which is enough to
 * fix mixed line endings, a stray BOM, inconsistent quoting, and padding
 * whitespace around unquoted fields. It does not touch row/column shape
 * (ragged rows are left ragged) since guessing the "right" width is a
 * different, riskier problem.
 */
export function normalizeCsv(input: string): string {
  return formatCsv(parseCsv(input));
}
