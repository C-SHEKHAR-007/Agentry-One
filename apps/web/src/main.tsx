import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { Provider as ReduxProvider } from "react-redux";
import App from "./app/routes.js";
import { store } from "./app/store";
import { SessionBootstrap } from "./features/auth/SessionBootstrap";
import { ThemeSync } from "./features/shell/theme";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReduxProvider store={store}>
      <ThemeSync />
      <SessionBootstrap />
      <BrowserRouter>
        <App />
        <Toaster richColors position="bottom-right" />
      </BrowserRouter>
    </ReduxProvider>
  </React.StrictMode>,
);
