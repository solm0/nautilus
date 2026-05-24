import { useEffect, useMemo, useRef, useState } from "react";
import { TokenInLemmaExpansion } from "./TokenInLemmaExpansion";

// ── 컨트롤 가능한 상수 ───────────────────────────────────────────────────────
const CANVAS_HEIGHT = 700;
const RELATED_LINE_STROKE = "var(--color-neutral-300)";
const RELATED_LINE_WIDTH = 3;
const RELATED_LINE_OPACITY = 0.55;
const GRAPH_SIDE_MAX = 520;
const NODE_PADDING_X = 72;
const NODE_PADDING_Y = 56;
const GRAPH_DEPTH_RATIO = 0.2;
const PERSPECTIVE = 800;
const CENTER_GAP_MIN_PX = 200;
const CENTER_GAP_RATIO = 0.68;
const CENTER_GAP_MIN_PX_Y = 132;
const RING_THICKNESS_MIN_PX = 36;
const OUTER_RADIUS_FILL_X = 0.94;
const OUTER_RADIUS_FILL_Y = 0.9;
// ── 타입 ─────────────────────────────────────────────────────────────────────
type Pos = { x: number; y: number };
type Size = { width: number; height: number };
type Point3 = { x: number; y: number; z: number; word: string; };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function project3D(point: Pos & { z: number }, rotX: number, rotY: number) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);

  const x1 = point.x * cosY + point.z * sinY;
  const z1 = -point.x * sinY + point.z * cosY;
  const y2 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;

  const scale = PERSPECTIVE / (PERSPECTIVE + z2);
  return { x: x1 * scale, y: y2 * scale, scale };
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function LemmaRelated({
  data,
  onSelect,
  lemmaKey,
  language,
  scrollOffset = 0,
}: {
  data: string[];
  onSelect: (tokenKey: string) => void;
  lemmaKey: string;
  language: string;
  scrollOffset?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [centerPos, setCenterPos] = useState<Pos>({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState<Size>({ width: 600, height: CANVAS_HEIGHT });
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const W = container.clientWidth || 600;
      const H = container.clientHeight || CANVAS_HEIGHT;
      setContainerSize({ width: W, height: H });
      setCenterPos({ x: W / 2, y: H / 2 });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [scrollOffset]);

  const { minRadiusX, maxRadiusX, minRadiusY, maxRadiusY, maxDepth } = useMemo(() => {
    const halfWidth = Math.max(containerSize.width / 2 - NODE_PADDING_X, 80);
    const halfHeight = Math.max(containerSize.height / 2 - NODE_PADDING_Y, 80);
    const resolvedMaxRadiusX = clamp(halfWidth * OUTER_RADIUS_FILL_X, 80, GRAPH_SIDE_MAX / 2);
    const resolvedMaxRadiusY = clamp(halfHeight * OUTER_RADIUS_FILL_Y, 80, GRAPH_SIDE_MAX / 2);
    const resolvedMinRadiusX = Math.max(
      0,
      Math.min(
        resolvedMaxRadiusX - RING_THICKNESS_MIN_PX,
        Math.max(CENTER_GAP_MIN_PX, resolvedMaxRadiusX * CENTER_GAP_RATIO),
      ),
    );
    const resolvedMinRadiusY = Math.max(
      0,
      Math.min(
        resolvedMaxRadiusY - RING_THICKNESS_MIN_PX,
        Math.max(CENTER_GAP_MIN_PX_Y, resolvedMaxRadiusY * CENTER_GAP_RATIO),
      ),
    );

    return {
      minRadiusX: resolvedMinRadiusX,
      maxRadiusX: resolvedMaxRadiusX,
      minRadiusY: resolvedMinRadiusY,
      maxRadiusY: resolvedMaxRadiusY,
      maxDepth: Math.min(resolvedMaxRadiusX, resolvedMaxRadiusY) * GRAPH_DEPTH_RATIO,
    };
  }, [containerSize.height, containerSize.width]);
  
  const points = useMemo<Point3[]>(() => {
    const makePoint = (word: string, idx: number) => {
      const seed = hashString(`${word}-${idx}`);
      const seed2 = hashString(`${word}-${idx}-z`);
      const seed3 = hashString(`${word}-${idx}-r`);
      
      const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
      const baseAngle = idx * GOLDEN_ANGLE;
      const jitter = ((seed % 100) / 100 - 0.5) * 0.6;
      const angle = baseAngle + jitter;
      const t = (idx + 0.5) / data.length;
      const radialT = Math.sqrt(t);
      
      const radiusJitter = 0.3; // 15% 정도
      const baseRadiusX =
        radialT * (maxRadiusX - minRadiusX) + minRadiusX;
      const baseRadiusY =
        radialT * (maxRadiusY - minRadiusY) + minRadiusY;
      const radiusX = Math.min(
        maxRadiusX,
        Math.max(
          minRadiusX,
          baseRadiusX * (1 + ((seed3 % 100) / 100 - 0.5) * radiusJitter),
        ),
      );
      const radiusY = Math.min(
        maxRadiusY,
        Math.max(
          minRadiusY,
          baseRadiusY * (1 + ((seed3 % 100) / 100 - 0.5) * radiusJitter),
        ),
      );
      
      const zBase = Math.sin(idx * 1.7) * 0.8;
      const zNoise = ((seed2 % 100) / 100 - 0.5) * 0.4;
      const z = clamp((zBase + zNoise) * maxDepth, -maxDepth, maxDepth);
      
      return {
        word,
        x: Math.cos(angle) * radiusX,
        y: Math.sin(angle) * radiusY,
        z,
      };
    };
    
    const syn = data.map((word, i) => makePoint(word, i));
    return [...syn,];
  }, [data, maxDepth, maxRadiusX, maxRadiusY, minRadiusX, minRadiusY]);

  const lang = lemmaKey.split('/')[2];

  const projectedPoints = useMemo(() => {
    return points.map((p) => {
      const proj = project3D({ x: p.x, y: p.y, z: p.z }, 0, 0);
      return {
        ...p,
        x2d: proj.x + centerPos.x,
        y2d: proj.y + centerPos.y,
      };
    });
  }, [points, centerPos]);

  function formatLemma(lemma: string, pos: string) {
    
    if (lang === "de" && pos === "NOUN") {
      lemma = lemma.charAt(0).toUpperCase() + lemma.slice(1);
    }

    return lemma
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        transition: "opacity 200ms ease",
      }}
      className="text-sm"
    >
      {/* connection layer */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {projectedPoints.map((pos) => (
          <line
            key={pos.word}
            x1={centerPos.x}
            y1={centerPos.y}
            x2={pos.x2d}
            y2={pos.y2d}
            stroke={RELATED_LINE_STROKE}
            strokeWidth={RELATED_LINE_WIDTH}
            strokeLinecap="round"
            opacity={RELATED_LINE_OPACITY}
          />
        ))}
      </svg>

      {/* text layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <NodeOverlay x={centerPos.x} y={centerPos.y}>
          <span className="bg-neutral-50 border border-neutral-200 px-3 py-1 rounded-sm">
            <TokenInLemmaExpansion
              token={{ lemma: lemmaKey.split("/")[0], pos: lemmaKey.split("/")[1], surface: formatLemma(lemmaKey.split("/")[0], lemmaKey.split("/")[1]), dep: null }}
              language={language}
              isCenter={true}
            />
          </span>
        </NodeOverlay>

        {projectedPoints.map((pos) => (
          <NodeOverlay
            key={pos.word}
            x={pos.x2d}
            y={pos.y2d}
          >
            <span className="bg-neutral-200 px-2 py-1 rounded-sm">
              <TokenInLemmaExpansion
                token={{ lemma: pos.word.split("_")[0], pos: pos.word.split("_")[1], surface: formatLemma(pos.word.split("_")[0], pos.word.split("_")[1]), dep: null }}
                language={language}
                onSelect={onSelect}
              />
            </span>
          </NodeOverlay>
        ))}
      </div>
    </div>
  );
}

// ── 노드 absolute 포지셔닝 래퍼 ──────────────────────────────────────────────
function NodeOverlay({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 2,
        transform: `translate(-50%, -50%)`,
        pointerEvents: "auto",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}
