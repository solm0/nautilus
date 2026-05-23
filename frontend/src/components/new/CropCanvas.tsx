import { useCallback, useEffect, useRef, useState } from "react";
import type { FooterAction } from "./New";

type Props = {
  image: string;
  onCrop: (blob: Blob) => void;
  setFooterAction: (action: FooterAction | null) => void;
  onRectChange?: (rect: any) => void;
};

export default function CropCanvas({ image, onCrop, setFooterAction, onRectChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (rect) {
      ctx.fillStyle = "#73737333";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);

      ctx.drawImage(
        img,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        rect.x,
        rect.y,
        rect.w,
        rect.h
      );

      ctx.strokeStyle = "#737373aa";
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  };

  useEffect(() => {
    draw();
  }, [rect, image]);

  // 캔버스 상의 실제 좌표로 변환 (마우스/터치 공통)
  const getCanvasPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;

    return {
      x: (clientX - bounds.left) * scaleX,
      y: (clientY - bounds.top) * scaleY,
    };
  };

  // 마우스 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    const p = getCanvasPos(e.clientX, e.clientY);
    setStart(p);
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !start) return;
    const p = getCanvasPos(e.clientX, e.clientY);
    const newRect = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(start.x - p.x),
      h: Math.abs(start.y - p.y),
    }
    setRect(newRect);
    onRectChange?.(newRect);
  };

  const handleMouseUp = () => setDragging(false);

  // 터치 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    // 크롭 영역 드래그 중 페이지 스크롤 방지
    e.preventDefault();
    const touch = e.touches[0];
    const p = getCanvasPos(touch.clientX, touch.clientY);
    setStart(p);
    setDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault(); // 스크롤 차단
    if (!dragging || !start) return;
    const touch = e.touches[0];
    const p = getCanvasPos(touch.clientX, touch.clientY);
    const newRect = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(start.x - p.x),
      h: Math.abs(start.y - p.y),
    }
    setRect(newRect);
    onRectChange?.(newRect);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  // React의 onTouchXxx는 passive listener라 preventDefault가 동작하지 않을 수 있음.
  // 따라서 useEffect로 non-passive 리스너를 직접 등록한다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const p = getCanvasPos(touch.clientX, touch.clientY);
      setStart(p);
      setDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const p = getCanvasPos(touch.clientX, touch.clientY);
      setDragging((prev) => {
        if (!prev) return prev;
        setStart((s) => {
          if (!s) return s;
          const newRect = {
            x: Math.min(s.x, p.x),
            y: Math.min(s.y, p.y),
            w: Math.abs(s.x - p.x),
            h: Math.abs(s.y - p.y),
          }
          setRect(newRect);
          onRectChange?.(newRect);
          
          return s;
        });
        return prev;
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setDragging(false);
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // canvasRef는 mount 후 고정이므로 deps 불필요

  const handleCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !rect) return;

    const temp = document.createElement("canvas");
    temp.width = rect.w;
    temp.height = rect.h;

    const ctx = temp.getContext("2d")!;
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

    temp.toBlob((blob) => {
      if (blob) onCrop(blob);
    });
  }, [rect, onCrop]);

  useEffect(() => {
    setFooterAction({
      text: "OCR this area",
      onClick: handleCrop,
      disabled: !rect,
    });
  }, [rect]);

  return (
    <div className="flex flex-col items-start gap-2 pb-4 w-full">
      <div className="text-sm flex flex-col">
        <p>Select the area to scan.</p>
        <p>* Less background improves speed.</p>
        <p>* Leaving some margin around the text improves accuracy.</p>
      </div>

      {/* 숨겨진 원본 이미지 (자연 크기 로드용) */}
      <img
        ref={imgRef}
        src={image}
        style={{ display: "none" }}
        onLoad={draw}
      />

      {/*
        캔버스를 감싸는 컨테이너.
        - max-h-[70vh]: 이미지가 길어도 화면 안에 수납
        - overflow-hidden: 캔버스가 컨테이너를 넘지 않도록
        - touch-none: Tailwind CSS touch-action: none (CSS 레벨 스크롤 차단)
      */}
      {/*
        컨테이너에만 max-height + overflow-auto 적용.
        캔버스는 width: 100% / height: auto 로만 두어야
        자연 비율(naturalWidth/Height)이 유지됨.
        max-height를 캔버스에 직접 주면 width:100%와 충돌해 찌그러짐.
      */}
      <div
        ref={containerRef}
        className="w-full touch-none"
        style={{ maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{
            display: "block",    // inline 기본값으로 인한 하단 gap 제거
            height: "auto",      // 비율 유지 핵심
            cursor: "crosshair",
            userSelect: "none",
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          // React touch 핸들러는 passive 문제로 useEffect 네이티브 리스너가 우선.
          // 아래는 fallback(React 19+ 등 passive 기본값 바뀔 경우 대비).
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

    </div>
  );
}
