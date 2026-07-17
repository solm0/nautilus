/* eslint-disable react-refresh/only-export-components */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { CSSProperties } from "react";
import "../index.css";
import LandingApp from "./LandingApp";
import { applyTheme } from "../components/useTheme";
import { I18nProvider, resolveInitialLocale } from "../i18n";

applyTheme("light");
const initialLocale = resolveInitialLocale();
const DEV_LANDING_HOME_PATH = "/landing/index.html";
const DEV_PRIVACY_PATH = "/landing/chrome-extension-privacy/index.html";
const PROD_HOME_PATH = "/";
const PROD_PRIVACY_PATH = "/chrome-extension-privacy";

function isDevLandingPath(pathname: string) {
  return pathname.startsWith("/landing/");
}

function buildPrivacyHref(pathname: string) {
  return isDevLandingPath(pathname) ? DEV_PRIVACY_PATH : PROD_PRIVACY_PATH;
}

const currentPathname = window.location.pathname;
const privacyHref = buildPrivacyHref(currentPathname);

type PrivacyLocale = "en" | "ko";

const privacyCopy: Record<
  PrivacyLocale,
  {
    title: string;
    updatedAt: string;
    intro: string;
    sections: Array<{ heading: string; paragraphs: string[] }>;
  }
> = {
  en: {
    title: "Nautilus Chrome Extension Privacy Policy",
    updatedAt: "Last updated: July 17, 2026",
    intro:
      "The Nautilus Chrome Extension (the \"Extension\") works with the Nautilus app to analyze and save text selected from web pages. This Privacy Policy explains what information the Extension processes, why it is used, and with whom it may be shared.",
    sections: [
      {
        heading: "1. Information We Process",
        paragraphs: [
          "The Extension may process the email address and password entered during sign-in, and the name and email address entered during sign-up.",
          "The Extension may store the authentication token issued after sign-in in the browser extension storage.",
          "The Extension may process text that the user directly selects on a web page, along with the current page URL at the time the user chooses to save it.",
        ],
      },
      {
        heading: "2. When Information Is Processed",
        paragraphs: [
          "Email addresses and passwords are processed when a user signs in for account authentication.",
          "Selected text and the current page URL are processed only when the user explicitly runs the save action.",
          "Authentication information may be removed or refreshed when the user signs out or when a session expires.",
        ],
      },
      {
        heading: "3. Why Information Is Used",
        paragraphs: [
          "To sign users in and maintain authentication.",
          "To provide text analysis for content selected by the user.",
          "To save analyzed pages and results in the Nautilus app or Nautilus service.",
          "To open saved pages again in the Nautilus app.",
          "To maintain service security, reliability, and error handling.",
        ],
      },
      {
        heading: "4. Sharing and Disclosure",
        paragraphs: [
          "The Extension may share information only as needed with the Nautilus app, Nautilus local services, and Nautilus servers in order to provide its core functionality.",
          "We do not sell user information and do not use it for personalized advertising or third-party advertising purposes.",
        ],
      },
      {
        heading: "5. Local Communication",
        paragraphs: [
          "The Extension may communicate with a local service running on the user's device in order to work with the Nautilus desktop app. This communication is limited to the core functionality of the Extension.",
        ],
      },
      {
        heading: "6. Retention and Deletion",
        paragraphs: [
          "Authentication tokens may be stored in browser extension storage, and users can remove them by signing out.",
          "Pages and account-related data saved on the server can be deleted through the Nautilus desktop or mobile app.",
        ],
      },
      {
        heading: "7. User Choice",
        paragraphs: [
          "Users may access some Extension screens without signing in.",
          "The save function runs only when the user explicitly triggers it.",
          "Users may remove the Extension at any time.",
        ],
      },
      {
        heading: "8. Contact",
        paragraphs: ["solmii.jeong@gmail.com"],
      },
    ],
  },
  ko: {
    title: "Nautilus Chrome 확장 프로그램 개인정보처리방침",
    updatedAt: "최종 업데이트: 2026년 7월 17일",
    intro:
      "Nautilus Chrome 확장 프로그램(이하 \"확장 프로그램\")은 Nautilus 앱과 연동하여 웹페이지의 선택 텍스트를 분석하고 저장하는 기능을 제공합니다. 본 개인정보처리방침은 확장 프로그램이 어떤 정보를 처리하는지, 어떤 목적으로 사용하는지, 누구와 공유하는지를 설명합니다.",
    sections: [
      {
        heading: "1. 처리하는 정보",
        paragraphs: [
          "확장 프로그램은 로그인 시 사용자가 입력한 이메일 주소와 비밀번호, 회원가입 시 이름과 이메일 주소를 처리할 수 있습니다.",
          "확장 프로그램은 로그인 후 발급된 인증 토큰을 브라우저의 확장 프로그램 저장소에 보관할 수 있습니다.",
          "확장 프로그램은 사용자가 직접 선택한 웹페이지 텍스트와, 저장을 실행한 시점의 현재 페이지 URL을 처리할 수 있습니다.",
        ],
      },
      {
        heading: "2. 정보를 처리하는 시점",
        paragraphs: [
          "로그인 시 계정 인증을 위해 이메일 주소와 비밀번호를 처리합니다.",
          "사용자가 저장 기능을 실행할 때만 선택한 텍스트와 현재 페이지 URL을 처리합니다.",
          "사용자가 로그아웃하거나 세션이 만료될 때 인증 정보를 삭제하거나 갱신할 수 있습니다.",
        ],
      },
      {
        heading: "3. 정보 이용 목적",
        paragraphs: [
          "사용자 계정 로그인 및 인증 유지",
          "선택한 텍스트의 분석 기능 제공",
          "분석 결과와 페이지를 Nautilus 앱 또는 Nautilus 서비스에 저장",
          "저장된 페이지를 Nautilus 앱에서 다시 열 수 있도록 지원",
          "서비스 보안 유지, 오류 대응, 기능 안정성 확보",
        ],
      },
      {
        heading: "4. 정보 공유 및 제공",
        paragraphs: [
          "확장 프로그램은 위 목적 달성을 위해 필요한 범위에서만 Nautilus 앱, Nautilus 로컬 서비스, Nautilus 서버와 정보를 공유할 수 있습니다.",
          "당사는 사용자의 정보를 판매하지 않으며, 개인 맞춤 광고 또는 제3자 광고 목적에 사용하지 않습니다.",
        ],
      },
      {
        heading: "5. 로컬 통신에 관한 안내",
        paragraphs: [
          "확장 프로그램은 Nautilus 데스크톱 앱과 연동하기 위해 사용자의 기기에서 실행 중인 로컬 서비스와 통신할 수 있습니다. 이 통신은 확장 프로그램의 핵심 기능 제공을 위한 목적에 한해 이루어집니다.",
        ],
      },
      {
        heading: "6. 보관 및 삭제",
        paragraphs: [
          "인증 토큰은 브라우저의 확장 프로그램 저장소에 저장될 수 있으며, 사용자는 로그아웃을 통해 이를 제거할 수 있습니다.",
          "서버에 저장된 페이지 및 계정 관련 정보의 삭제는 Nautilus 데스크탑 또는 모바일 앱을 통해 할 수 있습니다.",
        ],
      },
      {
        heading: "7. 이용자의 선택",
        paragraphs: [
          "사용자는 로그인하지 않은 상태로 확장 프로그램의 일부 화면을 사용할 수 있습니다.",
          "저장 기능은 사용자의 명시적인 실행이 있을 때만 동작합니다.",
          "사용자는 언제든지 확장 프로그램을 제거할 수 있습니다.",
        ],
      },
      {
        heading: "8. 문의처",
        paragraphs: ["solmii.jeong@gmail.com"],
      },
    ],
  },
};

function ChromeExtensionPrivacyPage() {
  const [locale, setLocale] = useState<PrivacyLocale>("en");
  const copy = privacyCopy[locale];

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <h1 style={titleStyle}>{copy.title}</h1>
        <div style={localeToggleRowStyle}>
          <button
            type="button"
            onClick={() => setLocale("en")}
            style={locale === "en" ? activeLocaleButtonStyle : localeButtonStyle}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLocale("ko")}
            style={locale === "ko" ? activeLocaleButtonStyle : localeButtonStyle}
          >
            KO
          </button>
        </div>
        <p style={paragraphStyle}>{copy.updatedAt}</p>
        <p style={paragraphStyle}>{copy.intro}</p>

        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2 style={sectionTitleStyle}>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} style={paragraphStyle}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
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

const localeToggleRowStyle: CSSProperties = {
  margin: "0 0 18px",
};

const localeButtonStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 400,
  margin: "0 12px 0 0",
};

const activeLocaleButtonStyle: CSSProperties = {
  ...localeButtonStyle,
  fontWeight: 700,
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
        <Routes>
          <Route path={PROD_HOME_PATH} element={<LandingApp privacyHref={privacyHref} />} />
          <Route path={DEV_LANDING_HOME_PATH} element={<LandingApp privacyHref={privacyHref} />} />
          <Route path={PROD_PRIVACY_PATH} element={<ChromeExtensionPrivacyPage />} />
          <Route path={DEV_PRIVACY_PATH} element={<ChromeExtensionPrivacyPage />} />
          <Route path="*" element={<LandingApp privacyHref={privacyHref} />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
