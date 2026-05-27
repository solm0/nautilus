import { useEffect, useState } from "react";
import type { Annotation, LemmaData, OCRResponse } from "../components/pageTypes";
import type { SidePanelState } from "../components/pageview/PageView";
import Desk from "../components/lemma_expansions/Desk";
import PageContent from "../components/pageview/PageContent";
import NgramToggleInput from "../components/pageview/NgramToggleInput";
import Logotype from "../components/svgs/Logotype";
import Button from "../components/util/Button";
import ThemeToggle from "../components/util/ToggleButton";

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
        <header className="flex w-full items-center justify-between select-none">
          <div className="w-46">
            <Logotype className="fill-nt-blue stroke-0"/>
          </div>
          <ThemeToggle compact />
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
                데스크탑 앱, 모바일 앱, 크롬 익스텐션으로 구성되어 있으며 현재 러시아어, 독일어, 영어, 세르비아어, 마케도니아어, 알바니아어, 한국어, 일본어를 지원합니다.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">Download (준비 중입니다)</p>
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
              <a href="#use" className="transition-colors hover:text-neutral-900">
                3. How to use
              </a>
              <a href="#works" className="transition-colors hover:text-neutral-900">
                4. How it works
              </a>
              <a href="#contribute" className="transition-colors hover:text-neutral-900">
                5. Become a Contributor!
              </a>
            </div>
          </nav>

          {/* Demos */}
          <section id="demos" className="flex flex-col gap-7">
            <h2 className="font-source">1. Demos</h2>
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
                <p>단어의 연관어 및 코퍼스 속에서 해당 단어가 등장한 부분을 재귀적으로 보여줍니다.</p>
                <p>풍부한 문맥 속에서 단어의 의미와 문장 내 역할을 추론하고 습득할 수 있도록 합니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_1.png" className="grayscale brightness-120"/>
                <p className="font-semibold">생성을 통계로 보조</p>
                <p>n-gram 모델을 이용한 다음 단어 추천과 prefix 기반 검색을 제공합니다.</p>
                <p>목표 언어를 사용하여 새로운 문장을 생성하도록 하되 백지에서 시작하지 않도록 도와줍니다.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="flex">
                <div className="flex-1 shrink-0 border border-neutral-300">
                  <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-neutral-500">구조를 시각으로 보조</p>
                        <h3 className="text-neutral-900">Reading Inferface</h3>
                        <p className="text-sm">토큰을 클릭해 보세요.</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-[640px] min-h-0 p-4">
                    {demo ? (
                      <PageContent
                        blocks={demo.result.blocks}
                        lemmaInfo={demo.lemma_info}
                        panelData={panel}
                        language={demo.language}
                        setPanelData={setPanel}
                        annotations={annotations}
                        setAnnotations={setAnnotations}
                      />
                    ) : (
                      <DemoPlaceholder message={error ?? "Loading page demo..."} />
                    )}
                  </div>
                </div>

                <div className="flex-1 shrink-0 border border-neutral-300 border-l-0">
                  <div className="border-b border-neutral-200 px-5 py-4 md:px-6">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-neutral-500">
                          의미를 맥락으로 보조
                        </p>
                        <h3 className="text-neutral-900">
                          Lemma Expansion
                        </h3>
                        <p className="text-sm text-neutral-600">
                          선택한 단어의 연관어와 사용된 문장을 보여준다.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="h-[640px] min-h-0 p-4">
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
              
              <div className="border border-neutral-300 bg-neutral-50">
                <div className="flex flex-col gap-3 px-5 py-4 md:px-6 border-b border-neutral-200 pb-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-neutral-500">
                      생성을 통계로 보조
                    </p>
                    <h3 className="text-neutral-900">
                      N-gram writer
                    </h3>
                  </div>
                  <p className="text-sm text-neutral-600">
                    이전 단어와 입력 중인 단어를 기반으로 다음 단어를 추천해 준다.
                  </p>
                </div>

                <div className="mt-5 h-[360px] p-4">
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

          {/* Objectives */}
          <section id="objectives" className="flex flex-col gap-7">
            <h2 className="font-source">2. Objectives</h2>
            <h3>Nautilus를 이루는 핵심적인 아이디어</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <p className="font-semibold">확장 가능한 시스템</p>
                  <p>코퍼스와 구문 분석기만 있으면 거의 모든 언어로 큰 추가적 노력 없이 확장 가능한 시스템을 만든다. 특정 언어, 라이브러리, 코퍼스에 종속되지 않는다. 언어의 특성 Universal dependency를 이용한다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">언어 a를 사용해 언어 a를 이해</p>
                  <p>번역과 설명이라는 메타적인 레이어를 두는 대신, 코퍼스에서 찾을 수 있는 의미 있는 정보를 가능한 한 많이 찾아낸다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">검색의 병목 해소</p>
                  <p>학습자가 기대하거나 이해에 도움이 될 만한 정보들을 빠르게, 한 번에 제공하고 위치/맥락 상 비슷한 정보의 재귀적 탐색을 통해 사전과 원문 사이의 불필요한 왕복 과정을 제거한다.</p>
                </div>
              </div>
            </div>

            <h3 className="mt-7">타겟 유저</h3>
            <ul className="list-disc pl-6">
              <li>재미로 외국어를 배우는 사람</li>
              <li>자신의 나라에서 학습 자원이 많지 않은 언어에 관심을 갖는 사람</li>
              <li>외국어로 된 음악과 서적 등의 컨텐츠를 원문의 느낌 그대로 즐기고 싶은 사람</li>
              <li>알파벳 읽는 법, 대명사와 전치사 종류, 기본적 문장 구성법과 같이 목표 언어에 대한 기초 지식을 가지고 있는 사람</li>
            </ul>
          </section>

          {/* use */}
          <section id="use" className="flex flex-col gap-7">
            <h2 className="font-source">3. How to use</h2>

            <h3>입력</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1 flex flex-col gap-4">
                    <p className="font-semibold">직접 입력</p>
                    <p>직접 타이핑/붙여넣기로 입력</p>
                    <img src="" />
                  </div>
                  <div className="flex-1 relative flex flex-col gap-4">
                    <p className="font-semibold">음악 가사 입력</p>
                    <p>맥/안드로이드의 유튜브 뮤직, 스포티파이 등 애플리케이션에서 음악 재생 감지 → 자동으로 싱크된 가사 가져와 입력(일부 곡 불가)</p>
                    <img src="" />
                  </div>
                  <div className="flex-1 relative flex flex-col gap-4">
                    <p className="font-semibold">크롬 익스텐션</p>
                    <p>웹사이트에서 원하는 부분을 선택해 입력</p>
                    <img src="" />
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-7">그 외 기능</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1 flex flex-col gap-4">
                    <p className="font-semibold">Articulation - 조음 시각화</p>
                    <p>발음 기호와 발음 기관 애니메이션</p>
                    <img src="" />
                  </div>
                  <div className="flex-1 relative flex flex-col gap-4">
                    <p className="font-semibold">Pattern - 패턴 기반 검색</p>
                    <p>하나/여러 언어 간 비슷한 패턴의 문장 검색</p>
                    <img src="" />
                  </div>
                  <div className="flex-1 relative flex flex-col gap-4">
                    <p className="font-semibold">Mutual</p>
                    <p>mutual 관계의 유저와 감상평을 공유하기</p>
                    <img src="" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* works */}
          <section id="works" className="flex flex-col gap-7">
            <h2 className="font-source">4. How it works</h2>
            <div className="flex gap-4 flex-col md:flex-row">
                wortschatz-leipzig에서 관리하는 각 언어의 위키피디아, 웹 코퍼스를 사용합니다.
                전처리에서 build_lemmas, build_ngram, build_prefix_index를 하여 각 언어별 팩을 만듭니다.
                모든 언어 팩은 중앙서버와 github releases에 저장되어 있다가, 데스크탑 애플리케이션 유저가 언어 팩을 설치하면 로컬에 다운로드되고, 모바일 유저가 언어를 활성화하면 중앙서버에서 사용됩니다.
                ngram과 prefix는 이러쿵저러쿵 해서 만들어지고, lemmas는 lines, lemma index, lemma graph로 이루어지는데 이런저런 라이브러리를 쓰고 이런저런 토크나이징을 해서 이런 구조로 만들어지고 이런 식으로 참조됩니다.
            </div>
          </section>

          {/* contribute */}
          <section id="contribute" className="flex flex-col gap-7">
            <h2 className="font-source">5. Become a contributor!</h2>
            <div className="flex gap-4 flex-col md:flex-row">
              당신의 언어 또는 당신이 배우고 있는 언어를 추가하거나 발전시키는 것을 도와주세요.
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
