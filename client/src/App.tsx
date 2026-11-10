import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Research from "./pages/Research";
import Academy from "./pages/Academy";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import LegalPage from "./pages/LegalPage";
import { CookieConsent } from "./components/fintel/CookieConsent";
import { useLocation } from "wouter";

const workspacePaths = new Set([
  "/markets", "/yield-curve", "/fixed-income", "/derivatives",
  "/risk", "/portfolio", "/models", "/data", "/settings", "/about",
]);
const legalPaths = new Set(["/privacy", "/terms", "/cookies", "/disclaimer", "/security"]);

export default function App() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const isLogin = path === "/login";
  const page = isLogin
    ? <Login />
    : path === "/research"
      ? <Research />
      : path === "/academy"
        ? <Academy />
        : workspacePaths.has(path)
          ? <Workspace path={path} />
          : legalPaths.has(path)
            ? <LegalPage path={path} />
            : <Home />;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          {page}
          {!isLogin && <CookieConsent />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
