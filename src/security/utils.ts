import crypto from 'crypto';

export class SecurityUtils {
  public static generateHMAC(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  public static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public static validateSSRF(url: string): { isValid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'https:') {
        return { isValid: false, reason: 'Only HTTPS URLs are allowed' };
      }

      const hostname = parsed.hostname;

      if (this.isPrivateIP(hostname) || this.isLoopback(hostname) || this.isMetadataURL(hostname)) {
        return { isValid: false, reason: 'URL resolves to blocked IP range' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: 'Invalid URL' };
    }
  }

  private static isPrivateIP(hostname: string): boolean {
    const ip = this.resolveToIP(hostname);
    if (!ip) {
      return false;
    }

    const ranges = [
      '127.0.0.0/8',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '169.254.0.0/16',
      '::1',
      'fc00::/7',
    ];

    return ranges.some(range => this.ipInRange(ip, range));
  }

  private static isLoopback(hostname: string): boolean {
    const ip = this.resolveToIP(hostname);
    return ip ? ip.startsWith('127.') || ip === '::1' : false;
  }

  private static isMetadataURL(hostname: string): boolean {
    return hostname === '169.254.169.254' || hostname.endsWith('.metadata.google.internal');
  }

  private static ipInRange(ip: string, range: string): boolean {
    const [network, prefix] = range.split('/');
    const ipNum = this.ipToLong(ip);
    const networkNum = this.ipToLong(network);
    const mask = (0xffffffff << (32 - parseInt(prefix))) >>> 0;

    return (ipNum & mask) === (networkNum & mask);
  }

  private static ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private static resolveToIP(hostname: string): string | null {
    return null;
  }
}