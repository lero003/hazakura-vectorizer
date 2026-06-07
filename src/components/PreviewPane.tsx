import type { ReactNode } from "react";

interface PreviewPaneProps {
  title: string;
  meta?: string;
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
}

export function PreviewPane({ title, meta, empty, emptyText, children }: PreviewPaneProps) {
  return (
    <div className="preview-pane">
      <div className="preview-pane-header">
        <strong>{title}</strong>
        {meta && <span className="meta">{meta}</span>}
      </div>
      <div
        className={`preview-pane-body ${empty ? "is-empty" : ""}`}
        data-empty={empty ? (emptyText ?? "—") : undefined}
      >
        {!empty && children}
      </div>
    </div>
  );
}
