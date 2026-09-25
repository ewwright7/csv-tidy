# csv-tidy

CSV files that come out of spreadsheets, legacy exports, or hand-edited data
tend to be technically valid but inconsistent: some rows end in `\r\n`, some
in bare `\n`, some editor left a BOM at the top of the file, a few fields have
stray leading/trailing spaces, and quoting is applied here and there but not
consistently. None of that breaks a naive comma-split, but it makes diffs
noisy and downstream parsers unpredictable.

`csv-tidy` parses that mess into rows of fields and re-serializes it in one
consistent form: LF line endings, no BOM, unquoted fields trimmed, and quotes
applied only where a field actually needs them (it contains a comma, a quote,
a newline, or leading/trailing whitespace that would otherwise be lost).

By default it does not try to fix row/column shape. A row with the wrong
number of fields is a data problem, not a formatting problem, so ragged rows
are left ragged unless you ask otherwise via `raggedRows`:

```ts
normalizeCsv("a,b,c\nd,e\n", { raggedRows: "pad" });
// a,b,c
// d,e,

normalizeCsv("a,b,c\nd,e\n", { raggedRows: "reject" });
// throws: csv row 2 has 2 field(s), expected 3 (based on row 1)
```

The first row sets the expected width. `"pad"` appends empty fields to short
rows but never truncates a row that has too many (that would silently drop
data). `"reject"` throws on the first mismatch. The default, `"allow"`,
passes ragged rows through untouched.

## Usage

```ts
import { normalizeCsv } from "./src/normalize.ts";

const messy = ' id, name ,note\r\n1,"Smith, Jane",ok\r\n2,Bo,"line one\nline two"\r\n';

console.log(normalizeCsv(messy));
// id,name,note
// 1,"Smith, Jane",ok
// 2,Bo,"line one
// line two"
```

`parseCsv` and `formatCsv` are also exported separately if you want the
in-memory rows (`string[][]`) rather than a re-serialized string.

The delimiter defaults to a comma but can be overridden for semicolon- or
tab-separated files:

```ts
normalizeCsv("a;b;c\n", { delimiter: ";" });
normalizeCsv("a\tb\tc\n", { delimiter: "\t" });
```

The delimiter must be a single character and cannot be a quote or a line
ending; passing anything else throws.

## CLI

`src/cli.ts` normalizes one or more files in place:

```
node --experimental-strip-types src/cli.ts messy.csv other.csv
```

Pass `--delimiter` (or `-d`) to normalize a file that uses a different field
separator:

```
node --experimental-strip-types src/cli.ts --delimiter ";" messy.csv
```

Pass `--ragged-rows` with `allow` (the default), `pad`, or `reject` to
control what happens to rows whose width doesn't match the first row:

```
node --experimental-strip-types src/cli.ts --ragged-rows reject messy.csv
```

Files that are already in canonical form are left untouched (no write, no
mtime change). A file that fails to read is reported on stderr and the
process exits nonzero, but the remaining files in the argument list are
still processed.

## Running the tests

The test suite uses Node's built-in test runner and TypeScript's type
stripping, so there is nothing to install:

```
node --experimental-strip-types --test src/*.test.ts
```

(Node 23.6+ can drop the flag; the `test` script in `package.json` includes
it for older 22.x/23.x releases.)

The suite in `src/normalize.test.ts` is table-driven: each row is a
name/input/expected-output triple covering one specific quirk (CRLF vs LF,
a lone CR, a BOM, embedded newlines and commas inside quotes, doubled quote
escapes, ragged rows, blank lines, and so on). Add a new row there whenever a
new kind of messy input shows up.
