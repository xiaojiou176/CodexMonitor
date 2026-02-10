import type { AppSettings } from "../../../../types";

type ComposerPreset = AppSettings["composerEditorPreset"];

type SettingsComposerSectionProps = {
  appSettings: AppSettings;
  optionKeyLabel: string;
  composerPresetLabels: Record<ComposerPreset, string>;
  onComposerPresetChange: (preset: ComposerPreset) => void;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function SettingsComposerSection({
  appSettings,
  optionKeyLabel,
  composerPresetLabels,
  onComposerPresetChange,
  onUpdateAppSettings,
}: SettingsComposerSectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section-title">编辑器</div>
      <div className="settings-section-subtitle">
        控制消息编辑器中的辅助与格式化行为。
      </div>
      <div className="settings-subsection-title">预设</div>
      <div className="settings-subsection-subtitle">
        选择一个起点，再按需微调下方开关。
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="composer-preset">
          预设
        </label>
        <select
          id="composer-preset"
          className="settings-select"
          value={appSettings.composerEditorPreset}
          onChange={(event) =>
            onComposerPresetChange(event.target.value as ComposerPreset)
          }
        >
          {Object.entries(composerPresetLabels).map(([preset, label]) => (
            <option key={preset} value={preset}>
              {label}
            </option>
          ))}
        </select>
        <div className="settings-help">
          预设会更新下方开关，选择后仍可单独调整。
        </div>
      </div>
      <div className="settings-divider" />
      <div className="settings-subsection-title">代码围栏</div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">空格展开代码围栏</div>
          <div className="settings-toggle-subtitle">
            输入 ``` 后按空格会插入代码围栏。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceExpandOnSpace ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceExpandOnSpace: !appSettings.composerFenceExpandOnSpace,
            })
          }
          aria-pressed={appSettings.composerFenceExpandOnSpace}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">回车展开代码围栏</div>
          <div className="settings-toggle-subtitle">
            启用后按回车可展开 ``` 行。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceExpandOnEnter ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceExpandOnEnter: !appSettings.composerFenceExpandOnEnter,
            })
          }
          aria-pressed={appSettings.composerFenceExpandOnEnter}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">支持语言标签</div>
          <div className="settings-toggle-subtitle">
            支持通过 ```lang + 空格附带语言标记。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceLanguageTags ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceLanguageTags: !appSettings.composerFenceLanguageTags,
            })
          }
          aria-pressed={appSettings.composerFenceLanguageTags}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">选中文本包裹为代码围栏</div>
          <div className="settings-toggle-subtitle">
            创建代码围栏时自动包裹选中文本。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceWrapSelection ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceWrapSelection: !appSettings.composerFenceWrapSelection,
            })
          }
          aria-pressed={appSettings.composerFenceWrapSelection}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">复制代码块时不带围栏</div>
          <div className="settings-toggle-subtitle">
            启用后复制为纯文本。按住 {optionKeyLabel} 可包含 ``` 围栏。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerCodeBlockCopyUseModifier ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerCodeBlockCopyUseModifier:
                !appSettings.composerCodeBlockCopyUseModifier,
            })
          }
          aria-pressed={appSettings.composerCodeBlockCopyUseModifier}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-divider" />
      <div className="settings-subsection-title">粘贴</div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">自动包裹多行粘贴</div>
          <div className="settings-toggle-subtitle">
            将多行粘贴内容自动包裹进代码围栏。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceAutoWrapPasteMultiline ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceAutoWrapPasteMultiline:
                !appSettings.composerFenceAutoWrapPasteMultiline,
            })
          }
          aria-pressed={appSettings.composerFenceAutoWrapPasteMultiline}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">自动包裹代码风格单行</div>
          <div className="settings-toggle-subtitle">
            粘贴长单行代码片段时自动包裹。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerFenceAutoWrapPasteCodeLike ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerFenceAutoWrapPasteCodeLike:
                !appSettings.composerFenceAutoWrapPasteCodeLike,
            })
          }
          aria-pressed={appSettings.composerFenceAutoWrapPasteCodeLike}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <div className="settings-divider" />
      <div className="settings-subsection-title">列表</div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">Shift+Enter 续写列表</div>
          <div className="settings-toggle-subtitle">
            当前行有内容时继续编号/项目符号列表。
          </div>
        </div>
        <button
          type="button"
          className={`settings-toggle ${appSettings.composerListContinuation ? "on" : ""}`}
          onClick={() =>
            void onUpdateAppSettings({
              ...appSettings,
              composerListContinuation: !appSettings.composerListContinuation,
            })
          }
          aria-pressed={appSettings.composerListContinuation}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
    </section>
  );
}
