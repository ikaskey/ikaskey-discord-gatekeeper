// 生成クライアントは core パッケージ内（src/generated/prisma）に出力している。
// @prisma/client (v6) は CommonJS のため、ESM(Node 22+) からは default import で取り出す。
import pkg from "./generated/prisma/index.js";

const { PrismaClient } = pkg;

/** プロセス内で共有する Prisma シングルトン */
export const prisma = new PrismaClient();

export type { Link, VerificationState, RoleMapping, Allowlist } from "./generated/prisma/index.js";
