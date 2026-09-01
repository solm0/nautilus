import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { CENTRAL_API } from "../api";

type Locale = "en" | "ko";

type Copy = {
  title: string;
  intro: string;
  warningTitle: string;
  warningItems: string[];
  email: string;
  password: string;
  confirmation: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  invalidCredentials: string;
  emailNotVerified: string;
  genericError: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    title: "Delete your Lema account",
    intro:
      "Enter the email address and password for your Lema account. Your credentials are used only to verify account ownership before deletion.",
    warningTitle: "This action is permanent",
    warningItems: [
      "Your account and profile will be deleted.",
      "Cloud interests will be deleted. Local pages, notebooks, and annotations on your devices will remain.",
      "Deleted data cannot be restored.",
    ],
    email: "Email address",
    password: "Password",
    confirmation: "I understand that my account and related data will be permanently deleted.",
    submit: "Delete account permanently",
    submitting: "Deleting account…",
    successTitle: "Your account has been deleted",
    successBody: "Your Lema account and related server data were deleted successfully. Local libraries on your devices remain.",
    invalidCredentials: "The email address or password is incorrect.",
    emailNotVerified: "Verify your email address before deleting your account.",
    genericError: "We could not delete your account. Please try again.",
  },
  ko: {
    title: "Lema 계정 삭제",
    intro:
      "Lema 계정의 이메일 주소와 비밀번호를 입력해 주세요. 입력한 인증 정보는 계정 소유자를 확인한 뒤 계정을 삭제하는 데에만 사용됩니다.",
    warningTitle: "삭제 후에는 되돌릴 수 없습니다",
    warningItems: [
      "계정과 프로필이 삭제됩니다.",
      "클라우드 즐겨찾기가 삭제됩니다. 기기의 로컬 페이지, 노트북, 주석은 유지됩니다.",
      "삭제된 데이터는 복구할 수 없습니다.",
    ],
    email: "이메일 주소",
    password: "비밀번호",
    confirmation: "계정과 관련 데이터가 영구적으로 삭제되는 것을 이해했습니다.",
    submit: "계정 영구 삭제",
    submitting: "계정 삭제 중…",
    successTitle: "계정이 삭제되었습니다",
    successBody: "Lema 계정과 서버에 저장된 관련 데이터가 삭제되었습니다. 기기의 로컬 라이브러리는 유지됩니다.",
    invalidCredentials: "이메일 주소 또는 비밀번호가 올바르지 않습니다.",
    emailNotVerified: "계정을 삭제하려면 먼저 이메일 인증을 완료해 주세요.",
    genericError: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

type ErrorDetail = {
  code?: string;
  message?: string;
};

async function readErrorDetail(response: Response): Promise<ErrorDetail> {
  const payload = await response.json().catch(() => null) as {
    detail?: string | ErrorDetail;
  } | null;

  if (!payload?.detail) return {};
  if (typeof payload.detail === "string") return { message: payload.detail };
  return payload.detail;
}

function resolveErrorMessage(detail: ErrorDetail, messages: Copy) {
  if (detail.code === "invalid_credentials" || detail.message === "invalid credentials") {
    return messages.invalidCredentials;
  }
  if (detail.code === "email_not_verified" || detail.message === "email not verified") {
    return messages.emailNotVerified;
  }
  return messages.genericError;
}

export default function AccountDeletionPage() {
  const [locale, setLocale] = useState<Locale>("ko");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  const messages = copy[locale];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !confirmed) return;

    setSubmitting(true);
    setError("");

    try {
      const deleteResponse = await fetch(`${CENTRAL_API}/account-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!deleteResponse.ok) {
        const detail = await readErrorDetail(deleteResponse);
        setError(resolveErrorMessage(detail, messages));
        return;
      }

      setPassword("");
      setDeleted(true);
    } catch {
      setError(messages.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={localeRowStyle}>
          <button type="button" onClick={() => setLocale("en")} style={locale === "en" ? activeLocaleStyle : localeStyle}>
            EN
          </button>
          <button type="button" onClick={() => setLocale("ko")} style={locale === "ko" ? activeLocaleStyle : localeStyle}>
            KO
          </button>
        </div>

        {deleted ? (
          <section aria-live="polite">
            <h1 style={titleStyle}>{messages.successTitle}</h1>
            <p style={bodyStyle}>{messages.successBody}</p>
          </section>
        ) : (
          <>
            <h1 style={titleStyle}>{messages.title}</h1>
            <p style={bodyStyle}>{messages.intro}</p>

            <section style={warningStyle}>
              <h2 style={warningTitleStyle}>{messages.warningTitle}</h2>
              <ul style={warningListStyle}>
                {messages.warningItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <form onSubmit={handleSubmit} style={formStyle}>
              <label style={labelStyle}>
                {messages.email}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={submitting}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                {messages.password}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  style={inputStyle}
                />
              </label>

              <label style={confirmationStyle}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  required
                  disabled={submitting}
                />
                <span>{messages.confirmation}</span>
              </label>

              {error ? <p role="alert" style={errorStyle}>{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !confirmed || !email.trim() || !password}
                style={{
                  ...deleteButtonStyle,
                  opacity: submitting || !confirmed || !email.trim() || !password ? 0.45 : 1,
                }}
              >
                {submitting ? messages.submitting : messages.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "56px 20px 80px",
  color: "#171717",
};

const cardStyle: CSSProperties = {
  maxWidth: "680px",
  margin: "0 auto",
  padding: "36px",
  background: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "16px",
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.06)",
  wordBreak: "keep-all",
  overflowWrap: "break-word",
};

const localeRowStyle: CSSProperties = { marginBottom: "24px" };
const localeStyle: CSSProperties = { marginRight: "12px", color: "#737373" };
const activeLocaleStyle: CSSProperties = { ...localeStyle, color: "#171717", fontWeight: 700 };
const titleStyle: CSSProperties = { margin: "0 0 16px", fontSize: "2rem", lineHeight: 1.25, fontWeight: 700 };
const bodyStyle: CSSProperties = { margin: 0, color: "#525252", fontSize: "1rem", lineHeight: 1.7 };
const warningStyle: CSSProperties = { margin: "28px 0", padding: "20px", borderRadius: "12px", background: "#fff1f2", color: "#881337" };
const warningTitleStyle: CSSProperties = { margin: "0 0 10px", fontSize: "1rem", fontWeight: 700 };
const warningListStyle: CSSProperties = { margin: 0, paddingLeft: "20px", lineHeight: 1.7 };
const formStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "20px" };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.95rem", fontWeight: 600 };
const inputStyle: CSSProperties = { width: "100%", border: "1px solid #d4d4d4", borderRadius: "8px", padding: "12px 14px", fontSize: "1rem", fontWeight: 400, outlineColor: "#737373" };
const confirmationStyle: CSSProperties = { display: "flex", alignItems: "flex-start", gap: "10px", color: "#404040", fontSize: "0.92rem", lineHeight: 1.55 };
const errorStyle: CSSProperties = { margin: 0, color: "#b91c1c", fontSize: "0.92rem" };
const deleteButtonStyle: CSSProperties = { alignSelf: "flex-start", border: 0, borderRadius: "8px", padding: "12px 18px", background: "#b91c1c", color: "#ffffff", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" };
