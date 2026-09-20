import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Research from "./pages/Research";
import Academy from "./pages/Academy";
import Login from "./pages/Login";
import { useLocation } from "wouter";

export default function App() {
  const [location] = useLocation();

  const page =
    location === "/login"
      ? <Login />
      : location === "/research"
        ? <Research />
        : location === "/academy"
          ? <Academy />
          : <Home />;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          {page}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
