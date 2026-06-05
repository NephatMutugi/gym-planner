"use client";

/**
 * Modal/bottom-sheet showing form-demo media for an exercise: a pair of
 * static images (start + end position) sourced from the public-domain
 * yuhonas/free-exercise-db, and optionally a curated YouTube video.
 *
 * The YouTube embed uses a "lite" pattern — until the user taps the poster,
 * we render only the thumbnail (a single ~10 KB image). The iframe loads
 * only after the explicit click, saving ~500 KB of YouTube JS per page view.
 *
 * Usage:
 *   <ExerciseDemo
 *     open={open}
 *     exerciseId={id}
 *     exerciseName={name}
 *     onClose={() => setOpen(false)}
 *   />
 */

import { useState } from "react";
import Image from "next/image";
import { getExerciseDemo } from "@/data/exercise-demos";

interface ExerciseDemoProps {
  open: boolean;
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}

export default function ExerciseDemo({
  open,
  exerciseId,
  exerciseName,
  onClose,
}: ExerciseDemoProps) {
  const [videoLoaded, setVideoLoaded] = useState(false);

  if (!open) return null;

  const demo = getExerciseDemo(exerciseId);
  const videoId = demo?.videoUrl ? extractYouTubeId(demo.videoUrl) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${exerciseName} form demo`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold">{exerciseName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--fg-muted)] text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!demo && (
          <p className="text-sm text-[var(--fg-muted)]">
            No demo available for this exercise yet.
          </p>
        )}

        {demo?.images && (
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
              Start &nbsp;·&nbsp; End
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DemoImage src={demo.images.start} alt={`${exerciseName} start position`} />
              <DemoImage src={demo.images.end} alt={`${exerciseName} end position`} />
            </div>
            <p className="text-[10px] text-[var(--fg-muted)] mt-2">
              Images from the public-domain free-exercise-db dataset.
            </p>
          </div>
        )}

        {videoId && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
              Video
            </p>
            {videoLoaded ? (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                  title={`${exerciseName} demo video`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVideoLoaded(true)}
                aria-label={`Play ${exerciseName} demo video`}
                className="relative aspect-video w-full rounded-xl overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Image
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-white/90 text-black"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DemoImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg)]">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

// Pulls a YouTube video ID out of any common URL form:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://www.youtube.com/embed/ID
//   https://www.youtube.com/shorts/ID
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID or /shorts/ID
      if (parts.length >= 2 && (parts[0] === "embed" || parts[0] === "shorts")) {
        return parts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}
