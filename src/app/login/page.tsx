import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-carnival-dark flex items-center justify-center text-gray-300">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
