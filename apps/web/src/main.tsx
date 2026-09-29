import { QueryClientProvider } from "@tanstack/react-query";
import { BridgedQueryClient } from "./api/legacyQueryClient";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { Provider as ReduxProvider } from "react-redux";
import App from "./App.js";
import { store } from "./app/store";
import { SessionBootstrap } from "./features/auth/SessionBootstrap";
import { ThemeSync } from "./features/shell/theme";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./index.css";

const queryClient = new BridgedQueryClient({
  defaultOptions: {
    queries: {
      // A 4xx (not found / no access / bad request) won't fix itself on retry;
      // only retry transient failures so error states appear promptly.
      retry: (failureCount, error) => {
        const status = (error as Error & { status?: number }).status;
        return (status === undefined || status >= 500) && failureCount < 2;
      },
    },
  },
});

queryClient.bindStore(store.dispatch);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReduxProvider store={store}>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <SessionBootstrap />
      <BrowserRouter>
        <App />
        <Toaster richColors position="bottom-right" />
      </BrowserRouter>
    </QueryClientProvider>
    </ReduxProvider>
  </React.StrictMode>,
);
