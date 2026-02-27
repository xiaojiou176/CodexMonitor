// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as AppModule from "./App";

vi.mock("tauri-plugin-liquid-glass-api", () => ({
  setWindowBackground: vi.fn(),
  clearWindowBackground: vi.fn(),
}));

vi.mock("./features/about/components/AboutView", () => ({
  AboutView: () => <div data-testid="about-view">About</div>,
}));

vi.mock("./features/layout/hooks/useWindowLabel", () => ({
  useWindowLabel: vi.fn(),
}));

describe("App window routing smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders about window when label is about", async () => {
    const { useWindowLabel } = await import("./features/layout/hooks/useWindowLabel");
    vi.mocked(useWindowLabel).mockReturnValue("about");

    render(<AppModule.App />);

    expect(await screen.findByTestId("about-view")).toBeInTheDocument();
  });

  it("renders main entry when label is not about", async () => {
    const { useWindowLabel } = await import("./features/layout/hooks/useWindowLabel");
    vi.mocked(useWindowLabel).mockReturnValue("main");

    const MainEntryMock = () => <div data-testid="main-app-mock">Main</div>;

    render(<AppModule.App MainComponent={MainEntryMock} />);

    expect(screen.getByTestId("main-app-mock")).toBeInTheDocument();
  });
});
