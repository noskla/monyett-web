import TestRenderer, { act } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import App from "./src/App";
import { __resetSessionForTests } from "./src/hooks";

(globalThis as any).fetch = async (input: any) => {
  const url = String(input);
  if (url.includes("/auth/session")) return new Response(JSON.stringify({ data: { id: 7, username: "smoke" } }), { status: 200 });
  if (url.includes("/api/upstream-health")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  if (url.includes("/m/v1/app/feed")) return new Response(JSON.stringify({ data: { timeline: [], meta: { pagination: { page: 1, pageCount: 1 } } } }), { status: 200 });
  return new Response(JSON.stringify({ error: { status: 404, message: "no mock" } }), { status: 404 });
};

async function main() {
  __resetSessionForTests();
  let tr!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tr = TestRenderer.create(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  });
  const text = JSON.stringify(tr.toJSON());
  console.log("has 'Log out':", text.includes("Log out"));
  console.log("has 'smoke':", text.includes("smoke"));
  console.log(text.slice(0, 600));
}
main();
