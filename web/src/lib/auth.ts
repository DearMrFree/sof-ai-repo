import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const hasGoogle =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "dev-insecure-secret-change-me",
  providers: [
    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Demo login — always enabled so the app is usable without OAuth setup.
    // Accepts any email + any non-empty "name". Not for production use with
    // real data; enable Google OAuth (and/or disable this) before going live.
    CredentialsProvider({
      id: "demo",
      name: "Demo login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@sof.ai" },
        name: { label: "Display name", type: "text", placeholder: "Ada Lovelace" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const name = credentials?.name?.trim() || email?.split("@")[0] || "Learner";
        if (!email || !email.includes("@")) return null;
        return {
          id: `demo:${email}`,
          email,
          name,
          image: null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
};

export const demoLoginEnabled = true;
export const googleLoginEnabled = hasGoogle;
