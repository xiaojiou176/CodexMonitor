import type { AppSettings } from "../../../../types";
import { fileManagerName, openInFileManagerLabel } from "../../../../utils/platformPaths";

type SettingsFeaturesSectionProps = {
  appSettings: AppSettings;
  hasCodexHomeOverrides: boolean;
  openConfigError: string | null;
  onOpenConfig: () => void;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function SettingsFeaturesSection({
  appSettings,
  hasCodexHomeOverrides,
  openConfigError,
  onOpenConfig,
  onUpdateAppSettings,
}: SettingsFeaturesSectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section-title">功能</div>
      <div className="settings-section-subtitle">
        管理稳定版和实验版 Codex 功能。
      </div>
      {hasCodexHomeOverrides && (
        <div className="settings-help">
          功能设置保存在默认 CODEX_HOME 的 config.toml。
          <br />
          不会更新工作区覆盖项。
        </div>
      )}
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">配置文件</div>
          <div className="settings-toggle-subtitle">
            在 {fileManagerName()} 中打开 Codex 配置。
          </div>
        </div>
        <button type="button" className="ghost" onClick={onOpenConfig}>
          {openInFileManagerLabel()}
        </button>
      </div>
      {openConfigError && <div className="settings-help">{openConfigError}</div>}
      <div className="settings-subsection-title">稳定功能</div>
      <div className="settings-subsection-subtitle">
        默认启用且可用于生产环境的功能。
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">协作模式</div>
          <div className="settings-toggle-subtitle">
            启用协作模式预设（Code、Plan）。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.collaborationModesEnabled ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              collaborationModesEnabled: !appSettings.collaborationModesEnabled,
            })
          }
          aria-pressed={appSettings.collaborationModesEnabled}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">个性风格</div>
          <div className="settings-toggle-subtitle">
            选择 Codex 的沟通风格（会写入 config.toml 顶层 <code>personality</code>）。
          </div>
        </div>
        <select
          id="features-personality-select"
          className="settings-select"
          value={appSettings.personality}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              personality: event.target.value as AppSettings["personality"],
            })
          }
          aria-label="个性风格"
        >
          <option value="friendly">友好</option>
          <option value="pragmatic">务实</option>
        </select>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">引导模式</div>
          <div className="settings-toggle-subtitle">
            立即发送消息；运行中可按 Tab 排队。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.steerEnabled ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              steerEnabled: !appSettings.steerEnabled,
            })
          }
          aria-pressed={appSettings.steerEnabled}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">后台终端</div>
          <div className="settings-toggle-subtitle">
            在后台运行长时终端命令。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.unifiedExecEnabled ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              unifiedExecEnabled: !appSettings.unifiedExecEnabled,
            })
          }
          aria-pressed={appSettings.unifiedExecEnabled}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-subsection-title">实验功能</div>
      <div className="settings-subsection-subtitle">
        预览可能变更或下线的功能。
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">多智能体</div>
          <div className="settings-toggle-subtitle">
            启用 Codex 多智能体协作工具。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.experimentalCollabEnabled ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              experimentalCollabEnabled: !appSettings.experimentalCollabEnabled,
            })
          }
          aria-pressed={appSettings.experimentalCollabEnabled}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">Apps</div>
          <div className="settings-toggle-subtitle">
            启用 ChatGPT 应用/连接器与 <code>/apps</code> 命令。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.experimentalAppsEnabled ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              experimentalAppsEnabled: !appSettings.experimentalAppsEnabled,
            })
          }
          aria-pressed={appSettings.experimentalAppsEnabled}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
    </section>
  );
}
