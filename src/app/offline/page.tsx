"use client";

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md min-h-[100dvh] flex flex-col items-stretch justify-center p-6 gap-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="text-[var(--fg-muted)] leading-relaxed">
          No connection right now. Workouts and sets you&apos;ve already
          started will keep working — they&apos;ll sync once you&apos;re back
          online.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
      >
        Try again
      </button>
    </main>
  );
}
