import { eq } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { threads } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { canEditOpBody } from "@/lib/threads";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDbOptional();
  if (!db) return new Response("DB unavailable", { status: 503 });

  const body = await req.json();
  const opBody = String(body.opBody ?? "");
  if (opBody.length > 65536) return new Response("Too large", { status: 413 });

  const can = await canEditOpBody(user.id, id);
  if (!can) return new Response("Forbidden", { status: 403 });

  await db
    .update(threads)
    .set({ opBody, opEditedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(threads.id, id));

  return Response.json({ ok: true });
}
