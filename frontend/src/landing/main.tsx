import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../index.css";
import LandingApp from "./LandingApp";
import { applyTheme } from "../components/useTheme";
import { I18nProvider, resolveInitialLocale } from "../i18n";

applyTheme("light");
const initialLocale = resolveInitialLocale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale={initialLocale}>
      <BrowserRouter>
        <LandingApp />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
