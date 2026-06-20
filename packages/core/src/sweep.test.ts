import { describe, expect, it } from "vitest";
import { decideAction } from "./sweep.js";

describe("decideAction", () => {
  it("存在を確認したら failureCount を 0 にリセットしキックしない", () => {
    expect(decideAction(false, 5, 2)).toEqual({ kick: false, newFailureCount: 0 });
  });

  it("即キック設定(threshold=1): 1回の消滅確認でキック", () => {
    expect(decideAction(true, 0, 1)).toEqual({ kick: true, newFailureCount: 1 });
  });

  it("threshold=2: 1回目はカウントのみ、2回目でキック", () => {
    expect(decideAction(true, 0, 2)).toEqual({ kick: false, newFailureCount: 1 });
    expect(decideAction(true, 1, 2)).toEqual({ kick: true, newFailureCount: 2 });
  });
});
