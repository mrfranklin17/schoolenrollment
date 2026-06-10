"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(2, "School name is required"),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and hyphens only"),
});

export type OnboardingState = { error?: string } | undefined;

export async function createSchool(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That URL is already taken — try another." };
    }
    return { error: "Could not create the school. Please try again." };
  }

  redirect(`/s/${parsed.data.slug}/admin`);
}
