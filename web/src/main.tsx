import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MilestoneCelebrationProvider } from "./components/MilestoneCelebration";
import { ToastProvider } from "./components/Toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MilestoneCelebrationProvider>
          <App />
        </MilestoneCelebrationProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
