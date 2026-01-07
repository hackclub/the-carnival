"use client";

import { signIn } from "@/lib/auth-client";
import Header from "@/components/Header";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const callbackURL = useMemo(
    () => searchParams.get("callbackUrl") ?? "/",
    [searchParams],
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const startAuth = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);

    const { data, error } = await signIn.oauth2({
      providerId: "hackclub-identity",
      callbackURL,
      disableRedirect: true,
    });

    if (error) {
      setErrorText(error.message ?? "Sign-in failed. Please try again.");
      setIsLoading(false);
      return;
    }

    if (!data?.url) {
      setErrorText("Sign-in failed (no redirect URL). Please try again.");
      setIsLoading(false);
      return;
    }

    window.location.href = data.url;
  }, [callbackURL]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-carnival-red/10 via-transparent to-transparent" />
      <div className="absolute top-10 left-10 text-6xl float-animation select-none">
        🎪
      </div>
      <div
        className="absolute top-24 right-16 text-4xl float-animation select-none"
        style={{ animationDelay: "0.5s" }}
      >
        🎟️
      </div>
      <div
        className="absolute bottom-24 left-1/4 text-3xl float-animation select-none"
        style={{ animationDelay: "1s" }}
      >
        ✨
      </div>

      <Header showSectionLinks={false} />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg bg-card/90 backdrop-blur rounded-3xl p-10 card-glow border border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-carnival-red/20 flex items-center justify-center text-2xl">
              🎪
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground leading-tight">
                Sign in
              </h1>
              <p className="text-muted-foreground">
                Authenticate with Hack Club Identity to continue.
              </p>
            </div>
          </div>

          {errorText ? (
            <div className="mb-6 rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {errorText}
            </div>
          ) : null}

          <button
            type="button"
            onClick={startAuth}
            disabled={isLoading}
            className="w-full bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-full font-bold text-lg transition-all carnival-glow hover:scale-[1.02]"
          >
            {isLoading ? "Opening Hack Club Identity…" : "Continue with Hack Club"}
          </button>

          <p className="mt-6 text-xs text-muted-foreground">
            You’ll be redirected to Hack Club Identity and then returned here.
          </p>
        </div>
      </div>
    </div>
  );
}


