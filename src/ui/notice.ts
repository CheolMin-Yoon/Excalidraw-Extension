const NOTICE_ID = "excalidraw-vector-latex-notice";

export function showErrorNotice(message: string, documentRef: Document = document): void {
  documentRef.getElementById(NOTICE_ID)?.remove();

  const notice = documentRef.createElement("div");
  notice.id = NOTICE_ID;
  notice.setAttribute("role", "alert");
  notice.textContent = `LaTeX 변환 실패: ${message}`;
  Object.assign(notice.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    maxWidth: "420px",
    padding: "12px 16px",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "10px",
    background: "#7f1d1d",
    color: "#ffffff",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
    font: "14px/1.45 system-ui, sans-serif",
  });

  documentRef.body.appendChild(notice);
  window.setTimeout(() => notice.remove(), 5000);
}
