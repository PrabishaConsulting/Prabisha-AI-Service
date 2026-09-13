import * as Sentry from "@sentry/nestjs"

Sentry.init({
  dsn: "https://90a81434338106344c73c0220bb0bf12@o4510814513332224.ingest.de.sentry.io/4512078704476240",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});