import { SIGN_IN_PATH } from "./sign-in-path";

const documentsBeingLeft = new WeakSet<Location>();

const leaveOnce = (leave: (location: Location) => void) => {
  const { location } = window;
  if (documentsBeingLeft.has(location)) {
    return;
  }
  documentsBeingLeft.add(location);
  leave(location);
};

export const loadDocument = (href: string) => window.location.assign(href);

export const leaveSpaToSignIn = () =>
  leaveOnce((location) =>
    location.assign(
      `${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    ),
  );

export const reloadDocument = () => leaveOnce((location) => location.reload());

export const reloadIfRestoredWhileLeaving = () => {
  if (documentsBeingLeft.delete(window.location)) {
    window.location.reload();
  }
};
