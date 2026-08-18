import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Agent AI",
  version: packageJson.version,
  copyright: `© ${currentYear}, Agent AI.`,
  meta: {
    title: "Agent AI - AI Customer Agent for Your Business",
    description:
      "Turn your website into an AI-powered receptionist. Answer questions, capture leads, and book appointments 24/7.",
  },
};
