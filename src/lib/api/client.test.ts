import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, session } from "./client";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    session.clear();
    session.onSessionExpired(null);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the access token and the selected school", async () => {
    session.setAccessToken("token-1");
    session.setSchoolId(7);
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await api.get("/school/");

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(url).toBe("/api/v1/school/");
    expect(headers.Authorization).toBe("Bearer token-1");
    expect(headers["X-School-ID"]).toBe("7");
    expect(init?.credentials).toBe("include");
  });

  it("refreshes an expired access token once and retries", async () => {
    session.setAccessToken("expired");
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "token_not_valid", message: "expired", fields: {} }))
      .mockResolvedValueOnce(json(200, { access: "fresh" }))
      .mockResolvedValueOnce(json(200, { id: 1 }));

    await expect(api.get("/me/")).resolves.toEqual({ id: 1 });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh/");
    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer fresh");
  });

  it("shares one refresh request between concurrent calls", async () => {
    session.setAccessToken("expired");
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh/")) return json(200, { access: "fresh" });
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer fresh" ? json(200, { url }) : json(401, { code: "x", message: "x", fields: {} });
    });

    await Promise.all([api.get("/a/"), api.get("/b/"), api.get("/c/")]);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh/"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("reports an expired session when the refresh fails", async () => {
    const expired = vi.fn();
    session.onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "not_authenticated", message: "no", fields: {} }))
      .mockResolvedValueOnce(json(401, { code: "session_expired", message: "no", fields: {} }));

    await expect(api.get("/me/")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("turns error responses into ApiError with field messages", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { code: "validation_error", message: "Fix it", fields: { email: ["Invalid email."] } }),
    );
    const error = await api.post("/users/", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("validation_error");
    expect((error as ApiError).fields.email).toEqual(["Invalid email."]);
  });

  it("reports network failures with a dedicated code", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = await api.get("/me/").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("network_error");
  });
});
