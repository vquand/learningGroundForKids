import assert from "node:assert/strict";
import test from "node:test";
import { authClientAddress, trustedProxyRanges } from "../src/client-address.js";
import { loadConfig } from "../src/config.js";

test("forwarded prefixes cannot replace the first untrusted client in a verified proxy chain", () => {
  const trusted = trustedProxyRanges(["10.0.0.0/24", "192.0.2.10/32"]);
  for (const forged of ["203.0.113.1", "203.0.113.2", "malformed"]) {
    assert.equal(authClientAddress("10.0.0.1", `${forged}, 198.51.100.8, 192.0.2.10`, trusted), "198.51.100.8");
  }
});

test("forwarded addresses are ignored for untrusted peers and malformed intermediate hops", () => {
  const trusted = trustedProxyRanges(["10.0.0.0/24"]);
  assert.equal(authClientAddress("198.51.100.8", "203.0.113.1", trusted), "198.51.100.8");
  assert.equal(authClientAddress("10.0.0.1", "203.0.113.1, not-an-ip", trusted), "10.0.0.1");
  assert.equal(authClientAddress(undefined, "203.0.113.1", trusted), null);
});

test("proxy ranges handle IPv6 without trusting arbitrary clients", () => {
  const trusted = trustedProxyRanges(["fd00::/64"]);
  assert.equal(authClientAddress("fd00::1", "2001:db8::1", trusted), "2001:db8::1");
  assert.equal(authClientAddress("2001:db8::2", "2001:db8::1", trusted), "2001:db8::2");
});

test("configuration rejects malformed or catch-all trusted proxy ranges", () => {
  for (const value of ["0.0.0.0/0", "::/0", "garbage", "192.0.2.1/33", "fd00::/129"]) {
    assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://unused@localhost/test", AUTH_TRUSTED_PROXY_CIDRS: value }));
  }
});
