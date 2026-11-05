import { GoogleParentSetup } from "./GoogleAuth/GoogleParentSetup";
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useFamilyStore } from "../stores/familyStore";
import { BackendGate } from "./BackendGate";

export function FamilyGate({ children }: { children: ReactNode }) {
  useUiLanguage();
  const session = useFamilyStore((s) => s.session);
  const isInitializing = useFamilyStore((s) => s.isInitializing);

  if (isInitializing) {
    return <FamilyInitializingScreen />;
  }

  if (!session) return <Navigate replace to="/login" />;
  if (session.parentPasswordRequired) return <GoogleParentSetup />;
  return <BackendGate>{children}</BackendGate>;
}

export function FamilyInitializingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <span className="text-5xl">🗺️</span>
        <p className="text-lg text-gray-400 font-semibold">{uiText("Loading...")}</p>
      </div>
    </div>
  );
}
