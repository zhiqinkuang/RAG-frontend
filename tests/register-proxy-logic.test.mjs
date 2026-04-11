/**
 * 注册代理成功判定逻辑（与 app/api/auth/register/route.ts 一致）
 * 不启动 Next；用于防止回归：无 code 字段时不应误判失败。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function shouldRejectAfterOk(data) {
  const raw = data;
  return typeof raw.code === "number" && raw.code !== 0;
}

function payloadForClient(data) {
  const raw = data;
  if (raw.data !== undefined && raw.data !== null) return raw.data;
  if (typeof raw.code === "number") {
    const { code: _c, ...rest } = raw;
    return rest;
  }
  return data;
}

describe("register proxy success handling", () => {
  it("accepts 200 body without code (bare user_id)", () => {
    const body = { user_id: 42 };
    assert.equal(shouldRejectAfterOk(body), false);
    assert.deepEqual(payloadForClient(body), { user_id: 42 });
  });

  it("accepts code 0 with data", () => {
    const body = { code: 0, data: { user_id: 7 } };
    assert.equal(shouldRejectAfterOk(body), false);
    assert.deepEqual(payloadForClient(body), { user_id: 7 });
  });

  it("rejects non-zero code", () => {
    assert.equal(shouldRejectAfterOk({ code: 1, message: "fail" }), true);
  });

  it("code 0 without data yields empty object", () => {
    const body = { code: 0 };
    assert.equal(shouldRejectAfterOk(body), false);
    assert.deepEqual(payloadForClient(body), {});
  });

  it("code 0 with top-level user_id (no data) forwards user_id", () => {
    const body = { code: 0, user_id: 99 };
    assert.equal(shouldRejectAfterOk(body), false);
    assert.deepEqual(payloadForClient(body), { user_id: 99 });
  });
});
