import { defineConfig, loadEnv, type ConfigEnv, type Plugin, type UserConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { prepareArtworkBuild } from './scripts/artwork-catalog.mjs';

const LOCAL_D1_ID = "00000000-0000-4000-8000-000000000000";
export const SITES_RUN_WORKER_FIRST = ["/api/*", "/media/*"] as const;
export const VERCEL_OUTPUT_DIRECTORY = "dist/client";
export const DEFAULT_LOCAL_API_ORIGIN = "http://127.0.0.1:10000";

export function createAppTitlePlugin(appName?: string): Plugin {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  const title = (appName?.trim() || "Playing Ground").replace(/[&<>"']/g, (character) => entities[character]!);
  return {
    name: "app-title",
    transformIndexHtml(html) {
      return html.replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`);
    },
  };
}

// Copy Cesium assets after build
const cesiumCopyPlugin = {
  name: "cesium-copy",
  apply: "build" as const,
  writeBundle() {
    const srcBase = path.join(process.cwd(), "node_modules/cesium/Build/Cesium");
    const destBase = path.join(
      process.cwd(),
      VERCEL_OUTPUT_DIRECTORY,
      "cesium",
    );

    // Ensure dest exists
    fs.mkdirSync(destBase, { recursive: true });

    // Copy each directory
    const dirs = ["Workers", "Assets", "ThirdParty", "Widgets"];
    for (const dir of dirs) {
      const src = path.join(srcBase, dir);
      const dest = path.join(destBase, dir);

      if (fs.existsSync(src)) {
        fs.rmSync(dest, { recursive: true, force: true });
        // Recursively copy directory
        const copy = (src: string, dest: string) => {
          fs.mkdirSync(dest, { recursive: true });
          for (const file of fs.readdirSync(src)) {
            const srcFile = path.join(src, file);
            const destFile = path.join(dest, file);
            if (fs.statSync(srcFile).isDirectory()) {
              copy(srcFile, destFile);
            } else {
              fs.copyFileSync(srcFile, destFile);
            }
          }
        };
        copy(src, dest);
      }
    }
  },
};

const cesiumDevAssetsPlugin = {
  name: "cesium-dev-assets",
  apply: "serve" as const,
  configureServer(server: ViteDevServer) {
    const assetRoot = path.resolve(process.cwd(), "node_modules/cesium/Build/Cesium");
    const contentTypes: Record<string, string> = {
      ".css": "text/css",
      ".glb": "model/gltf-binary",
      ".json": "application/json",
      ".js": "text/javascript",
      ".svg": "image/svg+xml",
      ".wasm": "application/wasm",
      ".xml": "application/xml",
    };

    server.middlewares.use("/cesium", (request, response, next) => {
      const requestPath = decodeURIComponent((request.url ?? "").split("?", 1)[0] ?? "");
      const assetPath = path.resolve(assetRoot, `.${requestPath}`);
      if (!assetPath.startsWith(`${assetRoot}${path.sep}`) || !fs.existsSync(assetPath)) {
        next();
        return;
      }

      const extension = path.extname(assetPath).toLowerCase();
      response.statusCode = 200;
      response.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream");
      fs.createReadStream(assetPath).on("error", next).pipe(response);
    });
  },
};

export async function createViteConfig({
  command,
  mode,
}: ConfigEnv): Promise<UserConfig> {
  if (mode === "vercel") {
    const env = loadEnv(mode, process.cwd(), "");
    const localApiOrigin = env.LOCAL_API_ORIGIN || DEFAULT_LOCAL_API_ORIGIN;
    return {
      plugins: [react(), createAppTitlePlugin(env.APP_NAME), cesiumDevAssetsPlugin, cesiumCopyPlugin, {
        name: 'private-artwork-output',
        apply: 'build',
        async closeBundle() { await prepareArtworkBuild(path.resolve(VERCEL_OUTPUT_DIRECTORY), env); },
      }],
      server: {
        proxy: {
          "/api": { target: localApiOrigin, changeOrigin: false },
          "/media": { target: localApiOrigin, changeOrigin: false },
        },
      },
      build: {
        outDir: VERCEL_OUTPUT_DIRECTORY,
      },
    };
  }

  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const env = loadEnv(mode, process.cwd(), "");
  const [{ sites }, { cloudflare }] = await Promise.all([
    import("@openai/sites-vite-plugin"),
    import("@cloudflare/vite-plugin"),
  ]);
  const hostingConfig = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), ".openai/hosting.json"), "utf8"),
  ) as { d1?: string; r2?: string };

  const localBindingConfig = {
    main: "./worker/index.ts",
    compatibility_date: "2026-05-22",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: hostingConfig.d1
      ? [{
          binding: hostingConfig.d1,
          database_name: "personal-learning-ground-d1",
          database_id: LOCAL_D1_ID,
        }]
      : [],
    r2_buckets: hostingConfig.r2
      ? [{
          binding: hostingConfig.r2,
          bucket_name: "personal-learning-ground-media",
        }]
      : [],
    assets: {
      not_found_handling: "single-page-application" as const,
      run_worker_first: [...SITES_RUN_WORKER_FIRST],
    },
    vars: command === "serve"
      ? {
          API_ORIGIN: env.VITE_API_ORIGIN || "http://127.0.0.1:8001",
        }
      : undefined,
  };

  return {
    plugins: [
      react(),
      createAppTitlePlugin(env.APP_NAME),
      cesiumDevAssetsPlugin,
      cesiumCopyPlugin,
      sites(),
      cloudflare({
        viteEnvironment: { name: "server" },
        config: localBindingConfig,
      }),
    ],
  };
}

export default defineConfig(createViteConfig);
