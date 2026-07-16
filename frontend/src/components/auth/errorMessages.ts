import { parseApiErrorDetail, type ApiErrorDetail } from "../../api";

const API_ERROR_MESSAGE_KEYS: Record<string, string> = {
  email_already_registered: "This email is already registered.",
  invalid_credentials: "Invalid email or password.",
  email_not_verified: "Please verify your email before logging in.",
  invalid_token: "This link is invalid or has expired.",
  user_not_found: "User not found.",
};

const RAW_ERROR_MESSAGE_KEYS: Record<string, string> = {
  "invalid credentials": "Invalid email or password.",
  "email already registered": "This email is already registered.",
  "email not verified": "Please verify your email before logging in.",
  "invalid token": "This link is invalid or has expired.",
  "user not found": "User not found.",
  "value is not a valid email address: An email address must have an @-sign.":
    "Enter a valid email address.",
};

function normalizeRawMessage(message: string) {
  return RAW_ERROR_MESSAGE_KEYS[message] || message;
}

export function resolveAuthMessage(detail: ApiErrorDetail) {
  const parsed = parseApiErrorDetail(detail);

  if (!parsed) {
    return "error";
  }

  if (parsed.code) {
    return API_ERROR_MESSAGE_KEYS[parsed.code] || parsed.message;
  }

  return normalizeRawMessage(parsed.message);
}
