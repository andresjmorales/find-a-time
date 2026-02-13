import type { Metadata } from "next";
import { getEvent } from "@/lib/store";

const BASE_TITLE = "Let's Find a Time!";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  const title = event?.name
    ? `${BASE_TITLE} -- ${event.name}`
    : BASE_TITLE;

  return {
    title,
    openGraph: {
      title,
      description: event?.name
        ? `Find a time that works for everyone: ${event.name}`
        : "Find the best time for everyone to meet",
    },
    twitter: {
      card: "summary",
      title,
    },
  };
}

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
