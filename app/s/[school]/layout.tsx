import { getTenantBySlug } from "@/lib/tenant";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const tenant = await getTenantBySlug(school);

  // Per-tenant branding: expose the school's primary color as a CSS variable.
  const style = tenant.primary_color
    ? ({ "--brand": tenant.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <div style={style} className="flex min-h-screen flex-col">
      {children}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const tenant = await getTenantBySlug(school);
  return { title: { default: tenant.name, template: `%s · ${tenant.name}` } };
}
