"use client";

/**
 * Small client wrapper that pairs a "demo" button with the ExerciseDemo modal.
 * Useful when the parent is a server component (e.g. /exercises) and we want
 * to keep modal state local to the card.
 *
 * Two display modes:
 *   - "thumbnail" (default): renders the start-position image as a clickable
 *     square, opening the modal on tap.
 *   - "link": renders a small text link ("demo") matching the inline-link
 *     pattern used in the active session.
 */

import { useState } from "react";
import Image from "next/image";
import { getExerciseDemo, hasExerciseDemo } from "@/data/exercise-demos";
import ExerciseDemo from "./ExerciseDemo";

interface Props {
  exerciseId: string;
  exerciseName: string;
  variant?: "thumbnail" | "link";
}

export default function ExerciseDemoButton({
  exerciseId,
  exerciseName,
  variant = "thumbnail",
}: Props) {
  const [open, setOpen] = useState(false);

  if (!hasExerciseDemo(exerciseId)) return null;

  const demo = getExerciseDemo(exerciseId);
  const startImg = demo?.images?.start;

  return (
    <>
      {variant === "thumbnail" && startImg ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Show form demo for ${exerciseName}`}
          className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Image
            src={startImg}
            alt=""
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Show form demo for ${exerciseName}`}
          className="text-xs text-[var(--accent)] underline"
        >
          demo
        </button>
      )}

      <ExerciseDemo
        open={open}
        exerciseId={exerciseId}
        exerciseName={exerciseName}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
