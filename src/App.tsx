import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "./hooks/ConfirmProvider.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>

      {/* ✅ GLOBAL CONFIRM MODAL */}
      <ConfirmProvider>

        {/* Toast */}
        <Sonner
          position="top-center"
          toastOptions={{
            className: "pos-toast",
            duration: 1200,
          }}
        />

        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

      </ConfirmProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;