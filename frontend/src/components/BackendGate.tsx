import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchBackendHealth } from "../api/backend";

interface BackendGateProps {
  children: ReactNode;
}

type ConnectionState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

export function BackendGate({ children }: BackendGateProps) {
  useUiLanguage();
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>({ status: "checking" });

  const checkConnection = useCallback(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);

    setConnection({ status: "checking" });
    void fetchBackendHealth(controller.signal)
      .then(() => setConnection({ status: "connected" }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "The learning server is unavailable.";
        setConnection({ status: "error", message });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => checkConnection(), [attempt, checkConnection]);

  if (connection.status === "connected") return <>{children}</>;

  const isChecking = connection.status === "checking";
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <section
        className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"
        aria-live="polite"
        aria-busy={isChecking}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-4xl">
          {isChecking ? "🗺️" : "🔌"}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">
          {isChecking ? uiText("Connecting to your learning server…") : uiText("Learning server unavailable")}
        </h1>
        <p className="mt-3 text-gray-500">
          {isChecking
            ? uiText("Checking the native learning service before loading the app.")
            : connection.message}
        </p>
        {!isChecking && (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-6 min-h-12 rounded-xl bg-blue-500 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            {uiText("Try again")}</button>
        )}
      </section>
    </main>
  );
}
