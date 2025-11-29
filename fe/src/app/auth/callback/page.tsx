"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();

        // Get the current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(sessionError.message);
          setTimeout(
            () =>
              router.push(
                "/login?error=" + encodeURIComponent(sessionError.message)
              ),
            2000
          );
          return;
        }

        if (!session) {
          console.error("No session found");
          setError("No session found");
          setTimeout(() => router.push("/login?error=no_session"), 2000);
          return;
        }

        // Sync user with backend
        try {
          const syncResponse = await fetch(
            `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
            }/auth/sync`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!syncResponse.ok) {
            console.error(
              "Failed to sync user with backend:",
              await syncResponse.text()
            );
            // Don't fail the login, just log the error
          }
        } catch (syncError) {
          console.error("Error syncing user with backend:", syncError);
          // Don't fail the login, just log the error
        }

        // Update auth store with user data and token
        const user = {
          id: session.user.id,
          email: session.user.email || "",
          name:
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            session.user.email ||
            "User",
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture,
        };

        setUser(user, session.access_token);

        // Get redirect destination from URL params
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || "/dashboard";

        // Redirect to destination
        router.push(next);
      } catch (err: any) {
        console.error("Unexpected error in auth callback:", err);
        setError(err?.message || "Authentication failed");
        setTimeout(
          () =>
            router.push(
              "/login?error=" +
                encodeURIComponent(err?.message || "auth_failed")
            ),
          2000
        );
      }
    };

    handleCallback();
  }, [router, setUser]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Authentication Error</div>
          <div className="text-gray-600">{error}</div>
          <div className="text-sm text-gray-500 mt-2">
            Redirecting to login...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-gray-600">Completing authentication...</div>
      </div>
    </div>
  );
}
