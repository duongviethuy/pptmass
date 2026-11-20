import type { Metadata } from "next";
import { Suspense } from "react";

import { AudienceWindow } from "@/components/presentation/audience-window";

export const metadata: Metadata = {
  title: "Màn hình trình chiếu | Pptmass",
};

export default function PresentPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <AudienceWindow />
    </Suspense>
  );
}
