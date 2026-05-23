import { useNavigate } from "react-router-dom";
import FluidBackground from "../FluidBackground";
import { Music4 } from "lucide-react";
import { useNowPlaying } from "../lyric/useNowPlaying";
import Logotype from "../svgs/Logotype";

export function NewPage() {
  const navigate = useNavigate();
  const { hasTrack } = useNowPlaying();

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <FluidBackground />
      <button
        type="button"
        onClick={() => navigate("/lyric")}
        className="fixed top-10 right-4 md:right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 hover:opacity-70 transition-opacity"
        title="Lyrics"
      >
        <Music4 size={18} />
        {hasTrack ? (
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-nt-coral" />
        ) : null}
      </button>
      <div className="flex flex-col gap-14">
        <div className="w-64 transition-opacity mix-blend-overlay select-none">
          <Logotype className="fill-white stroke-0" />
        </div>
      </div>
    </div>
  )
}
