import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCsv, normalizeCsv, parseCsv } from "./normalize.ts";

// Table-driven: each case is a name plus an input/expected pair. Add new
// rows here as new real-world CSV quirks turn up.
const normalizeCases: Array<{ name: string; input: string; expected: string }> = [
  {
    name: "plain unquoted fields",
    input: "a,b,c\n",
    expected: "a,b,c\n",
  },
  {
    name: "empty input produces empty output",
    input: "",
    expected: "",
  },
  {
    name: "trailing newline does not create a phantom row",
    input: "a,b\nc,d\n",
    expected: "a,b\nc,d\n",
  },
  {
    name: "missing trailing newline still parses the last row",
    input: "a,b\nc,d",
    expected: "a,b\nc,d\n",
  },
  {
    name: "CRLF line endings are normalized to LF",
    input: "a,b\r\nc,d\r\n",
    expected: "a,b\nc,d\n",
  },
  {
    name: "lone CR line endings are normalized to LF",
    input: "a,b\rc,d\r",
    expected: "a,b\nc,d\n",
  },
  {
    name: "leading BOM is stripped",
    input: "﻿a,b\n",
    expected: "a,b\n",
  },
  {
    name: "whitespace around unquoted fields is trimmed",
    input: " a ,  b  , c\n",
    expected: "a,b,c\n",
  },
  {
    name: "whitespace inside a quoted field is preserved",
    input: 'a," b ",c\n',
    expected: 'a," b ",c\n',
  },
  {
    name: "quoted field containing a comma round-trips",
    input: 'name,"Smith, John"\n',
    expected: 'name,"Smith, John"\n',
  },
  {
    name: "quoted field containing an embedded newline round-trips",
    input: 'a,"line one\nline two"\n',
    expected: 'a,"line one\nline two"\n',
  },
  {
    name: "doubled quotes inside a quoted field are unescaped and re-escaped",
    input: 'a,"say ""hi"" now"\n',
    expected: 'a,"say ""hi"" now"\n',
  },
  {
    name: "a field that is just an empty quoted string becomes an empty field",
    input: 'a,"",c\n',
    expected: "a,,c\n",
  },
  {
    name: "an empty line in the middle becomes a single-empty-field row",
    input: "a,b\n\nc,d\n",
    expected: "a,b\n\nc,d\n",
  },
  {
    name: "a file that is a single blank line stays a single blank line",
    input: "\n",
    expected: "\n",
  },
  {
    name: "ragged rows are left ragged, not padded",
    input: "a,b,c\nd,e\n",
    expected: "a,b,c\nd,e\n",
  },
  {
    name: "leading whitespace before an opening quote is discarded",
    input: 'a,  "quoted",c\n',
    expected: "a,quoted,c\n",
  },
];

for (const { name, input, expected } of normalizeCases) {
  test(`normalizeCsv: ${name}`, () => {
    assert.equal(normalizeCsv(input), expected);
  });
}

test("parseCsv splits a simple row into fields", () => {
  assert.deepEqual(parseCsv("a,b,c\n"), [["a", "b", "c"]]);
});

test("parseCsv keeps a comma inside quotes as part of the field", () => {
  assert.deepEqual(parseCsv('"a,b",c\n'), [["a,b", "c"]]);
});

test("normalizeCsv is idempotent on already-clean input", () => {
  const clean = "id,name,note\n1,Ann,\"hi, there\"\n2,Bo,plain\n";
  assert.equal(normalizeCsv(clean), normalizeCsv(normalizeCsv(clean)));
});

test("semicolon delimiter parses and formats fields", () => {
  const input = " a ; b ;c\n";
  assert.equal(normalizeCsv(input, { delimiter: ";" }), "a;b;c\n");
});

test("tab delimiter parses and formats fields", () => {
  const input = "a\tb\tc\n";
  assert.equal(normalizeCsv(input, { delimiter: "\t" }), "a\tb\tc\n");
});

test("a comma is left unquoted under a semicolon delimiter", () => {
  assert.equal(normalizeCsv("Smith, John;ok\n", { delimiter: ";" }), "Smith, John;ok\n");
});

test("a field containing the active delimiter is quoted on output", () => {
  assert.equal(formatCsv([["a;b", "c"]], { delimiter: ";" }), '"a;b";c\n');
});

test("parseCsv with a non-comma delimiter keeps commas inside fields", () => {
  assert.deepEqual(parseCsv("a,b;c\n", { delimiter: ";" }), [["a,b", "c"]]);
});

test("a multi-character delimiter is rejected", () => {
  assert.throws(() => normalizeCsv("a,b\n", { delimiter: ",," }), /single character/);
});

test("a quote character cannot be used as the delimiter", () => {
  assert.throws(() => normalizeCsv("a,b\n", { delimiter: '"' }), /quote or line-ending/);
});
