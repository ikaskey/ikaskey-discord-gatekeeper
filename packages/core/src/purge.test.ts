import { describe, expect, it } from "vitest";
import { isPurgeCandidate } from "./purge.js";

const DAY = 24 * 60 * 60 * 1000;
const base = {
  isBot: false,
  hasVerifiedRole: false,
  allowlisted: false,
  joinedAtMs: 0,
  nowMs: 20 * DAY,
  graceDays: 14,
};

describe("isPurgeCandidate", () => {
  it("猶予超過の未認証は対象", () => {
    expect(isPurgeCandidate(base)).toBe(true);
  });
  it("猶予内（新規参加）は対象外", () => {
    expect(isPurgeCandidate({ ...base, nowMs: 10 * DAY })).toBe(false);
  });
  it("会員ロール保持（認証済み）は対象外", () => {
    expect(isPurgeCandidate({ ...base, hasVerifiedRole: true })).toBe(false);
  });
  it("Allowlist は対象外", () => {
    expect(isPurgeCandidate({ ...base, allowlisted: true })).toBe(false);
  });
  it("Bot は対象外", () => {
    expect(isPurgeCandidate({ ...base, isBot: true })).toBe(false);
  });
  it("参加日時不明は対象外（安全側）", () => {
    expect(isPurgeCandidate({ ...base, joinedAtMs: null })).toBe(false);
  });
});
