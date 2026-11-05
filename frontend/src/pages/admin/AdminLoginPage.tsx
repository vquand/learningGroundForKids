import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminLogin } from "../../api/admin";
import { useAdminStore } from "../../stores/adminStore";
import { useFamilyStore } from "../../stores/familyStore";
import { PasswordInput } from "../../components/PasswordInput";

export function AdminLoginPage({ accountHasNoAccess = false, accessCheckFailed = false, onRetryAccess }: {
  accountHasNoAccess?: boolean; accessCheckFailed?: boolean; onRetryAccess?: () => void;
}) {
  useUiLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useAdminStore((s) => s.refresh);
  const initSession = useFamilyStore((s) => s.initSession);
  const navigate = useNavigate();
  const location = useLocation();
  const rootPasswordUpdated = location.state?.rootPasswordUpdated === true;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(email.trim(), password);
      await initSession();
      const access = await refresh();
      if (access !== "admin") setError(access === "forbidden" ? "This account does not have administrator access." : "Unable to verify administrator access.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          {uiText("Admin Login")}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {rootPasswordUpdated && (
            <p className="text-sm text-green-800" role="status">{uiText("Root password updated. All root sessions have been signed out. Log in with your new password or the unchanged fallback password.")}</p>
          )}
          {accountHasNoAccess && !error && (
            <p className="text-sm text-amber-700" role="status">{uiText("The current account is not an administrator. Sign in with an administrator account.")}</p>
          )}
          {accessCheckFailed && !error && (
            <div className="text-sm text-amber-700" role="alert">
              <p>{uiText("Unable to verify administrator access. You can still sign in below.")}</p>
              <button type="button" onClick={onRetryAccess} className="mt-2 underline">{uiText("Try again")}</button>
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">{uiText("Email or root")}</label>
            <input id="email" type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full cursor-text rounded-md border border-gray-300 px-3 py-2 shadow-sm caret-blue-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              {uiText("Password")}</label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm caret-blue-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? uiText("Logging in...") : uiText("Log In")}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {uiText("Back to Map")}</button>
        </div>
      </div>
    </div>
  );
}
