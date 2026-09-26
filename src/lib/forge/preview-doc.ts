export interface SourceFile {
  path: string;
  content: string;
}

export function sanitizeCss(css: string): string {
  return css.replace(/<\/style/gi, "\\3C/style");
}

export function sanitizeJs(js: string): string {
  return js
    .replace(/<\/script/gi, "\\x3c/script")
    .replace(/<!--/g, "\\x3c!--")
    .replace(/<script/gi, "\\x3cscript");
}

export function buildPreviewDoc(files: SourceFile[]): string {
  const index = files.find((f) => f.path === "index.html")?.content ?? "";

  const mainFile = files.find(
    (f) =>
      /^(?:src\/)?(?:main|index)\.[jt]sx?$/i.test(f.path) ||
      f.path === "main.js" ||
      f.path === "main.jsx",
  );
  const main = mainFile?.content ?? "";

  const cssFile = files.find(
    (f) => /^(?:src\/)?(?:styles?|index)\.css$/i.test(f.path) || f.path === "styles.css",
  );
  const css = cssFile?.content ?? "";

  const safeCss = sanitizeCss(css);
  const safeMain = sanitizeJs(main);

  const injected = `<style>${safeCss}</style><script>${safeMain}</script>`;

  if (!index.trim()) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview</title>${injected}</head><body></body></html>`;
  }

  const scriptRegex =
    /<script\b[^>]*\bsrc=["']\/?(?:src\/)?[^"'\s]+\.[jt]sx?["'][^>]*>\s*<\/script>/i;
  if (scriptRegex.test(index)) {
    return index.replace(scriptRegex, () => injected);
  } else if (/<\/head>/i.test(index)) {
    return index.replace(/<\/head>/i, () => `${injected}</head>`);
  } else if (/<\/body>/i.test(index)) {
    return index.replace(/<\/body>/i, () => `${injected}</body>`);
  } else {
    return index + injected;
  }
}
