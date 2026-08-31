import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import ScrollFillLogo from "./ScrollFillLogo";

function LandingHeader({ homeHref }: { homeHref: string }) {
  const logoWaterRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const updateLogoFill = () => {
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      const water = logoWaterRef.current;

      if (water) {
        water.style.transform = `translateY(${48 * (1 - progress)}px)`;
      }
    };

    updateLogoFill();
    window.addEventListener("scroll", updateLogoFill, { passive: true });
    window.addEventListener("resize", updateLogoFill);

    return () => {
      window.removeEventListener("scroll", updateLogoFill);
      window.removeEventListener("resize", updateLogoFill);
    };
  }, []);

  return (
    <header className="fixed top-4 left-4 z-[60] size-12 bg-transparent select-none md:top-7 md:left-7 md:size-24">
      <Link to={homeHref} aria-label="Lema 홈으로 이동" className="block size-full">
        <ScrollFillLogo ref={logoWaterRef} />
      </Link>
    </header>
  );
}

export default LandingHeader;
