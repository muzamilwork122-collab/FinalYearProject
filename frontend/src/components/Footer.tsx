import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container mx-auto flex flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
              <ScanLine className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">ScreenScan</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            AI phone-screen damage analysis with repair-cost estimates in PKR.
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <span className="label-mono mb-1">Pages</span>
          {[
            { label: "Home", to: "/" },
            { label: "Features", to: "/features" },
            { label: "Pricing", to: "/pricing" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto flex flex-col gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} ScreenScan — final-year project.</span>
          <span>Uploaded images are analysed, not shared.</span>
        </div>
      </div>
    </footer>
  );
}
