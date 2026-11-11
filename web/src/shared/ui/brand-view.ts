import type { Html, HtmlBuilder } from "foldkit/html";

export const SERVICE_NAME = "Taimei";

export const serviceLogoView = <Message>(h: HtmlBuilder<Message>): Html =>
  h.img([
    h.Src("/icons/my-service-logo.png"),
    h.Alt("myservicelogo"),
    h.Class("relative object-contain -z-10"),
    h.Style({ width: "200px", height: "150px" }),
  ]);
