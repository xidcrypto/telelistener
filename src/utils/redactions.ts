export function redactPaths(obj: any, paths: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPaths(item, paths));
  }

  const redacted = { ...obj };

  for (const key of Object.keys(redacted)) {
    if (paths.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactPaths(redacted[key], paths);
    }
  }

  return redacted;
}