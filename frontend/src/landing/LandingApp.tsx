import { useEffect, useState } from "react";
import type { Annotation, LemmaData, OCRResponse } from "../components/pageTypes";
import type { SidePanelState } from "../components/pageview/PageView";
import Desk from "../components/lemma_expansions/Desk";
import PageContent from "../components/pageview/PageContent";
import NgramToggleInput from "../components/pageview/NgramToggleInput";
import Logotype from "../components/svgs/Logotype";
import Button from "../components/util/Button";

type DemoPayload = {
  language: string;
  title: string;
  description: string;
  sample_input: string;
  result: OCRResponse;
  lemma_info: Record<string, LemmaData>;
};

const fixedLanguageOptions = [{ lang: "en" }];

function LandingApp() {
  const [demo, setDemo] = useState<DemoPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<SidePanelState>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [composerValue, setComposerValue] = useState("language opens a sentence");
  const [selectedLemma, setSelectedLemma] = useState<LemmaData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDemo = async () => {
      try {
        const response = await fetch("/api/demo/landing/en");

        if (!response.ok) {
          throw new Error("Could not load demo data.");
        }

        const payload = (await response.json()) as DemoPayload;

        if (cancelled) {
          return;
        }

        const firstLemma = Object.values(payload.lemma_info)[0] ?? null;

        setDemo(payload);
        setComposerValue(payload.sample_input);
        setSelectedLemma(firstLemma);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load demo data.",
        );
      }
    };

    void loadDemo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (panel?.type === "lemma") {
      setSelectedLemma(panel.data);
    }
  }, [panel]);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-300 pt-7 px-7 xl:pr-[19rem] flex flex-col h-screen overflow-hidden break-keep">
        {/* 헤더 */}
        <header className="w-46 select-none">
          <Logotype className="fill-nt-blue stroke-0"/>
        </header>

        <div className="flex flex-col gap-21 h-auto overflow-y-scroll no-scrollbar pb-7">

          {/* 개요, 설치 */}
          <section className="min-h-180 pt-21 flex flex-col gap-14">
            <h1 className="font-serif max-w-[14em] text-[2.6rem] leading-[1.2] tracking-[-0.02em] text-neutral-900 md:text-5xl ">
              You don’t have to wait until everything is perfect.
              <br/>Just dive into text and enjoy it.
            </h1>
            <div className="max-w-3xl text-base md:text-lg leading-7 text-neutral-600 flex flex-col gap-[1em]">
              <p>
                Nautilus<span className="text-sm font-medium">[노틸러스]</span>는 특정 외국어의 문자, 발성, 생성 규칙에 흥미를 느끼는 사용자가 복잡한 사전 지식 없이도 텍스트를 탐색할 수 있도록 하는 도구입니다.
                사용자가 번역기에 의존하지 않고도 목표 언어의 텍스트를 독해하고 작성해볼 수 있도록 보조합니다.
              </p>
              <p>
                데스크탑 앱, 모바일 앱, 크롬 익스텐션으로 구성되어 있으며 현재 러시아어, 독일어, 영어, 세르비아어, 마케도니아어, 알바니아어를 지원합니다.
                <a href="#contribute">당신의 언어, 또는 당신이 배우고 있는 언어를 추가하거나 발전시키는 것을 도와주세요.</a>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">Download</p>
              <div className="flex gap-4 items-center">
                <Button text="Desktop App" onClick={()=>console.log('desktop')} black/>
                <Button text="Android App" onClick={()=>console.log('android')} black/>
                <Button text="Chrome Extension" onClick={()=>console.log('chrome')} black/>
              </div>
            </div>
          </section>

          {/* 목차 */}
          <nav className="bg-neutral-200 rounded-sm p-4 text-sm xl:fixed xl:right-8 xl:top-8 xl:w-60">
            <div className="grid gap-2 text-neutral-600">
              <a href="#demos" className="transition-colors hover:text-neutral-900">
                1. Demos
              </a>
              <a
                href="#objectives"
                className="transition-colors hover:text-neutral-900"
              >
                2. Objectives
              </a>
              <a href="#how" className="transition-colors hover:text-neutral-900">
                3. How to use & How it works
              </a>
              <a href="#contribute" className="transition-colors hover:text-neutral-900">
                4. Become a Contributor!
              </a>
            </div>
          </nav>

          {/* Demos */}
          <section id="demos" className="flex flex-col gap-7">
            <h2>1. Demos</h2>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex-1 flex flex-col gap-4">
                <img src="/landing/landing_2.png" className="grayscale brightness-120" />
                <p className="font-semibold">구조를 시각으로 보조</p>
                <p>문장의 핵심 구성요소<span className="text-sm">(nsubj, root, obj)</span>를 하이라이트합니다.</p>
                <p>목표 언어의 문법에 노출된 기간이 짧은 독자의 인지 부하를 낮춥니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_3.png" className="grayscale brightness-130"/>
                <p className="font-semibold">의미를 맥락으로 보조</p>
                <p>단어의 연관어 및 코퍼스 속 해당 단어가 등장한 문장을 재귀적으로 제시합니다.</p>
                <p>단어의 의미와 문장 내 역할을 문맥 속에서 추론하고 습득할 수 있도록 합니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_1.png" className="grayscale brightness-120"/>
                <p className="font-semibold">생성을 통계로 보조</p>
                <p>n-gram 모델을 이용한 다음 단어 추천과 prefix 기반 검색을 제공합니다.</p>
                <p>목표 언어를 사용하여 새로운 문장을 생성하도록 하되 백지에서 시작하지 않도록 합니다.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="flex">
                <div className="flex-1 border border-neutral-300">
                  <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex flex-col">
                        <p className="text-xs text-neutral-500">
                          구조를 시각으로 보조
                        </p>
                        <h3 className="mt-2 text-neutral-900">
                          Reading Inferface
                        </h3>
                      </div>
                      <p className="text-sm">클릭 가능한 토큰을</p>
                    </div>
                  </div>

                  <div className="h-[640px] min-h-0">
                    {demo ? (
                      <PageContent
                        blocks={demo.result.blocks}
                        lemmaInfo={demo.lemma_info}
                        panelData={panel}
                        setPanelData={setPanel}
                        annotations={annotations}
                        setAnnotations={setAnnotations}
                      />
                    ) : (
                      <DemoPlaceholder message={error ?? "Loading page demo..."} />
                    )}
                  </div>
                </div>

                <div className="flex-1 border border-neutral-300 border-l-0">
                  <div className="border-b border-neutral-200 px-5 py-4 md:px-6">
                    <p className="text-xs text-neutral-500">
                      의미를 맥락으로 보조
                    </p>
                    <h3 className="mt-2 font-source text-2xl text-neutral-900">
                      Connected lexical drill-down
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      pageview에서 선택한 lemma를 따라 related graph와 KWIC를 탐색한다.
                    </p>
                  </div>

                  <div className="h-[640px] min-h-0">
                    {demo && selectedLemma ? (
                      <Desk
                        key={selectedLemma.key}
                        initialLemma={selectedLemma}
                        onToggleFavorite={async () => {}}
                        language={demo.language}
                      />
                    ) : (
                      <DemoPlaceholder message={error ?? "Loading lemma demo..."} />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="border border-neutral-300 bg-neutral-50 p-5 md:p-6">
                <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs text-neutral-500">
                      생성을 통계로 보조
                    </p>
                    <h3 className="mt-2 font-source text-2xl text-neutral-900">
                      Live composition surface
                    </h3>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-neutral-600">
                    문맥 기반 추천과 plain textarea 전환을 같은 입력기 안에서 보여준다.
                  </p>
                </div>

                <div className="mt-5 h-[360px]">
                  {demo ? (
                    <NgramToggleInput
                      value={composerValue}
                      onChange={setComposerValue}
                      defaultOn={true}
                      pageLanguage="en"
                      background={true}
                      languageOptions={fixedLanguageOptions}
                    />
                  ) : (
                    <DemoPlaceholder message={error ?? "Loading n-gram demo..."} />
                  )}
                </div>
              </div>

            </div>

          </section>
        </div>

      </div>
    </main>
  );
}

function DemoPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

export default LandingApp;
