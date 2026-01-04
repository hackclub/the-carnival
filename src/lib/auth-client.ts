import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    genericOAuthClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
