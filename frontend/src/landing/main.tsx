import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { CSSProperties } from "react";
import "../index.css";
import LandingApp from "./LandingApp";
import { applyTheme } from "../components/useTheme";
import { I18nProvider, resolveInitialLocale } from "../i18n";

applyTheme("light");
const initialLocale = resolveInitialLocale();
const PRIVACY_PATH = "/chrome-extension-privacy";

function ChromeExtensionPrivacyPage() {
  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <h1 style={titleStyle}>Nautilus Chrome 확장 프로그램 개인정보처리방침</h1>
        <p style={paragraphStyle}>최종 업데이트: 2026년 7월 17일</p>
        <p style={paragraphStyle}>
          Nautilus Chrome 확장 프로그램(이하 &quot;확장 프로그램&quot;)은 Nautilus 앱과 연동하여 웹페이지의 선택
          텍스트를 분석하고 저장하는 기능을 제공합니다. 본 개인정보처리방침은 확장 프로그램이 어떤 정보를 처리하는지,
          어떤 목적으로 사용하는지, 누구와 공유하는지를 설명합니다.
        </p>

        <section>
          <h2 style={sectionTitleStyle}>1. 처리하는 정보</h2>
          <p style={paragraphStyle}>
            확장 프로그램은 로그인 시 사용자가 입력한 이메일 주소와 비밀번호, 회원가입 시 이름과 이메일 주소를 처리할
            수 있습니다.
          </p>
          <p style={paragraphStyle}>
            확장 프로그램은 로그인 후 발급된 인증 토큰을 브라우저의 확장 프로그램 저장소에 보관할 수 있습니다.
          </p>
          <p style={paragraphStyle}>
            확장 프로그램은 사용자가 직접 선택한 웹페이지 텍스트와, 저장을 실행한 시점의 현재 페이지 URL을 처리할 수
            있습니다.
          </p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>2. 정보를 처리하는 시점</h2>
          <p style={paragraphStyle}>로그인 시 계정 인증을 위해 이메일 주소와 비밀번호를 처리합니다.</p>
          <p style={paragraphStyle}>
            사용자가 저장 기능을 실행할 때만 선택한 텍스트와 현재 페이지 URL을 처리합니다.
          </p>
          <p style={paragraphStyle}>
            사용자가 로그아웃하거나 세션이 만료될 때 인증 정보를 삭제하거나 갱신할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>3. 정보 이용 목적</h2>
          <p style={paragraphStyle}>사용자 계정 로그인 및 인증 유지</p>
          <p style={paragraphStyle}>선택한 텍스트의 분석 기능 제공</p>
          <p style={paragraphStyle}>분석 결과와 페이지를 Nautilus 앱 또는 Nautilus 서비스에 저장</p>
          <p style={paragraphStyle}>저장된 페이지를 Nautilus 앱에서 다시 열 수 있도록 지원</p>
          <p style={paragraphStyle}>서비스 보안 유지, 오류 대응, 기능 안정성 확보</p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>4. 정보 공유 및 제공</h2>
          <p style={paragraphStyle}>
            확장 프로그램은 위 목적 달성을 위해 필요한 범위에서만 Nautilus 앱, Nautilus 로컬 서비스, Nautilus 서버와
            정보를 공유할 수 있습니다.
          </p>
          <p style={paragraphStyle}>
            당사는 사용자의 정보를 판매하지 않으며, 개인 맞춤 광고 또는 제3자 광고 목적에 사용하지 않습니다.
          </p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>5. 로컬 통신에 관한 안내</h2>
          <p style={paragraphStyle}>
            확장 프로그램은 Nautilus 데스크톱 앱과 연동하기 위해 사용자의 기기에서 실행 중인 로컬 서비스와 통신할 수
            있습니다. 이 통신은 확장 프로그램의 핵심 기능 제공을 위한 목적에 한해 이루어집니다.
          </p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>6. 보관 및 삭제</h2>
          <p style={paragraphStyle}>
            인증 토큰은 브라우저의 확장 프로그램 저장소에 저장될 수 있으며, 사용자는 로그아웃을 통해 이를 제거할 수
            있습니다.
          </p>
          <p style={paragraphStyle}>
            서버에 저장된 페이지 및 계정 관련 정보의 삭제는 Nautilus 서비스 정책에 따르며, 삭제 요청은 아래 문의처를
            통해 접수할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>7. 이용자의 선택</h2>
          <p style={paragraphStyle}>
            사용자는 로그인하지 않은 상태로 확장 프로그램의 일부 화면을 사용할 수 있습니다.
          </p>
          <p style={paragraphStyle}>저장 기능은 사용자의 명시적인 실행이 있을 때만 동작합니다.</p>
          <p style={paragraphStyle}>사용자는 언제든지 확장 프로그램을 제거할 수 있습니다.</p>
        </section>

        <section>
          <h2 style={sectionTitleStyle}>8. 문의처</h2>
          <p style={paragraphStyle}>개인정보 처리에 관한 문의: solmi.dev@gmail.com</p>
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: "48px 20px 80px",
};

const contentStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "0 auto",
  wordBreak: "keep-all",
  overflowWrap: "break-word",
};

const titleStyle: CSSProperties = {
  fontSize: "2rem",
  fontWeight: 700,
  margin: "0 0 24px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  margin: "40px 0 14px",
};

const paragraphStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 400,
  margin: "0 0 14px",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale={initialLocale}>
      <BrowserRouter>
        {window.location.pathname === PRIVACY_PATH ? <ChromeExtensionPrivacyPage /> : <LandingApp />}
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
