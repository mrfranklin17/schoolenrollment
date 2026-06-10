"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { respondToOffer } from "@/lib/lottery/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function OfferBanner({
  school,
  offerId,
  expiresAt,
}: {
  school: string;
  offerId: string;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const respond = (response: "accepted" | "declined") => {
    setError(null);
    startTransition(async () => {
      const result = await respondToOffer({ school, offerId, response });
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <Alert className="border-emerald-300 bg-emerald-50">
      <AlertTitle>🎉 You have an enrollment offer!</AlertTitle>
      <AlertDescription>
        <p className="mt-1">
          A seat has been offered for this application
          {expiresAt && ` — please respond by ${new Date(expiresAt).toLocaleDateString()}`}.
        </p>
        {error && <p className="mt-2 text-destructive">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => respond("accepted")}>
            Accept seat
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => respond("declined")}>
            Decline
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
