import Shell from "@/components/shell";
import Playground from "@/components/pg/playground";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const focus = typeof sp.focus === "string" ? sp.focus : undefined;
  return (
    <Shell>
      <Playground id={id} initialFocus={focus} />
    </Shell>
  );
}
