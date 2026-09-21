import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readControlConfig } from "../config";
import { COOKIE_NAME, unsealSession, type ControlSession } from "./session";

export class RequestDeniedError extends Error { readonly status = 403; }

export function assertTrustedOrigin(request: Request) {
  if (request.headers.get("origin") !== readControlConfig().origin) throw new RequestDeniedError();
}

export async function getSession(): Promise<ControlSession | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    return token ? unsealSession(token, readControlConfig().sessionSecret) : null;
  } catch { return null; }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
