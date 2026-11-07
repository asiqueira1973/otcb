import { assertEquals } from "jsr:@std/assert@1";

import { type DeleteAccountDeps, handleDeleteAccount } from "./handler.ts";

// Testes da 13.8 com dependências simuladas: registram a ordem das chamadas.
function fakeDeps(validToken = "token-a", userId = "uid-a") {
  const calls: string[] = [];
  const deps: DeleteAccountDeps = {
    getUserIdFromToken: (token) => Promise.resolve(token === validToken ? userId : null),
    deleteStorageFolder: (id) => {
      calls.push(`storage:${id}`);
      return Promise.resolve();
    },
    anonymizeEvidence: (id) => {
      calls.push(`evidencias:${id}`);
      return Promise.resolve();
    },
    deleteProfile: (id) => {
      calls.push(`perfil:${id}`);
      return Promise.resolve();
    },
    deleteAuthUser: (id) => {
      calls.push(`auth:${id}`);
      return Promise.resolve();
    },
  };
  return { deps, calls };
}

function post(headers: Record<string, string> = {}, body?: string) {
  return new Request("http://localhost/otcb-apagar-conta", { method: "POST", headers, body });
}

Deno.test("sem JWT devolve 401 e não apaga nada", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleDeleteAccount(post(), deps);
  assertEquals(res.status, 401);
  assertEquals(calls, []);
});

Deno.test("JWT inválido devolve 401", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleDeleteAccount(post({ Authorization: "Bearer outro" }), deps);
  assertEquals(res.status, 401);
  assertEquals(calls, []);
});

Deno.test("ordem da 13.8: bucket → evidências → perfil → auth.users, e devolve { ok: true }", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleDeleteAccount(post({ Authorization: "Bearer token-a" }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(calls, ["storage:uid-a", "evidencias:uid-a", "perfil:uid-a", "auth:uid-a"]);
});

Deno.test("usa o id do token mesmo que o corpo traga outro", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleDeleteAccount(
    post({ Authorization: "Bearer token-a" }, JSON.stringify({ usuario_id: "uid-b" })),
    deps,
  );
  assertEquals(res.status, 200);
  assertEquals(calls, ["storage:uid-a", "evidencias:uid-a", "perfil:uid-a", "auth:uid-a"]);
});

Deno.test("falha no meio devolve 500 genérico", async () => {
  const { deps } = fakeDeps();
  deps.deleteAuthUser = () => Promise.reject(new Error("boom"));
  const res = await handleDeleteAccount(post({ Authorization: "Bearer token-a" }), deps);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: "falha_exclusao" });
});

Deno.test("falha ao limpar o bucket interrompe antes de apagar o perfil", async () => {
  const { deps, calls } = fakeDeps();
  deps.deleteStorageFolder = () => Promise.reject(new Error("storage"));
  const res = await handleDeleteAccount(post({ Authorization: "Bearer token-a" }), deps);
  assertEquals(res.status, 500);
  assertEquals(calls, []);
});

Deno.test("método diferente de POST devolve 405", async () => {
  const { deps } = fakeDeps();
  const res = await handleDeleteAccount(new Request("http://localhost/x", { method: "GET" }), deps);
  assertEquals(res.status, 405);
});
