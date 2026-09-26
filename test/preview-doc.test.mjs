import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviewDoc, sanitizeCss, sanitizeJs } from "../src/lib/forge/preview-doc.ts";

test("sanitizeCss escapes closing style tags case-insensitively", () => {
  const malformedCss = "body { color: red; } </style><script>alert('xss')</script>";
  const sanitized = sanitizeCss(malformedCss);
  assert.equal(sanitized.includes("</style"), false);
  assert.equal(sanitized.includes("</STYLE"), false);
  assert.equal(sanitized, "body { color: red; } \\3C/style><script>alert('xss')</script>");
});

test("sanitizeJs escapes closing script tags, script tags, and HTML comments case-insensitively", () => {
  const malformedJs = 'const x = "</SCRIPT><script>alert(1)</script><!-- comment -->";';
  const sanitized = sanitizeJs(malformedJs);
  assert.equal(sanitized.includes("</script"), false);
  assert.equal(sanitized.includes("</SCRIPT"), false);
  assert.equal(sanitized.includes("<script"), false);
  assert.equal(sanitized.includes("<!--"), false);
  assert.equal(
    sanitized,
    'const x = "\\x3c/script>\\x3cscript>alert(1)\\x3c/script>\\x3c!-- comment -->";',
  );
});

test("buildPreviewDoc safely handles replace dollar signs ($&, $', $1) without corrupting output", () => {
  const files = [
    {
      path: "index.html",
      content:
        '<html><head><script type="module" src="/src/main.js"></script></head><body></body></html>',
    },
    {
      path: "src/main.js",
      content: 'const val = "$100 $\' $& $1"; console.log(val);',
    },
    {
      path: "src/styles.css",
      content: "body { background: blue; }",
    },
  ];

  const doc = buildPreviewDoc(files);
  assert.equal(doc.includes('const val = "$100 $\' $& $1"; console.log(val);'), true);
  assert.equal(doc.includes("</head></html>"), false);
});

test("buildPreviewDoc supports main.jsx and index.html replacement or fallbacks", () => {
  const files = [
    {
      path: "index.html",
      content:
        '<html><head><script type="module" src="/src/main.jsx"></script></head><body><div id="root"></div></body></html>',
    },
    {
      path: "src/main.jsx",
      content: 'import React from "react";',
    },
    {
      path: "src/styles.css",
      content: "h1 { color: green; }",
    },
  ];

  const doc = buildPreviewDoc(files);
  assert.equal(doc.includes("<style>h1 { color: green; }</style>"), true);
  assert.equal(doc.includes('<script>import React from "react";</script>'), true);
  assert.equal(doc.includes('<div id="root"></div>'), true);
});

test("buildPreviewDoc generates default html structure if index.html is empty", () => {
  const files = [
    { path: "src/main.js", content: 'console.log("no index");' },
    { path: "src/styles.css", content: "body { margin: 0; }" },
  ];

  const doc = buildPreviewDoc(files);
  assert.equal(doc.includes("<!DOCTYPE html>"), true);
  assert.equal(doc.includes("<style>body { margin: 0; }</style>"), true);
  assert.equal(doc.includes('<script>console.log("no index");</script>'), true);
});
