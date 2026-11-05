export interface SafeLogFields {
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  code?: string;
  stack?: string;
}

export interface Logger {
  info(message: string, fields?: SafeLogFields): void;
  warn(message: string, fields?: SafeLogFields): void;
  error(message: string, fields?: SafeLogFields): void;
}

function write(level: string, message: string, fields: SafeLogFields = {}): void {
  // Deliberately excludes request headers, cookies, bodies, tokens, and error objects.
  console[level === "error" ? "error" : level === "warn" ? "warn" : "info"](
    JSON.stringify({ level, message, ...fields }),
  );
}

export const safeLogger: Logger = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields),
};
