export interface ChatGPTUser {
  id: string;
  email: string;
  name: string;
}

const OPENAI_ID_HEADER = "oai-authenticated-user-id";
const OPENAI_EMAIL_HEADER = "oai-authenticated-user-email";
const OPENAI_NAME_HEADER = "oai-authenticated-user-full-name";
const OPENAI_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const OPENAI_NAME_ENCODING = "percent-encoded-utf-8";

function cleanHeader(value: string | null, maxLength: number): string | null {
  const cleaned = value?.trim() ?? "";
  if (!cleaned || cleaned.length > maxLength || /[\u0000-\u001f\u007f]/.test(cleaned)) return null;
  return cleaned;
}

function decodeFullName(headers: Headers): string | null {
  if (headers.get(OPENAI_NAME_ENCODING_HEADER) !== OPENAI_NAME_ENCODING) return null;
  const encodedName = cleanHeader(headers.get(OPENAI_NAME_HEADER), 600);
  if (!encodedName) return null;
  try {
    return cleanHeader(decodeURIComponent(encodedName), 200);
  } catch {
    return null;
  }
}

export function getChatGPTUser(request: Request): ChatGPTUser | null {
  const id = cleanHeader(request.headers.get(OPENAI_ID_HEADER), 255);
  const email = cleanHeader(request.headers.get(OPENAI_EMAIL_HEADER), 320);
  if (!id || !email || !email.includes("@")) return null;
  return { id, email, name: decodeFullName(request.headers) ?? email };
}
