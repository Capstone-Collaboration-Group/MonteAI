// Offline React runtime only. No dependencies are installed and no browser,
// Firebase SDK, camera, development server, or real environment file is opened.
import { existsSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../../../", import.meta.url);
const requireRoot = createRequire(new URL("package.json", root));
const mocks = new URL("./web-runtime-mocks.mjs", import.meta.url).href;
const router = new URL("./web-router-boundary.mjs", import.meta.url).href;
const dom = new URL("./web-dom-boundary.mjs", import.meta.url).href;
const ui = new URL("./web-ui-entries.mjs", import.meta.url).href;
const web = new URL("apps/web/src/", root).href;
const workspaceSource = url => url.startsWith(root.href) && !url.includes("/node_modules/");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__MONTEAI_WEB_TEST_ENV__ = {
  VITE_USE_MOCK: "false",
  VITE_API_BASE_URL: "https://api.example.test/api/v1",
  VITE_ID_VERIFICATION_ENDPOINT: "https://idv.example.test/api/v1/id-verification",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("real:")) {
      return { url: pathToFileURL(requireRoot.resolve(specifier.slice(5))).href, shortCircuit: true };
    }
    // The installed renderer and root/native React are both 19.1.0. Web's
    // 19.2.7 is still checked by its actual build; do not mix React runtimes.
    if (specifier === "react" || specifier.startsWith("react/") || specifier === "react-test-renderer") {
      return { url: pathToFileURL(requireRoot.resolve(specifier)).href, shortCircuit: true };
    }
    if (specifier === "firebase/auth" || specifier === "firebase/app") return { url: mocks, shortCircuit: true };
    if (specifier === "react-dom") return { url: dom, shortCircuit: true };
    if (specifier === "react-router-dom") return { url: router, shortCircuit: true };
    if (specifier === "@monteai/ui") return { url: ui, shortCircuit: true };
    if (specifier === "@monteai/hooks") return { url: new URL("packages/hooks/src/index.ts", root).href, shortCircuit: true };
    if (/\.(?:svg|png|jpe?g|webp|css)$/.test(specifier) && context.parentURL && workspaceSource(context.parentURL)) {
      return { url: 'data:text/javascript,export default "synthetic-static-asset"', shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL && workspaceSource(context.parentURL)) {
      const url = new URL(specifier, context.parentURL);
      const canonical = new URL(url); canonical.search = "";
      const candidates = /\.tsx?$/.test(canonical.pathname) ? [canonical]
        : [".ts", ".tsx", "/index.ts"].map(suffix => new URL(canonical.href + suffix));
      for (const candidate of candidates) {
        if (!existsSync(fileURLToPath(candidate))) continue;
        candidate.search = url.search;
        // Fresh service/client singletons for configuration/restore regressions.
        // This query is a synthetic sequence number, NEVER a receipt or payload.
        const testCase = new URL(context.parentURL).searchParams.get("testCase");
        if (testCase && candidate.href.startsWith(web)) candidate.searchParams.set("testCase", testCase);
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const canonical = new URL(url); canonical.search = "";
    const path = canonical.href;
    if (path.startsWith(web) && (path === web + "components/layouts/AppLayout.tsx" ||
      path.startsWith(web + "pages/") && path !== web + "pages/Register.tsx")) {
      // Only unrelated page/layout content is replaced. The actual App route
      // tree, signup route, pending gate, ProtectedRoute, and profile hook run.
      const name = canonical.pathname.split("/").at(-1).replace(/\.tsx$/, "");
      return { format: "module", shortCircuit: true, source:
        `import React, { useEffect } from "react"; import { Outlet } from "react-router-dom"; import { runtime } from ${JSON.stringify(mocks)};
         export default function UnrelatedPageBoundary() { useEffect(() => { runtime.unrelatedMounts++; }, []);
         return React.createElement("div", { "data-test-page": ${JSON.stringify(name)} }, ${name === "AppLayout" ? "React.createElement(Outlet)" : JSON.stringify(name)}); }` };
    }
    const result = nextLoad(path, context);
    if (workspaceSource(path) && path.startsWith(web) && typeof result.source === "string") {
      return { ...result, source: result.source.replace(/\bimport\.meta\.env\b/g, "globalThis.__MONTEAI_WEB_TEST_ENV__") };
    }
    return result;
  },
});
