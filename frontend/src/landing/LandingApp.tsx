import { useEffect, useState } from "react";
import type { Annotation, LemmaData, OCRResponse } from "../components/pageTypes";
import type { SidePanelState } from "../components/pageview/PageView";
import Desk from "../components/lemma_expansions/Desk";
import PageContent from "../components/pageview/PageContent";
import NgramToggleInput from "../components/pageview/NgramToggleInput";
import Logotype from "../components/svgs/Logotype";
import Button from "../components/util/Button";
import ThemeToggle from "../components/util/ToggleButton";
import { ArrowDown } from "lucide-react";

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

        <div className="flex flex-col gap-21 h-auto overflow-y-scroll no-scrollbar pb-21">

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
              <p className="text-lg font-semibold">Download (6월 중 배포 예정)</p>
              <div className="flex gap-4 items-center">
                <Button text="Desktop App" disabled onClick={()=>console.log('desktop')} black/>
                <Button text="Android App" disabled onClick={()=>console.log('android')} black/>
                <Button text="Chrome Extension" disabled onClick={()=>console.log('chrome')} black/>
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
            <h2 className="font-serif text-4xl!">1. Demos</h2>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex-1 flex flex-col gap-4">
                <img src="/landing/landing_2.png" className="grayscale brightness-120" />
                <p className="font-semibold">구조를 시각으로 보조</p>
                <p>문장의 핵심 구성요소<span className="text-sm">(주어, 목적어, 서술어)</span>를 하이라이트합니다.</p>
                <ArrowDown size={15} />
                <p>목표 언어의 문법에 노출된 기간이 짧은 독자의 인지 부하를 낮춥니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_3.png" className="grayscale brightness-130"/>
                <p className="font-semibold">의미를 맥락으로 보조</p>
                <p>단어의 연관어 및 코퍼스 속에서 해당 단어가 등장한 부분을 재귀적으로 보여줍니다.</p>
                <ArrowDown size={15} />
                <p>풍부한 문맥 속에서 단어의 의미와 문장 내 역할을 추론하고 습득할 수 있도록 합니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_1.png" className="grayscale brightness-120"/>
                <p className="font-semibold">생성을 통계로 보조</p>
                <p>n-gram 모델을 이용한 다음 단어 추천과 prefix 기반 검색을 제공합니다.</p>
                <ArrowDown size={15} />
                <p>백지에서부터 생성을 시작하는 부담을 줄여 주며, 완전하지 않은 어휘 지식<span className="text-xs">(예: 앞부분만 기억남, 어떤 굴절 어미를 선택할지 모름)</span>을 보정할 수 있습니다.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="flex w-full overflow-hidden">
                <div className="flex-1 w-1/2 shrink-0 border border-neutral-300">
                  <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-neutral-500">구조를 시각으로 보조</p>
                        <h3 className="text-neutral-900">Reading Inferface</h3>
                        <p className="text-sm">진하게 표시된 단어를 클릭해 보세요.</p>
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

                <div className="flex-1 w-1/2 shrink-0 border border-neutral-300 border-l-0">
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
                          주변 단어들을 클릭해 보세요.
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
                        lemmaInfo={demo.lemma_info}
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
                      N-gram Editor
                    </h3>
                  </div>
                  <p className="text-sm text-neutral-600">
                    타이핑하거나, 추천된 단어를 클릭하여 문장을 만들어 보세요.
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
            <h2 className="font-serif text-4xl!">2. Objectives</h2>
            <h3>중심 목표</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <p className="font-semibold">언어의 보편적 특징을 이용</p>
                  <p>세계 여러 언어의 Universal Dependency 구조를 활용해, 해당 언어의 코퍼스와 구문 분석기만 있다면 많은 추가 작업 없이 새로운 언어로 확장할 수 있는 시스템을 목표로 합니다. 보편적 구조를 기반으로 하기 때문에 언어 간 비교 역시 가능합니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">언어 a를 사용해 언어 a를 이해</p>
                  <p>번역이나 별도의 설명 같은 메타적 레이어에 의존하기보다, 실제 코퍼스 안에서 발견할 수 있는 의미 있는 정보를 최대한 직접 탐색할 수 있도록 합니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">기존 검색 경험의 병목 해소</p>
                  <p>학습자가 기대하거나 이해에 도움이 되는 정보들을 빠르게 한 번에 제공하고, 위치와 맥락이 유사한 표현들을 재귀적으로 탐색할 수 있도록 하여 사전과 원문 사이를 반복적으로 오가는 비효율을 줄입니다.</p>
                </div>
              </div>
            </div>

            <h3 className="mt-7">타겟 유저</h3>
            <ul className="list-disc pl-6">
              <li>재미로 외국어를 배우는 사람</li>
              <li>학습 자원(강의, 교재 등)이 많지 않은 언어에 관심을 갖는 사람</li>
              <li>외국어로 된 음악과 서적 등의 컨텐츠를 원문의 느낌 그대로 즐기고 싶은 사람</li>
              <li>문자 읽는 법, 대명사와 전치사 종류, 기본적 문장 구성법과 같이 목표 언어에 대한 기초적 지식을 가지고 있는 사람</li>
            </ul>
          </section>

          {/* use */}
          <section id="use" className="flex flex-col gap-7">
            <h2 className="font-serif text-4xl!">3. How to use</h2>
            <p className="max-w-[40em]">읽고 싶은 텍스트를 입력하기만 하면 됩니다. Nautilus가 라벨링 작업을 마친 '페이지'를 저장합니다. 페이지에서 문장 구조 시각화, 단어 맥락 검색, 주석 작성, 조음 시각화, 패턴 기반 검색 등의 도구를 사용할 수 있습니다.</p>

            <h3>가능한 입력 경로</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <img src="/landing/landing_4.png" />
                  <p className="font-semibold">직접 입력</p>
                  <p>직접 타이핑/붙여넣기로 입력할 수 있습니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_5.png" />
                  <p className="font-semibold">음악 가사 입력</p>
                  <p>맥/안드로이드의 유튜브 뮤직, 스포티파이 등 애플리케이션에서 음악 재생을 감지하면 자동으로 LRCLIB에서 가사를 가져와 바로 저장, 분석할 수 있습니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_6.png" />
                  <p className="font-semibold">크롬 익스텐션을 사용해 입력</p>
                  <p>웹 서핑 중 원하는 텍스트 영역을 선택해 바로 저장, 분석할 수 있습니다.</p>
                </div>
              </div>
            </div>

            <h3 className="mt-7">또 다른 분석 도구와 기능들</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <img src="/landing/landing_7.png" />
                  <p className="font-semibold">Articulation - 조음 시각화</p>
                  <p>선택한 영역의 ipa(발음 기호)와 조음 기관의 상태를 애니메이션으로 보여줍니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_8.png" />
                  <p className="font-semibold">Pattern - 패턴 기반 검색</p>
                  <p>선택한 영역과 비슷한 패턴의 문장을 해당 언어 또는 다른 언어의 코퍼스 내에서 검색할 수 있습니다. 품사, 의존관계, 특정 표지어<span className="text-xs">(and, or, but, ...)</span> 기반으로 검색합니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_9.png" />
                  <p className="font-semibold">Mutual</p>
                  <p>Mutual 관계를 맺은 사용자와 주석을 공유하고 댓글을 주고받을 수 있습니다. 댓글 작성 시 또한 N-gram Editor의 도움을 받을 수 있습니다.</p>
                </div>
              </div>
            </div>
          </section>

          {/* works */}
          <section id="works" className="flex flex-col gap-7">
            <h2 className="font-serif text-4xl!">4. How it works</h2>
            <h3 className="mt-7">언어 팩</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>Wortschatz Leipzig에서 관리하는 언어별 위키피디아, 웹 코퍼스를 사용합니다.</li>
              <li>N-gram 모델, prefix 인덱스, lemma 사전을 포함한 언어별 데이터를 만듭니다. 이 데이터와 구문 분석 모델<span className="text-xs">(예: stanza, spacy, kiwi)</span> 파일이 하나의 언어 팩을 구성합니다.</li>
              <li>데스크탑 사용자는 로컬에 언어 팩을 설치하여 오프라인으로 분석 서비스를 이용할 수 있습니다. 모바일 사용자는 서버를 이용합니다.</li>
            </ul>
            <img src="/landing/landing_10.png" className="max-w-[40em]" />

            <h3 className="mt-7">N-gram 학습과 prefix 인덱스 생성</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>문장 코퍼스를 정규화하고 소문자화한 뒤 토큰으로 분리합니다. 언어별로 조금씩 다른 허용 문자, 하이픈 처리, 정규화 규칙을 적용합니다.</li>
              <li>문장 양끝에는 <span>', '</span> 같은 경계 토큰을 붙여 unigram, bigram, trigram 빈도를 셉니다.</li>
              <li>각 context마다 상위 후보만 남깁니다. raw count를 score로 정규화해 바로 추천에 쓸 수 있게 합니다.</li>
              <li>prefix 인덱스는 단어의 앞부분을 최대 5글자 정도 잘라 만들고, prefix별 상위 빈도 후보만 저장합니다.</li>
              <li>런타임 검색에서는 먼저 prefix 후보를 좁힌 뒤, 앞 문맥의 n-gram 점수와 섞어 추천 순서를 다시 정합니다.</li>
            </ul>
            <h3 className="mt-7">Lemma 사전 생성</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>문장 코퍼스를 형태소 분석해 각 토큰의 surface, lemma, 품사, 의존관계를 추출합니다.</li>
              <li>불용 품사와 지나치게 일반적인 lemma를 제거하고, `lemma + POS`를 하나의 key로 삼아 빈도와 등장 문장 id를 누적합니다.</li>
              <li>문장 속 의존관계에서 서로 연결된 lemma들을 모아 co-occurrence graph를 만들고, 빈도 보정을 거쳐 관련 lemma 후보를 계산합니다.</li>
              <li>각 lemma key에 대해 관련어 목록, 등장 빈도, 예문이 될 line id 집합을 저장합니다.</li>
              <li>최종적으로 line store, lemma stats, lemma graph가 함께 SQLite 언어 팩에 들어가고, lookup 시에는 이 미리 계산된 자료를 조합해 빠르게 응답합니다.</li>
            </ul>
            <h3 className="mt-7">분석 결과 예시</h3>
            <div className="flex flex-col gap-5 max-w-[48em]">
              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">POST /api/analyze</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>입력: 텍스트 block 배열과 언어</li>
                  <li>출력: 각 block에 token 배열을 붙인 결과</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2">{`{
  "blocks": [
    {
      "text": "Language opens a sentence.",
      "tokens": [
        { "surface": "Language", "lemma": "language", "pos": "NOUN", "dep": "nsubj" },
        { "surface": "opens", "lemma": "open", "pos": "VERB", "dep": "root" }
      ]
    }
  ]
}`}</pre>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">GET /api/predict, GET /api/search</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>predict: 현재 토큰 문맥에 맞는 다음 단어 후보 반환</li>
                  <li>search: prefix와 문맥을 함께 써서 후보 반환</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2">{`{
  "input": "language opens",
  "tokens": ["<s>", "language", "opens"],
  "predictions": [["a", 0.41], ["the", 0.18], ["new", 0.07]]
}`}</pre>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">POST /api/lookup</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>하나의 lemma key에 대한 related, kwic, favorite 여부 반환</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2">{`{
  "key": "language_NOUN",
  "global_key": "language/NOUN/en",
  "related": ["word_NOUN", "meaning_NOUN", "sentence_NOUN"],
  "kwic": [
    {
      "line_id": 2,
      "match_indices": [2],
      "tokens": [
        { "surface": "A", "lemma": "a", "pos": "DET", "dep": "det" },
        { "surface": "language", "lemma": "language", "pos": "NOUN", "dep": "nsubj" }
      ]
    }
  ],
  "is_favorite": false
}`}</pre>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">POST /api/lookup_batch</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>여러 lemma key를 한 번에 요청하고, key별 결과를 map 형태로 받습니다.</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2">{`{
  "language_NOUN": {
    "key": "language_NOUN",
    "related": ["word_NOUN", "meaning_NOUN"],
    "kwic": [{ "line_id": 2, "match_indices": [2], "tokens": [...] }],
    "is_favorite": false
  }
}`}</pre>
              </div>
            </div>
          </section>

          {/* contribute */}
          <section id="contribute" className="flex flex-col gap-7">
            <h2 className="font-serif text-4xl!">5. Become a contributor!</h2>
            <div className="flex gap-4 flex-col max-w-[40em]">
              <p>당신의 언어 또는 당신이 배우고 있는 언어를 Nautilus에 추가하거나 발전시키는 것을 도와주세요. 해당 언어에 매력을 느꼈던 이유나 학습하며 느꼈던 불편함 등 주관적인 이야기도 환영합니다.</p>
              <a href="mailto:solmi-@kookmin.ac.kr">solmi-@kookmin.ac.kr</a>
            </div>
            
          </section>


          <footer className="border-t border-neutral-300 h-56 text-sm text-neutral-400 pt-4"></footer>
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
