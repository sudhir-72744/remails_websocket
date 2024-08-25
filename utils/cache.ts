import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 1, checkperiod: 1 });

export function isDuplicate(key: string): boolean {
  if (cache.has(key)) {
    return true;
  }
  cache.set(key, true);
  return false;
}