import { BlockList, isIP } from "node:net";

export function isProxyRange(value: string): boolean {
  const [address, prefix, extra] = value.split("/");
  const version = isIP(address ?? "");
  if (!version || extra !== undefined) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (version === 4 ? 32 : 128);
}

export function trustedProxyRanges(ranges: readonly string[]): BlockList {
  const trusted = new BlockList();
  for (const range of ranges) {
    if (!isProxyRange(range)) throw new Error("Invalid trusted proxy range.");
    const [address, prefix] = range.split("/");
    const type = isIP(address!) === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) trusted.addAddress(address!, type);
    else trusted.addSubnet(address!, Number(prefix), type);
  }
  return trusted;
}

/** Walk from the socket peer toward the client, stopping at the first untrusted hop. */
export function authClientAddress(
  peer: string | undefined,
  forwarded: string | undefined,
  trusted: BlockList,
): string | null {
  if (!peer || !isIP(peer)) return null;
  let address = peer;
  if (!forwarded) return address;
  const chain = forwarded.split(",").map((value) => value.trim());
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const type = isIP(address) === 4 ? "ipv4" : "ipv6";
    if (!trusted.check(address, type)) break;
    const hop = chain[index]!;
    // An invalid intermediate hop breaks provenance: retain the socket quota.
    if (!isIP(hop)) return peer;
    address = hop;
  }
  return address;
}
