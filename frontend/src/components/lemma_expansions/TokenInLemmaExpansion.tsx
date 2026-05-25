import type { Token } from "../pageTypes";
import { getLookupKey, getLookupKeyForMorph } from "../tokenLookup";

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

  if (language === "ko" && token.morphs && token.morphs.length > 0) {
    return (
      <span className={className}>
        {token.morphs.map((morph, index) => {
          const morphKey = getLookupKeyForMorph(morph, language);

          return (
            <span
              key={`${morph.surface}-${index}`}
              onClick={() => {
                if (!morphKey || !onSelect || isCenter) return;
                onSelect(morphKey);
              }}
              className={`
                transition-all
                ${isCenter ? 'cursor-default' : morphKey ? 'hover:font-[480] cursor-pointer' : 'cursor-default'}
                ${inheritTextColor ? 'text-inherit' : 'text-neutral-700'}
              `}
            >
              {morph.surface}
            </span>
          );
        })}
      </span>
    );
  }

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
