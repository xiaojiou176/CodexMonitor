import "../src/styles/base.css";
import "../src/styles/ds-tokens.css";
import "../src/styles/ds-modal.css";

const preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
