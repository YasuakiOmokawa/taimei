import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b212ae3955b05f1b68d3b68bbb3cda79@o4508980552728576.ingest.us.sentry.io/4508980558757888",
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
