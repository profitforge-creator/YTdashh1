"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setFollow } from "./actions";

export function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      loading={pending}
      aria-pressed={following}
      onClick={() =>
        startTransition(async () => {
          const res = await setFollow(userId, !following);
          if (!res.ok) toast.error(res.error);
          else setFollowing(!following);
        })
      }
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
