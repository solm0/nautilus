import type { Token } from "../pageTypes";
import { getLookupKey } from "../tokenLookup";

export function TokenInLemmaExpansion({
  token,
  onSelect,
  language,
  isCenter = false,
  className = "",
  inheritTextColor = false,
}:{
  token: Token;
  onSelect?: (tokenKey: string) => void;
  language: string;
  isCenter?: boolean
  className?: string;
  inheritTextColor?: boolean;
}) {
  const lookupKey = getLookupKey(token, language);
  const isMutedToken = lookupKey == null;

  return (
    <span
      onClick={() => {
        if (!lookupKey || !onSelect || isCenter) return;
        onSelect(lookupKey);
      }}
      className={`
        transition-all
        ${isCenter ? 'cursor-default' : lookupKey ? 'hover:font-[480] cursor-pointer' : 'cursor-default'}
        ${isMutedToken ? 'text-neutral-400 pointer-events-none' : inheritTextColor ? 'text-inherit' : 'text-neutral-600'}
        ${className}
      `}
    >
      {token.surface}
    </span>
  )
}
