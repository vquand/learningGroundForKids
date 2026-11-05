import type { ReactNode } from "react";
import { getSeasonalTheme } from "../lib/seasonalTheme";

interface SeasonalScreenProps {
  children: ReactNode;
  className?: string;
}

export function SeasonalScreen({ children, className = "" }: SeasonalScreenProps) {
  const theme = getSeasonalTheme();

  return (
    <div className="seasonal-screen" data-seasonal-theme={theme ?? "spring"}>
      <div className={`seasonal-screen__content ${className}`.trim()}>{children}</div>
    </div>
  );
}
