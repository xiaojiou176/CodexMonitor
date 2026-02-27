import { ModalShell } from "./ModalShell";

export default {
  title: "Design System/Modal/ModalShell",
  component: ModalShell,
  parameters: {
    layout: "fullscreen",
  },
};

export const Basic = {
  render: () => (
    <ModalShell ariaLabel="示例弹窗">
      <section
        style={{
          width: 420,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 className="ds-modal-title" style={{ margin: 0 }}>
          ModalShell Storybook 示例
        </h2>
        <p className="ds-modal-subtitle" style={{ margin: 0 }}>
          这是一个稳定的基础示例，用于验证弹窗容器、焦点管理和样式构建链路。
        </p>
        <div className="ds-modal-actions">
          <button className="ds-modal-button" type="button">
            取消
          </button>
          <button className="ds-modal-button" type="button">
            确认
          </button>
        </div>
      </section>
    </ModalShell>
  ),
};
