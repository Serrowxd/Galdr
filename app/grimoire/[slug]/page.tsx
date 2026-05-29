import { permanentRedirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

// The singular /grimoire namespace predates the saga rename. Forward inbound
// links to the canonical plural detail route (spec 07 decision #14).
export default async function GrimoireSlugRedirect({ params }: PageProps) {
  const { slug } = await params;
  permanentRedirect(`/grimoires/${slug}`);
}
