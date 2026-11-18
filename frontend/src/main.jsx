import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./responsive.css";
import { initializeTheme, ThemeProvider } from "./Common_Component/ThemeContext";
import { applySettingsPreferences } from "./Pages/Dashboard/Member/settingsPreferences";

initializeTheme();
applySettingsPreferences();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
