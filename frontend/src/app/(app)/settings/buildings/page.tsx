import { Suspense } from "react";
import { PlacesScreen } from "@/modules/settings/components/places/places-screen";

// S20 อาคารและอุปกรณ์ (settings Stage 4). Tab and selection live in the URL (read on the client), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <PlacesScreen />
    </Suspense>
  );
}
