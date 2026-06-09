import type { ReactNode } from "react";

interface PreviewPaneProps {
  title: string;
  meta?: string;
  empty?: boolean;
  emptyText?: string;
  /** Optional right-aligned content in the header. Used for the SVG
   *  pane's Color / Monochrome tab switcher. */
  headerExtra?: ReactNode;
  children?: ReactNode;
}

export function PreviewPane({
  title,
  meta,
  empty,
  emptyText,
  headerExtra,
  children,
}: PreviewPaneProps) {
  return (
    <div className="preview-pane">
      <div className="preview-pane-header">
        <strong>{title}</strong>
        {meta && <span className="meta">{meta}</span>}
        {headerExtra && (
          <div className="preview-pane-header-extra">{headerExtra}</div>
        )}
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
