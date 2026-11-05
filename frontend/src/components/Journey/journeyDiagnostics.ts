export interface JourneyDiagnosticsEnv {
  DEV?: boolean;
  VITE_JOURNEY_DIAGNOSTICS?: string;
}

export function isJourneyDiagnosticsEnabled(env: JourneyDiagnosticsEnv): boolean {
  return env.DEV === true && env.VITE_JOURNEY_DIAGNOSTICS === "true";
}
