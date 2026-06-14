import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6">
    <div className="text-center">
      <p className="label-mono">Error 404</p>
      <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-7 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
    </div>
  </div>
);

export default NotFound;
