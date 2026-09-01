import type { Token } from "../pageTypes";
import { getLookupKey, getLookupKeyForMorph } from "../tokenLookup";
import { Star } from "lucide-react";

export function TokenInLemmaExpansion({
  token,
  onSelect,
  language,
  isCenter = false,
  className = "",
  inheritTextColor = false,
  canSelectKey,
  lemmaInfo,
}:{
  token: Token;
  onSelect?: (tokenKey: string) => void;
  language: string;
  isCenter?: boolean
  className?: string;
  inheritTextColor?: boolean;
  canSelectKey?: (tokenKey: string) => boolean;
  lemmaInfo?: Record<string, { is_favorite?: boolean }>;
}) {
  const lookupKey = getLookupKey(token, language);
  const tokenSelectable = lookupKey != null && (canSelectKey ? canSelectKey(lookupKey) : true);
  const isMutedToken = !tokenSelectable;

  const renderFavorite = (key: string | null) => {
    if (!key || lemmaInfo?.[key]?.is_favorite !== true) return null;
    return (
      <Star
        size={9}
        aria-hidden="true"
        className="ml-0.5 shrink-0 text-neutral-400"
        fill="currentColor"
        stroke="transparent"
      />
    );
  };

  if ((language === "ko" || language === "ja") && token.morphs && token.morphs.length > 0) {
    return (
      <span className={className}>
        {token.morphs.map((morph, index) => {
          const morphKey = getLookupKeyForMorph(morph, language);
          const morphSelectable = morphKey != null && (canSelectKey ? canSelectKey(morphKey) : true);

          return (
            <span
              key={`${morph.surface}-${index}`}
              onClick={() => {
                if (!morphSelectable || !morphKey || !onSelect || isCenter) return;
                onSelect(morphKey);
              }}
              className={`
                transition-all
                ${isCenter ? 'cursor-default' : morphSelectable ? 'hover:font-[480] cursor-pointer' : 'cursor-default'}
                ${morphSelectable ? (inheritTextColor ? 'text-inherit' : 'text-neutral-700') : 'text-neutral-400 pointer-events-none'}
              `}
            >
              <span className="inline-flex items-center">
                {morph.surface}
                {renderFavorite(morphKey)}
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span
      onClick={() => {
        if (!tokenSelectable || !lookupKey || !onSelect || isCenter) return;
        onSelect(lookupKey);
      }}
      className={`
        transition-all
        ${isCenter ? 'cursor-default' : tokenSelectable ? 'hover:font-[480] cursor-pointer' : 'cursor-default'}
        ${isMutedToken ? 'text-neutral-400 pointer-events-none' : inheritTextColor ? 'text-inherit' : 'text-neutral-600'}
        ${className}
      `}
    >
      <span className="inline-flex items-center">
        {token.surface}
        {renderFavorite(lookupKey)}
      </span>
    </span>
  )
}
