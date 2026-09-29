import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { ThemeProvider } from "./lib/theme.js";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./index.css";

const queryClient = new QueryClient({
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster richColors position="bottom-right" />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
