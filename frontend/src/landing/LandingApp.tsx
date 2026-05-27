import { useEffect, useState } from "react";
import type { Annotation, LemmaData, OCRResponse } from "../components/pageTypes";
import type { SidePanelState } from "../components/pageview/PageView";
import Desk from "../components/lemma_expansions/Desk";
import PageContent from "../components/pageview/PageContent";
import NgramToggleInput from "../components/pageview/NgramToggleInput";
import Logotype from "../components/svgs/Logotype";
import Button from "../components/util/Button";
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
                Nautilus<span className="text-sm font-medium">[노틸러스]</span>는 외국어의 문자 체계, 발음, 생성 규칙에 흥미를 느끼는 사용자를 위한 읽기 도구입니다.
                복잡한 사전 지식이 없어도 텍스트를 직접 탐색하고, 번역기에 덜 의존한 채 목표 언어를 읽고 써 볼 수 있도록 돕습니다.
              </p>
              <p>
                데스크탑 앱, 모바일 앱, 크롬 익스텐션으로 구성되어 있으며, 현재 러시아어, 독일어, 영어, 세르비아어, 마케도니아어, 알바니아어, 한국어, 일본어를 지원합니다.
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
            <h2 className="font-serif text-4xl! pt-8">1. Demos</h2>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex-1 flex flex-col gap-4">
                <img src="/landing/landing_2.png" className="grayscale brightness-120" />
                <p className="font-semibold">구조를 시각으로 보조</p>
                <p>문장의 핵심 구성요소<span className="text-sm">(주어, 목적어, 서술어)</span>를 시각적으로 강조합니다.</p>
                <ArrowDown size={15} />
                <p>목표 언어 문법에 아직 익숙하지 않은 독자의 인지 부하를 낮춥니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_3.png" className="grayscale brightness-130"/>
                <p className="font-semibold">의미를 맥락으로 보조</p>
                <p>연관어와 코퍼스 예문을 따라가며 단어가 실제로 쓰이는 맥락을 보여줍니다.</p>
                <ArrowDown size={15} />
                <p>풍부한 문맥 속에서 단어의 의미와 문장 안에서의 역할을 스스로 추론할 수 있게 합니다.</p>
              </div>
              <div className="flex-1 relative flex flex-col gap-4">
                <img src="/landing/landing_1.png" className="grayscale brightness-120"/>
                <p className="font-semibold">생성을 통계로 보조</p>
                <p>n-gram 모델을 이용한 다음 단어 추천과 prefix 기반 검색을 제공합니다.</p>
                <ArrowDown size={15} />
                <p>백지에서 문장을 시작하는 부담을 줄이고, 불완전한 어휘 지식<span className="text-xs">(예: 앞부분만 기억남, 굴절 어미가 헷갈림)</span>을 보완해 줍니다.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="flex w-full overflow-hidden">
                <div className="flex-1 w-1/2 shrink-0 border border-neutral-300">
                  <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-neutral-500">구조를 시각으로 보조</p>
                        <h3 className="text-neutral-900">Reading Interface</h3>
                        <p className="text-sm">강조된 단어를 클릭해 보세요.</p>
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
                          주변 단어를 따라가며 확장해 보세요.
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
                    직접 타이핑하거나 추천 단어를 눌러 문장을 이어 보세요.
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
            <h2 className="font-serif text-4xl! pt-8">2. Objectives</h2>
            <h3>중심 목표</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <p className="font-semibold">언어의 보편적 특징을 이용</p>
                  <p>Universal Dependency 구조를 활용해, 해당 언어의 코퍼스와 구문 분석기만 있다면 큰 구조 변경 없이 새로운 언어로 확장할 수 있는 시스템을 지향합니다. 같은 기반을 쓰기 때문에 언어 간 비교도 가능합니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">언어 a를 사용해 언어 a를 이해</p>
                  <p>번역이나 별도의 해설에 의존하기보다, 실제 코퍼스 안에서 발견되는 단서들을 직접 탐색하며 이해할 수 있도록 돕습니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <p className="font-semibold">기존 검색 경험의 병목 해소</p>
                  <p>이해에 필요한 정보를 한 번에 모아 보여 주고, 비슷한 맥락의 표현을 연쇄적으로 탐색할 수 있게 하여 사전과 원문 사이를 반복해서 오가는 비효율을 줄입니다.</p>
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
            <h2 className="font-serif text-4xl! pt-8">3. How to use</h2>
            <p className="max-w-[40em]">읽고 싶은 텍스트를 입력하면 Nautilus가 라벨링된 하나의 페이지로 저장합니다. 이후 페이지 안에서 문장 구조 시각화, 단어 맥락 검색, 주석 작성, 조음 시각화, 패턴 기반 검색 같은 도구를 바로 사용할 수 있습니다.</p>

            <h3>가능한 입력 경로</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <img src="/landing/landing_4.png" />
                  <p className="font-semibold">직접 입력</p>
                  <p>텍스트를 직접 입력하거나 붙여넣어 바로 분석할 수 있습니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_5.png" />
                  <p className="font-semibold">음악 가사 입력</p>
                  <p>맥과 안드로이드에서 유튜브 뮤직, 스포티파이 등의 재생을 감지하면 LRCLIB에서 가사를 불러와 바로 저장하고 분석할 수 있습니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_6.png" />
                  <p className="font-semibold">크롬 익스텐션을 사용해 입력</p>
                  <p>웹에서 원하는 텍스트 영역을 선택해 바로 저장하고 분석할 수 있습니다.</p>
                </div>
              </div>
            </div>

            <h3 className="mt-7">또 다른 분석 도구와 기능들</h3>
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <img src="/landing/landing_7.png" />
                  <p className="font-semibold">Articulation - 조음 시각화</p>
                  <p>선택한 구간의 IPA<span className="text-xs">(발음 기호)</span>와 조음 기관의 상태를 애니메이션으로 보여줍니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_8.png" />
                  <p className="font-semibold">Pattern - 패턴 기반 검색</p>
                  <p>선택한 구간과 비슷한 패턴의 문장을 같은 언어 또는 다른 언어의 코퍼스에서 찾을 수 있습니다. 품사, 의존관계, 특정 표지어<span className="text-xs">(and, or, but, ...)</span>를 기준으로 검색합니다.</p>
                </div>
                <div className="flex-1 relative flex flex-col gap-4">
                  <img src="/landing/landing_9.png" />
                  <p className="font-semibold">Mutual</p>
                  <p>Mutual 관계를 맺은 사용자와 주석을 공유하고 댓글을 주고받을 수 있습니다. 댓글을 쓸 때도 N-gram Editor를 사용할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </section>

          {/* works */}
          <section id="works" className="flex flex-col gap-7">
            <h2 className="font-serif text-4xl! pt-8">4. How it works</h2>
            <h3 className="mt-7">언어 팩</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>Wortschatz Leipzig에서 관리하는 언어별 위키피디아, 웹 코퍼스를 사용합니다.</li>
              <li>N-gram 모델, prefix 인덱스, lemma 사전 등 언어별 데이터를 만들고, 이를 구문 분석 모델<span className="text-xs">(예: stanza, spacy, kiwi)</span> 파일과 함께 하나의 언어 팩으로 묶습니다.</li>
              <li>데스크탑에서는 언어 팩을 로컬에 설치해 오프라인으로 분석할 수 있고, 모바일에서는 서버를 통해 같은 기능을 사용합니다.</li>
            </ul>
            <img src="/landing/landing_10.png" className="max-w-[40em]" />

            <h3 className="mt-7">N-gram 학습과 prefix 인덱스 생성</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>문장 코퍼스를 정규화하고 소문자화한 뒤 토큰으로 분리합니다. 허용 문자, 하이픈 처리, 정규화 방식은 언어별 규칙을 따릅니다.</li>
              <li>문장 양끝에 경계 토큰을 붙이고 unigram, bigram, trigram 빈도를 셉니다.</li>
              <li>각 문맥<span className="text-xs">(context)</span>마다 상위 후보만 남기고, raw count를 score로 정규화해 추천에 바로 쓸 수 있게 합니다.</li>
              <li>prefix 인덱스는 단어 앞부분을 최대 5글자 정도까지 잘라 만들고, prefix별 상위 빈도 후보만 저장합니다.</li>
              <li>런타임에서는 먼저 prefix로 후보를 좁힌 뒤, 앞 문맥의 n-gram 점수와 결합해 추천 순서를 다시 정합니다.</li>
            </ul>
            <h3 className="mt-7">Lemma 사전 생성</h3>
            <ul className="max-w-[44em] leading-[1.7em] pl-6 list-disc">
              <li>문장 코퍼스를 형태소 분석해 각 토큰의 surface, lemma, 품사, 의존관계를 추출합니다.</li>
              <li>불용 품사와 지나치게 일반적인 lemma를 제거하고, `lemma + POS`를 하나의 key로 삼아 빈도와 등장 문장 id를 누적합니다.</li>
              <li>문장 안에서 서로 연결된 lemma들을 모아 co-occurrence graph를 만들고, 빈도 보정을 거쳐 관련 lemma 후보를 계산합니다.</li>
              <li>각 lemma key에 대해 관련어 목록, 등장 빈도, 예문으로 쓸 수 있는 line id 집합을 저장합니다.</li>
              <li>최종적으로 line store, lemma stats, lemma graph가 함께 SQLite 언어 팩에 들어가며, lookup 시에는 이 미리 계산된 자료를 조합해 빠르게 응답합니다.</li>
            </ul>
            <h3 className="mt-7">분석 결과 예시</h3>
            <div className="flex flex-col gap-5 max-w-[48em]">
              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">POST /api/analyze</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>입력: 텍스트 block 배열과 언어</li>
                  <li>출력: 각 block에 token 배열을 붙인 분석 결과</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2 rounded-sm">{`{
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
                  <li>predict: 현재 문맥에 맞는 다음 단어 후보를 반환합니다.</li>
                  <li>search: prefix와 문맥을 함께 사용해 후보를 반환합니다.</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2 rounded-sm">{`{
  "input": "language opens",
  "tokens": ["<s>", "language", "opens"],
  "predictions": [["a", 0.41], ["the", 0.18], ["new", 0.07]]
}`}</pre>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-semibold font-mono text-sm">POST /api/lookup</p>
                <ul className="leading-[1.7em] pl-6 list-disc">
                  <li>하나의 lemma key에 대해 related, KWIC, favorite 여부를 반환합니다.</li>
                </ul>
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2 rounded-sm">{`{
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
                <pre className="text-sm whitespace-pre-wrap bg-neutral-200 p-2 rounded-sm">{`{
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
            <h2 className="font-serif text-4xl! pt-8">5. Become a contributor!</h2>
            <div className="flex gap-4 flex-col max-w-[40em]">
              <p>당신의 언어, 혹은 지금 배우고 있는 언어를 Nautilus에 추가하고 발전시키는 일을 함께해 주세요. 그 언어에 매력을 느낀 이유나 학습하면서 겪은 불편 등 주관적인 이야기 역시 큰 도움이 됩니다.</p>
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
