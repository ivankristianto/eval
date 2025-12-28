import type { Preview } from "@storybook/html-vite";
import "../src/styles/global.css";

const themeOptions = ["light", "dark", "cupcake", "nord", "luxury", "silk"];

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "DaisyUI theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: themeOptions,
        showName: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme || "light");
      return Story();
    },
  ],
  parameters: {
    actions: { argTypesRegex: "^on.*" },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    layout: "centered",

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
