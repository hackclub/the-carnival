export const FIXED_RATE_TOKENS = 10;
export const FIXED_RATE_USD = 4;
export const TOKENS_PER_HOUR = 10;

export function tokensToUsd(tokens: number) {
  return tokens * (FIXED_RATE_USD / FIXED_RATE_TOKENS);
}

export function usdToTokens(usd: number) {
  return usd * (FIXED_RATE_TOKENS / FIXED_RATE_USD);
}

export function tokensToHours(tokens: number) {
  return tokens / TOKENS_PER_HOUR;
}
