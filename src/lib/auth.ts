import type { NextAuthOptions, User } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // PrismaAdapter's exported type drifts slightly between major versions
  // of next-auth and @auth/prisma-adapter; this cast keeps both happy.
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Diagnostic logging — server-side only. Never returned to the client.
        // Distinguishes the three failure modes (missing input / no user /
        // wrong password) so a future "user can't log in" report can be triaged
        // in two seconds from Vercel logs.
        if (!credentials?.email || !credentials?.password) {
          console.warn("[auth] login fail: missing email or password");
          return null;
        }
        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          console.warn(`[auth] login fail: no user for ${email}`);
          return null;
        }
        if (!user.passwordHash) {
          console.warn(`[auth] login fail: no passwordHash for ${email}`);
          return null;
        }
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) {
          console.warn(`[auth] login fail: bad password for ${email}`);
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      // Fresh sign-in: stamp uid and the issued-at second.
      if (user) {
        token.uid = user.id;
        token.iatSec = Math.floor(Date.now() / 1000);
      }

      // On every request, check whether the user's password has been changed
      // since this token was issued. If so, refuse to extend the session by
      // wiping the uid — the session callback will see no uid and return
      // an empty session, forcing the client to re-authenticate.
      const uid = token.uid as string | undefined;
      const iatSec = token.iatSec as number | undefined;
      if (uid && typeof iatSec === "number") {
        const u = await prisma.user.findUnique({
          where: { id: uid },
          select: { passwordChangedAt: true },
        });
        if (u?.passwordChangedAt) {
          const changedSec = Math.floor(u.passwordChangedAt.getTime() / 1000);
          // Allow a 5-second skew so a user resetting their own password
          // doesn't get logged out on the very next request from the same tab.
          if (iatSec + 5 < changedSec) {
            console.warn(`[auth] jwt invalidated: ${uid} passwordChangedAt newer than token iat`);
            return {};
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
};
