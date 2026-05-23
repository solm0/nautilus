import type { Token } from "../pageTypes";

const stopPos = [
    "PUNCT",
    "SYM",
    "SPACE",
    "DET",
    "CCONJ",
    "SCONJ",
    "PART",
    "PRON",
    "ADP",
]

export function TokenInLemmaExpansion({
  token, onSelect, isCenter = false, className = "", inheritTextColor = false
}:{
  token: Token;
  onSelect?: (tokenKey: string) => void;
  isCenter?: boolean
  className?: string;
  inheritTextColor?: boolean;
}) {
  const isMutedToken = !token.pos || stopPos.includes(token.pos);

  return (
    <span
      onClick={() => {
        if (token.pos === "" || !onSelect || isCenter) return;
        else onSelect(`${token.lemma}_${token.pos}`);
      }}
      className={`
        transition-all
        ${isCenter ? 'cursor-default' : token.pos == "" ? 'cursor-pointer' : 'hover:font-[480] cursor-pointer'}
        ${isMutedToken ? 'text-neutral-400 pointer-events-none' : inheritTextColor ? 'text-inherit' : 'text-neutral-600'}
        ${className}
      `}
    >
      {token.surface}
    </span>
  )
}
