"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

import { ToastProvider } from "@/components/Toast";
import { ChallengeButton } from "@/components/ChallengeButton";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
        <ChallengeButton />
      </ToastProvider>
    </SessionProvider>
  );
}
