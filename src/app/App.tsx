import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme";

import { router } from "./router";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry only transient failures; 4xx answers will not change on retry.
        retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.status >= 500 || error.status === 0),
      },
    },
  });
}

export function App() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
