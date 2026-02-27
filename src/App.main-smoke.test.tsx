// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
    cleanup();
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

  it("falls back to main entry when window label is empty", async () => {
    const { useWindowLabel } = await import("./features/layout/hooks/useWindowLabel");
    vi.mocked(useWindowLabel).mockReturnValue("");

    const MainEntryMock = () => <div data-testid="main-app-empty-label">Main</div>;

    render(<AppModule.App MainComponent={MainEntryMock} />);

    expect(screen.getByTestId("main-app-empty-label")).toBeInTheDocument();
  });

  it("switches route when window label changes across rerender", async () => {
    const { useWindowLabel } = await import("./features/layout/hooks/useWindowLabel");
    vi.mocked(useWindowLabel).mockReturnValue("about");

    const MainEntryMock = () => <div data-testid="main-app-after-switch">Main</div>;

    const view = render(<AppModule.App MainComponent={MainEntryMock} />);
    expect(await screen.findByTestId("about-view")).toBeInTheDocument();

    vi.mocked(useWindowLabel).mockReturnValue("main");
    view.rerender(<AppModule.App MainComponent={MainEntryMock} />);

    expect(screen.getByTestId("main-app-after-switch")).toBeInTheDocument();
  });

  it("surfaces main component render errors", async () => {
    const { useWindowLabel } = await import("./features/layout/hooks/useWindowLabel");
    vi.mocked(useWindowLabel).mockReturnValue("main");

    const ThrowingMain = () => {
      throw new Error("main render failed");
    };

    expect(() => render(<AppModule.App MainComponent={ThrowingMain} />)).toThrow("main render failed");
  });
});
