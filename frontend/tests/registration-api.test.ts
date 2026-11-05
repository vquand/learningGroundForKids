import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/api/core.ts";
import { fetchRegistrationAvailability, registerFamily, fetchLegalVersion, registrationErrorMessage } from "../src/api/auth.ts";

test("registration availability is server-owned, uncached and fails closed for malformed values", async () => {
  const original = globalThis.fetch;
  try {
    for (const value of [{ enabled: true }, { enabled: false }, {}, { enabled: "true" }]) {
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input), "/api/v1/auth/registration");
        assert.equal(init?.cache, "no-store");
        assert.equal(init?.credentials, "same-origin");
        return Response.json(value);
      };
      if (typeof value.enabled === "boolean") assert.equal(await fetchRegistrationAvailability(), value.enabled);
      else await assert.rejects(fetchRegistrationAvailability(), /Unable to check/);
    }
  } finally { globalThis.fetch = original; }
});

test("family registration sends credentials and the fetched consent version through the same-origin API and preserves errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "/api/v1/auth/register");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), { name: "Family", email: "family@example.test", password: "long password", legalVersion: "test-version" });
      return Response.json({ error: { code: "REGISTRATION_DISABLED", message: "Registration is disabled." } }, { status: 403 });
    };
    await assert.rejects(registerFamily(" Family ", " family@example.test ", "long password", "test-version"), /Registration is disabled/);
  } finally { globalThis.fetch = original; }
});


test("legal version is fetched uncached and malformed versions fail closed", async () => {
  const original = globalThis.fetch;
  try {
    for (const value of [{ version: "server-version" }, {}, { version: null }, { version: "" }]) {
      globalThis.fetch = async (input, init) => {
        assert.equal(String(input), "/api/v1/legal/version");
        assert.equal(init?.credentials, "same-origin");
        assert.equal(init?.cache, "no-store");
        return Response.json(value);
      };
      if (typeof value.version === "string" && value.version) assert.equal(await fetchLegalVersion(), value.version);
      else await assert.rejects(fetchLegalVersion(), /reload the page/);
    }
  } finally { globalThis.fetch = original; }
});

test("registration errors preserve codes and display authored generic and updated-consent copy", async () => {
  const original = globalThis.fetch;
  try {
    for (const [code, expected] of [
      ["REGISTRATION_FAILED", "We could not create this account. Try signing in, or use a different email."],
      ["LEGAL_VERSION_MISMATCH", "Our legal text has changed. Please reload the page and read the updated text."],
      ["CONSENT_REQUIRED", "Please read and accept the Privacy Policy and Terms of Use."],
    ]) {
      globalThis.fetch = async () => Response.json({ error: { code, message: "untrusted upstream wording" } }, { status: 409 });
      await assert.rejects(registerFamily("Family", "family@example.test", "long password", "fetched-version"), (caught: unknown) => {
        assert.ok(caught instanceof ApiError);
        assert.equal(caught.code, code);
        assert.equal(registrationErrorMessage(caught), expected);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});
