import { useEffect, useMemo, useRef, useState } from "react"
import { getFavorites, lemmaLookupOne, setFavorite } from "../../api"
import { Star } from "lucide-react"
import ResponsiveSideLayout from "../util/ResponsiveSideLayout";
import Desk from "../lemma_expansions/Desk";
import type { LemmaData } from "../pageTypes";
import { useLayout } from "../RootLayout";

function groupLemmas(favorites: Set<string>) {
  const groups: Record<string, string[]> = {}

  for (const key of favorites) {
    const lemma = key.split("_")[0]
    const letter = lemma[0].toUpperCase()

    if (!groups[letter]) groups[letter] = []
    groups[letter].push(key)
  }

  // 정렬
  Object.keys(groups).forEach(letter => {
    groups[letter].sort((a, b) => a.localeCompare(b))
  })

  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

export default function Lemmas(){
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [lemmaData, setLemmaData] = useState<LemmaData | null>(null);
  const [currentLang, setCurrentLang] = useState<string | null>(null);
  const { setTitlebarAction, setPanelOpen } = useLayout()
  const lastLemmaRef =
  useRef<LemmaData | null>(null)

  useEffect(() => {
    if (lemmaData) {
      lastLemmaRef.current = lemmaData
    }

    setPanelOpen(lemmaData !== null)
  }, [lemmaData])

  useEffect(() => {
    setTitlebarAction(() => {
      setLemmaData(prev => {
        if (prev) {
          return null
        }

        return lastLemmaRef.current
      })
    })

    return () => {
      setTitlebarAction(null)
    }
  }, [])

  // favorite lemmas 가져오기
  useEffect(() => {
    getFavorites().then(res => {
      setFavorites(new Set(res))
    })
  }, [])

  const grouped = useMemo(() => groupLemmas(favorites), [favorites]);
  
  // 클릭
  const onFavoriteClick = async (key: string, next:boolean) => {
    await setFavorite(key, next);

    const res = await getFavorites();
    setFavorites(new Set(res));
  };

  const onLemmaClick = async (lemma:string, pos:string, language:string) => {
    setCurrentLang(language);
    const data = await lemmaLookupOne({ lemma, pos }, language);
    setLemmaData(data);
  }

  return (
    <div className="w-full h-full flex pl-3 md:pl-6 bg-neutral-50">
      <div className="flex-1 relative flex flex-col overflow-hidden gap-7">

        <h2 className="top-0 pt-8 md:pt-12 z-30">My Lemmas</h2>
        
        <div className="overflow-y-scroll flex flex-wrap content-start gap-x-1 gap-y-7 pb-18 pt-7">
          {grouped.map(([letter, items]) => (
            <div key={letter} className="min-w-46 flex-1 basis-46 pr-3 md:pr-6">
              <div className="mb-2 pb-1 pl-1 text-sm text-neutral-400 flex border-b border-neutral-300">{letter}</div>
              <div className="flex flex-col">
                {items.map(key => {
                  const [lemma, pos, lang] = key.split("/")
                  const isFavorite = favorites.has(key)

                  return (
                    <div
                      key={key}
                      className="group flex items-center gap-2 min-w-46 px-1"
                    >
                      <p
                        onClick={() => onLemmaClick(lemma,pos,lang)}
                        className="truncate cursor-pointer flex gap-2 items-baseline"
                      >
                        {lemma}
                        <span className="text-xs text-neutral-400">{lang}</span>
                        <span className="text-xs text-neutral-400">{pos}</span>
                      </p>

                      <Star
                        size={17}
                        className="opacity-0 group-hover:opacity-100 transition cursor-pointer text-neutral-400 hover:text-neutral-500"
                        fill={isFavorite ? "currentColor" : "transparent"}
                        onClick={() => onFavoriteClick(key, !isFavorite)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {lemmaData &&
        <ResponsiveSideLayout
          open={!!lemmaData}
          onClose={()=>setLemmaData(null)}
          restoreKey={lemmaData.key}
        >
          <Desk
            key={lemmaData.key}
            initialLemma={lemmaData}
            onToggleFavorite={onFavoriteClick}
            language={currentLang!}
          />
        </ResponsiveSideLayout>
      }
    </div>
  )
}
