import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

// Next 15 requires useSearchParams() to live inside a Suspense boundary so the
// page can stream gracefully. The actual form is the client component below.

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
