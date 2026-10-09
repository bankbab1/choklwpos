import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "./hooks/ConfirmProvider.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();
// Pages cannot rewrite nested URLs; hash routes keep refreshes on index.html.
const Router = import.meta.env.BASE_URL === "/" ? BrowserRouter : HashRouter;

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

        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>

      </ConfirmProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
