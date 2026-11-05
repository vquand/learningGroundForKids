import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, type ReactNode } from "react";
import { AdminLoginPage } from "../../pages/admin/AdminLoginPage";
import { useAdminStore } from "../../stores/adminStore";
import { useFamilyStore } from "../../stores/familyStore";

export function AdminGate({ children }: { children: ReactNode }) {
  useUiLanguage();
  const access = useAdminStore((s) => s.access);
  const verifiedSessionGeneration = useAdminStore((s) => s.verifiedSessionGeneration);
  const refresh = useAdminStore((s) => s.refresh);
  const sessionGeneration = useFamilyStore((s) => s.sessionGeneration);
  const session = useFamilyStore((s) => s.session);
  const isInitializing = useFamilyStore((s) => s.isInitializing);
  useEffect(() => {
    if (!isInitializing && session) void refresh();
  }, [refresh, sessionGeneration, session, isInitializing]);

  if (isInitializing) return <p role="status" className="p-8 text-center text-gray-600">{uiText("Loading session...")}</p>;
  if (!session) return <AdminLoginPage />;
  if (access === "checking" || (access === "admin" && verifiedSessionGeneration !== sessionGeneration)) {
    return <p role="status" className="p-8 text-center text-gray-600">{uiText("Checking administrator access...")}</p>;
  }
  if (access === "error") {
    return <AdminLoginPage accessCheckFailed onRetryAccess={() => void refresh()} />;
  }
  if (access !== "admin") return <AdminLoginPage accountHasNoAccess={access === "forbidden"} />;
  return <>{children}</>;
}
