import { jsPDF } from "jspdf";

// Renders a monospace ASCII table (or any plain text) into a PDF, one line per row,
// matching the old FPDF Courier-8 behaviour.
export function textToPdfBuffer(text: string): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  const lineHeight = 10;
  const marginTop = 30;
  const marginLeft = 20;
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = marginTop;
  const lines = text.split("\n");

  for (const line of lines) {
    if (y > pageHeight - marginTop) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginLeft, y);
    y += lineHeight;
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
