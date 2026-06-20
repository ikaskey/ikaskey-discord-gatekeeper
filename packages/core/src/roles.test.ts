import { describe, expect, it } from "vitest";
import { computeRoleSync } from "./roles.js";
import type { RoleMapping } from "./db.js";

function mapping(misskeyRoleId: string, discordRoleId: string): RoleMapping {
  return {
    misskeyRoleId,
    misskeyRoleName: misskeyRoleId,
    discordRoleId,
    enabled: true,
    autoSync: true,
  };
}

describe("computeRoleSync", () => {
  const mappings = [mapping("R1", "D1"), mapping("R2", "D2")];

  it("保有ロールに対応する管理ロールを付与し、非該当の管理ロールを剥奪（管理外は不変）", () => {
    const plan = computeRoleSync(new Set(["R1"]), mappings, new Set(["D2", "D9"]));
    expect(plan.toAdd).toEqual(["D1"]);
    expect(plan.toRemove).toEqual(["D2"]);
    // D9 は管理外なので追加にも剥奪にも現れない
    expect(plan.toAdd).not.toContain("D9");
    expect(plan.toRemove).not.toContain("D9");
  });

  it("既に同期済みなら差分なし", () => {
    const plan = computeRoleSync(new Set(["R1", "R2"]), mappings, new Set(["D1", "D2"]));
    expect(plan.toAdd).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it("Misskeyロールを全て失えば管理ロールを全剥奪", () => {
    const plan = computeRoleSync(new Set<string>(), mappings, new Set(["D1", "D2"]));
    expect(plan.toAdd).toEqual([]);
    expect(plan.toRemove.sort()).toEqual(["D1", "D2"]);
  });
});
