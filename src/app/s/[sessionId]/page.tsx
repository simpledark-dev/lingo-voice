import Link from "next/link";
import { isValidSessionId, roleSchema } from "@/core/validation";
import { SessionClient } from "./SessionClient";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SessionPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const query = await searchParams;

  if (!isValidSessionId(sessionId)) {
    return (
      <main className="page narrow">
        <section className="card">
          <h1>Invalid session link</h1>
          <p className="muted">
            Session IDs are 3-64 characters: letters, digits, &apos;-&apos; or &apos;_&apos;.
          </p>
          <Link href="/">Create a session</Link>
        </section>
      </main>
    );
  }

  const name = first(query.name)?.slice(0, 40);
  const roleParsed = roleSchema.safeParse(first(query.role));
  const autoJoin = first(query.autojoin) === "1";

  return (
    <SessionClient
      sessionId={sessionId}
      initialName={name}
      initialRole={roleParsed.success ? roleParsed.data : undefined}
      autoJoin={autoJoin}
    />
  );
}
