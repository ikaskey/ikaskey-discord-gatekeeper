import { describe, expect, it } from "vitest";
import { MisskeyClient } from "./misskey.js";

describe("MisskeyClient.buildMiauthUrl", () => {
  const client = new MisskeyClient("misskey.example.com");

  it("callback と permission を正しく組み立てる", () => {
    const url = new URL(
      client.buildMiauthUrl("11111111-2222-3333-4444-555555555555", {
        appName: "会員認証",
        callback: "https://gate.example/auth/misskey/callback?state=abc",
      }),
    );

    expect(url.host).toBe("misskey.example.com");
    expect(url.pathname).toBe("/miauth/11111111-2222-3333-4444-555555555555");
    expect(url.searchParams.get("permission")).toBe("read:account");
    expect(url.searchParams.get("callback")).toBe(
      "https://gate.example/auth/misskey/callback?state=abc",
    );
    expect(url.searchParams.get("name")).toBe("会員認証");
  });
});
