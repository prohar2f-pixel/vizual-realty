import { expect, test, vi } from "vitest";
import { createSessionClearHandler } from "../src/app/api/admin/session/clear/route";

test("clears only the admin cookie and redirects to a fixed local login path", async () => {
  const deleteCookie = vi.fn();
  const handler = createSessionClearHandler({
    getCookieStore: async () => ({ delete: deleteCookie }),
  });

  const response = await handler(
    new Request(
      "https://admin.test.invalid/api/admin/session/clear?next=https://evil.test.invalid",
    ),
  );

  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/admin/login");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(deleteCookie).toHaveBeenCalledWith("vizual_admin_session");
});
