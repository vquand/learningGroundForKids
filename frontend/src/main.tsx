import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getUiLanguage, initializeUiLanguage } from "./lib/uiLanguage";
import { loadUiLanguage } from "./i18n/uiText";
import { App } from "./App";
import "./app.css";
import { installChunkLoadRecovery } from "./chunkLoadRecovery";

(
  window as typeof window & {
    CESIUM_BASE_URL?: string;
  }
).CESIUM_BASE_URL = "/cesium";

let sessionStorage: Storage | undefined;
try {
  sessionStorage = window.sessionStorage;
} catch {
  // Continue without persistence in privacy modes that block sessionStorage.
}
installChunkLoadRecovery({
  window,
  storage: sessionStorage,
  reload: () => window.location.reload(),
});

async function bootstrap() {
  initializeUiLanguage();
  try {
    await loadUiLanguage(getUiLanguage());
  } catch (error) {
    console.error("Failed to load the interface language catalog; using English fallback.", error);
  } finally {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

void bootstrap();
