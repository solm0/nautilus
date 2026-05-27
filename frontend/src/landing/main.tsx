import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../index.css";
import LandingApp from "./LandingApp";
import { applyTheme } from "../components/useTheme";

applyTheme("light");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LandingApp />
    </BrowserRouter>
  </StrictMode>,
);
