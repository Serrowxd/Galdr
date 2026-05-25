import type { OAuthStrategy } from "@clerk/shared/types";
import { neobrutalism } from "@clerk/ui/themes";

/** OAuth providers enabled for Galdr sign-in and account linking. */
export const GALDR_OAUTH_STRATEGIES = [
  "oauth_github",
  "oauth_gitlab",
  "oauth_bitbucket",
  "oauth_google",
  "oauth_microsoft",
  "oauth_apple",
] as const satisfies readonly OAuthStrategy[];

export type GaldrOAuthStrategy = (typeof GALDR_OAUTH_STRATEGIES)[number];

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
};

export function oauthStrategyToProvider(strategy: OAuthStrategy): string {
  return strategy.replace(/^oauth_/, "");
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function strategyLabel(strategy: OAuthStrategy): string {
  return providerLabel(oauthStrategyToProvider(strategy));
}

/** Shared Clerk appearance — modal-first OAuth with Galdr brutalist styling. */
export const clerkAppearance = {
  theme: neobrutalism,
  variables: {
    colorPrimary: "#c49a56",
    colorBackground: "#12101a",
    colorInputBackground: "#0d0b13",
    colorText: "#ece8f2",
    colorTextSecondary: "#948aa6",
    borderRadius: "0px",
  },
  signIn: {
    oauthFlow: "popup" as const,
    options: {
      socialButtonsVariant: "blockButton" as const,
      socialButtonsPlacement: "top" as const,
    },
  },
  signUp: {
    oauthFlow: "popup" as const,
    options: {
      socialButtonsVariant: "blockButton" as const,
      socialButtonsPlacement: "top" as const,
    },
  },
};

/** localStorage key for pending OAuth provider swap after redirect. */
export const PENDING_OAUTH_SWAP_KEY = "galdr_pending_oauth_swap";

export type PendingOAuthSwap = {
  oldAccountId: string;
  newStrategy: GaldrOAuthStrategy;
};
