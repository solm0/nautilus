import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export type AppLocale = "en" | "ko";

type TranslationParams = Record<string, string | number>;

type I18nContextValue = {
  locale: AppLocale;
  t: (key: string, params?: TranslationParams) => string;
};

const STORAGE_KEY = "nautilus_settings";

const translations: Record<AppLocale, Record<string, string>> = {
  en: {},
  ko: {
    "Accept": "수락",
    "Activate": "활성화",
    "Activate a language to continue.": "계속하려면 언어를 활성화하세요.",
    "Activate {language} to continue.": "{language}를 활성화해 계속하세요.",
    "Activate only the languages you want to use on this device.": "이 기기에서 사용할 언어만 활성화하세요.",
    "Add a comment": "댓글 추가",
    "Add your thoughts...": "생각을 적어보세요...",
    "Already have an account?": "이미 계정이 있나요?",
    "Allow notifications?": "알림을 허용할까요?",
    "Annotations": "주석",
    "App version": "앱 버전",
    "Back to login": "로그인으로 돌아가기",
    "Cancel": "취소",
    "Change password": "비밀번호 변경",
    "Checking current playback...": "현재 재생 상태를 확인하는 중...",
    "Clear search": "검색 지우기",
    "Close": "닫기",
    "Close pages sidebar": "페이지 사이드바 닫기",
    "commented on your annotation": "님의 주석에 댓글을 남겼습니다",
    "copy text": "텍스트 복사",
    "Core": "코어",
    "Core installed": "코어 설치됨",
    "Create": "생성",
    "Create an account": "계정 만들기",
    "Create new link": "새 링크 만들기",
    "Create new memo": "새 메모 만들기",
    "Create Notebook": "노트북 만들기",
    "Create Page": "페이지 만들기",
    "Create page": "페이지 만들기",
    "Created:": "생성일:",
    "Deactivate": "비활성화",
    "Delete": "삭제",
    "Delete account": "계정 삭제",
    "Delete account?": "계정을 삭제할까요?",
    "Delete failed": "삭제하지 못했습니다",
    "Delete this annotation?": "이 주석을 삭제할까요?",
    "Delete this comment?": "이 댓글을 삭제할까요?",
    "Deleting...": "삭제 중...",
    "Deleting a folder will also delete the pages inside it.": "폴더를 삭제하면 그 안의 페이지도 함께 삭제됩니다.",
    "Done": "완료",
    "Do not close this window until installation is complete.": "설치가 끝날 때까지 이 창을 닫지 마세요.",
    "Download now": "지금 다운로드",
    "Downloading language pack...": "언어팩 다운로드 중...",
    "email": "이메일",
    "email sent.": "이메일을 보냈습니다.",
    "End of the list": "목록의 끝입니다",
    "enter your email and password.": "이메일과 비밀번호를 입력하세요.",
    "enter your email.": "이메일을 입력하세요.",
    "enter your name, email, and password.": "이름, 이메일, 비밀번호를 입력하세요.",
    "enter your new password.": "새 비밀번호를 입력하세요.",
    "Enter a valid email address.": "올바른 이메일 주소를 입력하세요.",
    "error": "오류",
    "Extracting language pack...": "언어팩 압축 해제 중...",
    "Failed to activate language.": "언어를 활성화하지 못했습니다.",
    "Failed to deactivate language.": "언어를 비활성화하지 못했습니다.",
    "Failed to fetch install progress.": "설치 진행 상태를 가져오지 못했습니다.",
    "Failed to start installation.": "설치를 시작하지 못했습니다.",
    "Failed to uninstall pack.": "팩을 제거하지 못했습니다.",
    "Fetching page...": "페이지를 불러오는 중...",
    "Fetching lemmas...": "lemma를 불러오는 중...",
    "Finalizing installation...": "설치 마무리 중...",
    "Forgot password?": "비밀번호를 잊으셨나요?",
    "folder": "폴더",
    "Get lyrics": "가사 가져오기",
    "Go to page": "페이지로 이동",
    "hide": "숨기기",
    "Install ": "설치 ",
    "Install Core": "코어 설치",
    "Install {language} pack to continue.": "{language} 팩을 설치해 계속하세요.",
    "Install languages to continue.": "계속하려면 언어를 설치하세요.",
    "Install Writing Assistant": "작문 보조 설치",
    "Installed successfully.": "설치 성공",
    "Installed, but failed to refresh the language list.": "설치는 완료됐지만 언어 목록을 새로고침하지 못했습니다.",
    "Installation complete.": "설치가 완료되었습니다.",
    "Installation failed.": "설치에 실패했습니다.",
    "Installing {modelLabel}...": "{modelLabel} 설치 중...",
    "Installing {modelLabel}... {percent}%": "{modelLabel} 설치 중... {percent}%",
    "Invalid email or password.": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Invalid URL": "유효하지 않은 URL입니다",
    "Latest": "최신",
    "lemma info": "lemma 정보",
    "Loading annotations...": "주석을 불러오는 중...",
    "Loading...": "불러오는 중...",
    "Looking for lyrics...": "가사를 찾는 중...",
    "Log out?": "로그아웃할까요?",
    "Login": "로그인",
    "Logout": "로그아웃",
    "Lyrics": "가사",
    "Lyrics were not found for the current track.": "현재 곡의 가사를 찾지 못했습니다.",
    "Me": "나",
    "more": "더보기",
    "Move": "이동",
    "Move {count} pages": "{count}개 페이지 이동",
    "Move page \"{name}\"": "페이지 \"{name}\" 이동",
    "My": "My",
    "My comments": "내 댓글",
    "My Comments": "내 댓글",
    "My Lemmas": "내 lemma",
    "My mutuals": "내 mutuals",
    "name": "이름",
    "new emoji": "새 이모지",
    "new link": "새 링크",
    "new memo": "새 메모",
    "Next": "다음",
    "No active track was detected. On macOS, supported players are the desktop Spotify app and Music app. On Android, any player exposing a media session should work after notification access is granted.": "활성 트랙이 감지되지 않았습니다. macOS에서는 데스크톱 Spotify 앱과 Music 앱을 지원합니다. Android에서는 알림 접근 권한을 허용하면 미디어 세션을 노출하는 플레이어를 사용할 수 있습니다.",
    "No matches found.": "검색 결과가 없습니다.",
    "No mutuals yet": "아직 mutuals가 없습니다",
    "Notifications": "알림",
    "Notifications are blocked on this device. Open settings.": "이 기기에서는 알림이 차단되어 있습니다. 설정을 열어주세요.",
    "now playing alerts": "지금 재생 알림",
    "Now": "방금",
    "No results": "결과 없음",
    "No track": "재생 중인 트랙 없음",
    "Notebook name": "노트북 이름",
    "Open notification settings": "알림 설정 열기",
    "Open pages": "페이지 열기",
    "Open permission settings": "권한 설정 열기",
    "page": "페이지",
    "Page name": "페이지 이름",
    "Page view": "페이지 보기",
    "Pages": "페이지",
    "pages": "페이지",
    "Paste text": "텍스트 붙여넣기",
    "Paste text here\n\nTip !!!\n\nAccuracy improves when punctuation and line breaks are used properly in sentences.": "여기에 텍스트를 붙여넣으세요\n\n팁\n\n문장 부호와 줄바꿈을 적절히 사용하면 정확도가 더 좋아집니다.",
    "password": "비밀번호",
    "Pinned": "고정됨",
    "Plain": "일반",
    "plain": "일반",
    "Playback access is not enabled": "재생 접근 권한이 비활성화되어 있습니다",
    "Playback detection is unavailable": "재생 감지를 사용할 수 없습니다",
    "Preferences": "환경설정",
    "Preparing installation...": "설치 준비 중...",
    "Preview will show here": "미리보기가 여기에 표시됩니다",
    "Profile": "프로필",
    "related": "연관어",
    "replied to your comment": "님의 댓글에 답글을 남겼습니다",
    "Request": "요청",
    "Request reset": "재설정 요청",
    "Requests": "요청",
    "Retry": "다시 시도",
    "Revert changes": "변경 취소",
    "Relaunch": "재실행",
    "root": "루트",
    "root (folder option)": "(루트)",
    "Running Stanza analysis...": "Stanza 분석 실행 중...",
    "Save": "저장",
    "Saved": "저장되었습니다",
    "Save changes": "변경 저장",
    "Save failed": "저장하지 못했습니다",
    "Save Page": "페이지 저장",
    "Saving...": "저장 중...",
    "Saving lyrics failed.": "가사를 저장하지 못했습니다.",
    "Search": "검색",
    "Select text to keep. Otherwise, all text will be used.": "유지할 텍스트를 선택하세요. 선택하지 않으면 전체 텍스트가 사용됩니다.",
    "Send request": "요청 보내기",
    "Sent": "보낸 요청",
    "Settings": "설정",
    "Sign up": "회원가입",
    "synced": "싱크됨",
    "System language": "시스템 언어",
    "Theme": "테마",
    "A new version({version}) is available.": "새 버전({version})을 사용할 수 있습니다.",
    "Android needs notification access to inspect active media sessions. macOS should work automatically with supported desktop players.": "Android에서는 활성 미디어 세션을 확인하려면 알림 접근 권한이 필요합니다. macOS는 지원되는 데스크톱 플레이어에서 자동으로 동작해야 합니다.",
    "Could not load latest version.": "최신 버전을 불러오지 못했습니다.",
    "Could not delete account.": "계정을 삭제하지 못했습니다.",
    "Language packs": "언어팩",
    "Mutuals": "Mutuals",
    "Pin": "고정",
    "Please verify your email before logging in.": "로그인하기 전에 이메일 인증을 완료해주세요.",
    "Post": "게시",
    "Remove Core and Writing Assistant": "코어와 작문 보조 제거",
    "Rename": "이름 변경",
    "Source": "출처",
    "Add metadata": "메타데이터 추가",
    "Edit": "수정",
    "installing": "설치 중",
    "This email is already registered.": "이미 가입된 이메일입니다.",
    "This build did not expose the local now-playing bridge on this platform yet.": "이 빌드에서는 아직 이 플랫폼에 로컬 now-playing 브리지를 노출하지 않았습니다.",
    "This link is invalid or has expired.": "이 링크가 유효하지 않거나 만료되었습니다.",
    "To reduce storage, keep a single language version.": "저장 공간을 줄이려면 언어 버전을 하나만 유지하세요.",
    "Unknown": "알 수 없음",
    "Unknown artist": "알 수 없는 아티스트",
    "Unknown user": "알 수 없는 사용자",
    "Unnamed": "이름 없음",
    "Unpin": "고정 해제",
    "User not found.": "사용자를 찾을 수 없습니다.",
    "We couldn't find this word.": "이 단어를 찾지 못했습니다.",
    "Writing Assistant": "작문 보조",
    "Writing Assistant installed": "작문 보조 설치됨",
    "Yes": "예",
    "You have no notifications": "알림이 없습니다",
    "Your data will all disappear. Pages, annotations, comments, mutuals, and saved language data will be removed permanently.": "모든 데이터가 사라집니다. 페이지, 주석, 댓글, mutuals, 저장된 언어 데이터가 영구적으로 삭제됩니다.",
    "You're adding a comment": "댓글을 작성하는 중입니다",
    "You're editing a comment": "댓글을 수정하는 중입니다",
    "your password was reset.": "비밀번호가 재설정되었습니다.",

    "German": "독일어",
    "English": "영어",
    "Japanese": "일본어",
    "Korean": "한국어",
    "Macedonian": "마케도니아어",
    "Russian": "러시아어",
    "Albanian": "알바니아어",
    "Serbian": "세르비아어"
  },
};

function replaceParams(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? `{${key}}` : String(value);
  });
}

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "en";

    const parsed = JSON.parse(raw) as {
      system_language?: string;
    };

    return parsed.system_language === "ko" ? "ko" : "en";
  } catch {
    return "en";
  }
}

export function resolveInitialLocale(): AppLocale {
  return readStoredLocale();
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => {
        const template = translations[locale][key] ?? key;
        return replaceParams(template, params);
      },
    }),
    [locale],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
