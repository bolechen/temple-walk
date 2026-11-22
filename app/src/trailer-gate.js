// Who may open the page in trailer mode (#610). The mode replaces the page's clock, so it is the workbench's alone: the dev
// server and a build made for a pull request's preview or a local run (`VITE_DEPLOY` unset or `preview`). The canary and the
// public page never carry it: they do not read `?trailer` at all.
/** @param {{ dev: boolean, deploy: string, search: string }} o */
export function trailerGate({ dev, deploy, search }) {
  if (!(dev || deploy === "preview")) return false;
  return new URLSearchParams(search).has("trailer");
}
