import { reloadIfRestoredWhileLeaving } from "../../shared/leave-spa";
import { SpaHttpClient } from "../../shared/spa-http-client";
import { startApplication } from "../start-application";
import { init, Message, Model, update, view } from "./main";

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    reloadIfRestoredWhileLeaving();
  }
});

startApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById("root"),
  routing: {
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url) => Message.ChangedUrl({ url }),
  },
  resources: SpaHttpClient.layer(window.location.origin),
});
