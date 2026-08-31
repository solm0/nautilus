import type { ReactNode } from "react";
import textMarkdown from "./background/text.md?raw";
import academicBasisMarkdown from "./background/academic_basis.md?raw";

type AcademicBasis = {
  source: string;
  summary: string;
};

type ContentBlock =
  | { type: "heading"; level: 2; content: string }
  | { type: "paragraph"; content: string }
  | { type: "note"; content: string };

const basisIdPattern = String.raw`\d+(?:-(?:\d+|보완))+`;

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function parseAcademicBasis(markdown: string) {
  const basis = new Map<string, AcademicBasis>();

  for (const line of markdown.split("\n")) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 3 || !new RegExp(`^${basisIdPattern}$`).test(cells[0])) {
      continue;
    }

    basis.set(cells[0], {
      source: cleanInlineMarkdown(cells[1]),
      summary: cleanInlineMarkdown(cells[2]),
    });
  }

  return basis;
}

function parseContent(markdown: string) {
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", content: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line === "---") {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: 2, content: heading[1] });
      continue;
    }

    if (line.startsWith("*(") && line.endsWith(")*")) {
      flushParagraph();
      blocks.push({ type: "note", content: line.slice(1, -1) });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

const academicBasis = parseAcademicBasis(academicBasisMarkdown);
const contentBlocks = parseContent(textMarkdown);

function Citation({ id }: { id: string }) {
  const basis = academicBasis.get(id);

  if (!basis) {
    return <span className="text-red-700">{id}</span>;
  }

  return (
    <span
      className="group relative inline-block cursor-help rounded-sm text-accent underline decoration-dotted underline-offset-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      tabIndex={0}
      aria-label={`${id}: ${basis.source}. ${basis.summary}`}
    >
      {id}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 hidden w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-neutral-900 px-4 py-3 text-left text-sm leading-5 font-normal text-neutral-100 shadow-xl group-hover:block group-focus:block"
      >
        <span className="mb-1 block text-xs font-semibold text-neutral-400">{id}</span>
        <span className="block font-semibold">{basis.source}</span>
        <span className="mt-1.5 block text-neutral-300">{basis.summary}</span>
      </span>
    </span>
  );
}

function renderInline(content: string) {
  const tokenPattern = new RegExp(`(\\((?:${basisIdPattern})(?:\\s*,\\s*(?:${basisIdPattern}))*\\)|\\*\\*[^*]+\\*\\*)`, "g");
  const parts = content.split(tokenPattern);

  return parts.map((part, partIndex): ReactNode => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("(") && part.endsWith(")")) {
      const ids = part.slice(1, -1).split(/\s*,\s*/);
      return (
        <span key={partIndex}>
          (
          {ids.map((id, idIndex) => (
            <span key={id}>
              {idIndex > 0 ? ", " : null}
              <Citation id={id} />
            </span>
          ))}
          )
        </span>
      );
    }

    return part;
  });
}

function BackgroundPage() {
  return (
    <main className="min-h-screen px-5 pt-12 pb-20 text-neutral-900">
      <article className="mx-auto max-w-190 break-keep [overflow-wrap:break-word]">
        <h1 className="mb-6 text-3xl font-bold">설계 배경</h1>

        <p className="mb-3.5 py-[1em] text-lg font-medium leading-7 max-w-[40rem]">
          Lema는 '어휘를 암기하지 않고 여러 문맥에서 반복 노출로 습득한다'는 아이디어를 인터페이스로 구현한 것이다. 그러기 위해 필요한 조건들(커버리지, 반복 횟수, 마찰 없는 검색)을 하나씩 기능으로 옮겼다.
        </p>

        {contentBlocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h2 key={index} className="mt-10 mb-3.5 text-xl font-bold leading-8">
                {block.content}
              </h2>
            );
          }

          if (block.type === "note") {
            return (
              <p key={index} className="mb-4 py-[0.5em] text-sm text-neutral-500">
                {block.content}
              </p>
            );
          }

          return (
            <p key={index} className="mb-3.5 py-[0.5em] text-base leading-7 max-w-[40rem]">
              {renderInline(block.content)}
            </p>
          );
        })}
      </article>
    </main>
  );
}

export default BackgroundPage;
