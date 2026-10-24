import { getRequestConfig } from "next-intl/server";

// English is the only launch locale (doc 11). Spanish drops in as messages/es.json
// plus locale routing under /es, with no component changes.
export default getRequestConfig(async () => ({
  locale: "en",
  messages: (await import("../messages/en.json")).default,
}));
