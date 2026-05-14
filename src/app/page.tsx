import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboarded: true },
    });
    if (user?.onboarded) redirect("/dashboard");
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col items-stretch justify-center p-6 gap-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Gym Planner</h1>
        <p className="text-[var(--fg-muted)] leading-relaxed">
          A pocket-sized strength coach for your home gym. Tell us what you
          own, what you&apos;re training for, and we&apos;ll handle the rest.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/signup" className="btn btn-primary">
          Get started
        </Link>
        <Link href="/login" className="btn btn-ghost">
          I already have an account
        </Link>
      </div>
    </main>
  );
}
