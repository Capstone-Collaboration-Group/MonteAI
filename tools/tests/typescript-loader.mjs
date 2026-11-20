// Test-only, in-memory transpilation. Node >=22.15; no generated JS or added dependencies.
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const entries = new Map([
  ["@monteai/api", new URL("packages/api/index.ts", root).href],
  ["@monteai/utils", new URL("packages/utils/src/index.ts", root).href],
  ["@monteai/types", new URL("packages/types/src/index.ts", root).href],
]);

function workspaceSource(url) {
  return url.startsWith(root.href) && !url.includes("/node_modules/");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const entry = entries.get(specifier);
    if (entry) return { url: entry, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL && workspaceSource(context.parentURL)) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(url.href + suffix);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (workspaceSource(url) && /\.tsx?$/.test(url)) {
      const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          verbatimModuleSyntax: true,
        },
        fileName: fileURLToPath(url),
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
