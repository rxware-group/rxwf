export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    if (parsed.username && parsed.protocol.startsWith("redis")) {
      // keep username visible for ACL; mask password only
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^:@/]+)@/g, ":***@");
  }
}
