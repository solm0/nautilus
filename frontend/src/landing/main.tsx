import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../index.css";
import LandingApp from "./LandingApp";
import {
  applyTheme,
  resolveInitialTheme,
  ThemeProvider,
} from "../components/useTheme";

applyTheme(resolveInitialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <LandingApp />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);