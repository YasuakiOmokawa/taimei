import { SIGN_IN_PATH } from "./sign-in-path";

export const loadDocument = (href: string) => window.location.assign(href);

export const leaveSpaToSignIn = () => {
  const { pathname, search } = window.location;
  loadDocument(
    `${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(`${pathname}${search}`)}`,
  );
};

export const reloadDocument = () => window.location.reload();
