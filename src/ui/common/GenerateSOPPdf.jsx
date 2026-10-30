import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
// Import SOBHA logo
const ShobhaImg = "/images/ExcelShobhaLogo.png";

const formatDate = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const addImageSafe = (pdf, base64, x, y, w, h) => {
  if (!base64 || typeof base64 !== 'string') return;
  let format = "JPEG";
  let dataUri = base64;
  if (!base64.startsWith("data:")) {
    format = base64.startsWith("iVBOR") ? "PNG" : "JPEG";
    dataUri = `data:image/${format.toLowerCase()};base64,${base64}`;
  } else {
    format = base64.toLowerCase().includes("png") ? "PNG" : "JPEG";
    dataUri = base64;
  }
  try {
    pdf.addImage(dataUri, format, x, y, w, h);
  } catch (error) {
    console.warn("Image could not be added:", error.message);
  }
};

const ensureSpace = (pdf, y, requiredHeight) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomMargin = 15;
  if (y + requiredHeight > pageHeight - bottomMargin) {
    return y;
  }
  return y;
};

const generateSOPPdf = (parsedData) => {
  const pdf = new jsPDF("l", "mm", "a3");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const borderMargin = 5;
  const contentLeft = borderMargin + 3;
  const contentRight = pageWidth - borderMargin - 3;
  const contentTop = borderMargin + 3;
  const contentWidth = pageWidth - 2 * borderMargin - 6;

  const drawPageBorder = () => {
    pdf.setLineWidth(0.2);
    pdf.rect(borderMargin, borderMargin, pageWidth - 2 * borderMargin, pageHeight - 2 * borderMargin);
  };
  drawPageBorder();

  const originalAddPage = pdf.addPage.bind(pdf);
  pdf.addPage = (...args) => {
    originalAddPage(...args);
    drawPageBorder();
    return pdf;
  };

  let y = contentTop;

  // ================ HEADER ================
  const logoWidth = 30;
  const logoHeight = 20;
  try {
    pdf.addImage(ShobhaImg, "PNG", contentLeft, y + 2, logoWidth, logoHeight);
  } catch {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("SOBHA", contentLeft + 2, y + 12);
    pdf.setFontSize(6);
    pdf.text("CONSTRUCTION", contentLeft + 2, y + 17);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("SOBHA CONSTRUCTION LLC", pageWidth / 2, y + 10, { align: "center" });
  pdf.setFontSize(12);
  pdf.text("STANDARD OPERATING PROCEDURE", pageWidth / 2, y + 20, { align: "center" });
  pdf.setFontSize(8);
  const sheetText = "SHEET NO.: 1 OF 1";
  const sheetWidth = pdf.getTextWidth(sheetText);
  pdf.text(sheetText, contentRight - sheetWidth, y + 8);

  y += 25;

  // ================ METADATA TABLE ================
  y = ensureSpace(pdf, y, 10);

  const remarks = parsedData.remarks || [];
  const preparedNames = remarks
    .filter(r => r.role === "Prepared By")
    .map(r => r.name)
    .filter(n => n.trim() !== "");
  const reviewedNames = remarks
    .filter(r => r.role === "Reviewed By")
    .map(r => r.name)
    .filter(n => n.trim() !== "");
  const approvedNames = remarks
    .filter(r => r.role === "Approved By")
    .map(r => r.name)
    .filter(n => n.trim() !== "");

  const preparedDisplay = preparedNames.length > 0 ? preparedNames.join(" / ") : "";
  const reviewedDisplay = reviewedNames.length > 0 ? reviewedNames.join(" / ") : "";
  const approvedDisplay = approvedNames.length > 0 ? approvedNames.join(" / ") : "";

  const rows = [
    { label: "SOU/Division", value: parsedData.sou_division || "SOU 1", byLabel: "Prepared By", byValue: preparedDisplay },
    { label: "Activity", value: parsedData.activity || "", byLabel: "Reviewed By", byValue: reviewedDisplay },
    { label: "Sub Activity", value: parsedData.sub_activity || "", byLabel: "Approved By", byValue: approvedDisplay },
    { label: "Element", value: parsedData.element || "", byLabel: "SOP No.:", byValue: parsedData.sop_number || "" }
  ];

  pdf.setFontSize(7);

  const labelColW = 63;
  const valueColW = 80;
  const stdColW = 60;
  const dateTechColW = 65;
  const byLabelW = 55;
  const byValueW = 70;

  const totalUsedWidth = labelColW + valueColW + stdColW + dateTechColW + byLabelW + byValueW;
  const SHIFT_LEFT = 5;
  const startX = contentLeft + (contentWidth - totalUsedWidth) / 2 - SHIFT_LEFT;

  const colX = [
    startX,
    startX + labelColW,
    startX + labelColW + valueColW,
    startX + labelColW + valueColW + stdColW,
    startX + labelColW + valueColW + stdColW + dateTechColW,
    startX + labelColW + valueColW + stdColW + dateTechColW + byLabelW
  ];

  const rowH = 5;
  const mergeH = rowH * 4;
  const halfH = mergeH / 2;

  // Standard Time
  pdf.rect(colX[2], y, stdColW, mergeH);
  pdf.setFont("helvetica", "bold");
  pdf.text("Standard Time", colX[2] + stdColW / 2, y + mergeH / 2 - 3, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text(`${parsedData.standard_time_min || ""} min`, colX[2] + stdColW / 2, y + mergeH / 2 + 4, { align: "center" });

  // Date + Technician Grade
  pdf.rect(colX[3], y, dateTechColW, mergeH);
  pdf.setLineWidth(0.5);
  pdf.line(colX[3], y + halfH, colX[3] + dateTechColW, y + halfH);

  pdf.setFont("helvetica", "bold");
  pdf.text("Date", colX[3] + dateTechColW / 2, y + halfH / 2 - 2, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text(formatDate(parsedData.date) || "", colX[3] + dateTechColW / 2, y + halfH / 2 + 1, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("Technician Grade", colX[3] + dateTechColW / 2, y + halfH + halfH / 2 - 1.5, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(parsedData.tech_grade || "", colX[3] + dateTechColW / 2, y + halfH + halfH / 2 + 1, { align: "center" });

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const rowY = y + i * rowH;

    pdf.rect(colX[0], rowY, labelColW, rowH);
    pdf.setFont("helvetica", "bold");
    pdf.text(rows[i].label, colX[0] + 2, rowY + 3.5);

    pdf.rect(colX[1], rowY, valueColW, rowH);
    pdf.setFont("helvetica", "normal");
    pdf.text(rows[i].value, colX[1] + 2, rowY + 3.5);

    pdf.rect(colX[4], rowY, byLabelW, rowH);
    pdf.setFont("helvetica", "bold");
    pdf.text(rows[i].byLabel, colX[4] + 2, rowY + 3.5);

    pdf.rect(colX[5], rowY, byValueW, rowH);
    pdf.setFont("helvetica", "normal");
    if (rows[i].byValue) {
      const splitText = pdf.splitTextToSize(rows[i].byValue, byValueW - 4);
      pdf.text(splitText, colX[5] + 2, rowY + 3);
    }
  }

  y += mergeH + 5;

  // ================ IMAGES (LEFT) + DO'S & DON'TS (RIGHT) ================
  const leftSectionWidth = contentWidth * 0.60;
  const rightSectionWidth = contentWidth * 0.35;
  const rightStartX = contentLeft + leftSectionWidth + 10;

  const imagesArr = parsedData.images || [];
  const imageHeight = 33;
  const captionLineHeight = 2.5;
  const dos = parsedData.dos || [];
  const donts = parsedData.donts || [];
  const qualities = parsedData.quality_inspection || [];

  // Calculate height for left section - 4 images per row
  let heightL = 0;
  if (imagesArr.length > 0) {
    const imagesPerRow = 4;
    const numImageRows = Math.ceil(imagesArr.length / imagesPerRow);

    for (let r = 0; r < numImageRows; r++) {
      let maxCaptionHeight = 10;

      for (let i = 0; i < imagesPerRow; i++) {
        const idx = r * imagesPerRow + i;
        if (idx >= imagesArr.length) continue;

        const img = imagesArr[idx];
        const step = parsedData.elemental_steps?.[idx] || {};
        const combined = (img.caption || "") + (step.description ? `\nElemental Step: ${step.description}` : "");

        const captionWidth = (leftSectionWidth - 20) / imagesPerRow - 8;
        const lines = pdf.splitTextToSize(combined, captionWidth).length;
        maxCaptionHeight = Math.max(maxCaptionHeight, lines * captionLineHeight + 4);
      }

      const rowHeight = imageHeight + maxCaptionHeight + 6;
      heightL += rowHeight;
    }
  }

  // Calculate height for right section (unchanged)
  let heightR = 0;
  let items = [];
  if (dos.length > 0 || donts.length > 0) {
    heightR += 5;
    let doIdx = 0;
    let dontIdx = 0;
    const totalItems = dos.length + donts.length;
    for (let i = 0; i < totalItems; i++) {
      if (i % 2 === 0 && doIdx < dos.length) {
        items.push({ type: 'do', data: dos[doIdx++] });
      } else if (i % 2 === 1 && dontIdx < donts.length) {
        items.push({ type: 'dont', data: donts[dontIdx++] });
      } else if (doIdx < dos.length) {
        items.push({ type: 'do', data: dos[doIdx++] });
      } else if (dontIdx < donts.length) {
        items.push({ type: 'dont', data: donts[dontIdx++] });
      }
    }
    const numRows = Math.ceil(items.length / 4);
    const imgHeightDont = 20;
    const textHeightDont = 10;
    for (let row = 0; row < numRows; row++) {
      heightR += imgHeightDont + textHeightDont + 2;
    }
  }
  heightR += 2;
  if (qualities.length > 0) {
    heightR += 5;
    const qualImgSize = 15;
    const cols = 3;
    const numQualRows = Math.ceil(qualities.length / cols);
    heightR += numQualRows * (qualImgSize + 10);
  }

  const ensureSpaceForColumn = (pdf, yPos, requiredHeight, currentPage) => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const bottomMargin = 15;
    return yPos;
  };

  const fixedTopY = y;

  // Draw LEFT: PROCESS IMAGES (4 per row)
  let currentPageLeft = 1;
  pdf.setPage(1);
  let leftY = fixedTopY;

  if (imagesArr.length > 0) {
    const imagesPerRow = 4;
    const numImageRows = Math.ceil(imagesArr.length / imagesPerRow);

    for (let r = 0; r < numImageRows; r++) {
      let maxCaptionHeight = 10;

      // Calculate max caption height
      for (let i = 0; i < imagesPerRow; i++) {
        const idx = r * imagesPerRow + i;
        if (idx >= imagesArr.length) continue;

        const img = imagesArr[idx];
        const step = parsedData.elemental_steps?.[idx] || {};
        const combined = (img.caption || "") + (step.description ? `\nElemental Step: ${step.description}` : "");

        const captionWidth = (leftSectionWidth - 20) / imagesPerRow - 8;
        const lines = pdf.splitTextToSize(combined, captionWidth).length;
        maxCaptionHeight = Math.max(maxCaptionHeight, lines * captionLineHeight + 4);
      }

      const rowHeight = imageHeight + maxCaptionHeight + 6;
      leftY = ensureSpaceForColumn(pdf, leftY, rowHeight, currentPageLeft);
      const rowY = leftY;

      const blockW = (leftSectionWidth - 20) / imagesPerRow;
      const gap = 5;
      const startX = contentLeft + 5;

      // Images
      for (let i = 0; i < imagesPerRow; i++) {
        const idx = r * imagesPerRow + i;
        if (idx >= imagesArr.length) continue;

        const x = startX + i * (blockW + gap);
        pdf.rect(x, rowY, blockW, imageHeight);

        if (imagesArr[idx]?.base64) {
          addImageSafe(pdf, imagesArr[idx].base64, x + 2, rowY + 2, blockW - 4, imageHeight - 3);
        }
      }

      // Captions
      const captionY = rowY + imageHeight;
      for (let i = 0; i < imagesPerRow; i++) {
        const idx = r * imagesPerRow + i;
        if (idx >= imagesArr.length) continue;

        const x = startX + i * (blockW + gap);
        const img = imagesArr[idx];
        const step = parsedData.elemental_steps?.[idx] || {};
        const combined = (img.caption || "") + (step.description ? `\nElemental Step: ${step.description}` : "");

        pdf.rect(x, captionY, blockW, maxCaptionHeight);
        pdf.setFontSize(6);
        pdf.text(pdf.splitTextToSize(combined, blockW - 8), x + 3, captionY + 3);
      }

      leftY += rowHeight;
    }
  }

  // Draw RIGHT section (Do's & Don'ts + Quality) - remains unchanged
  let currentPageRight = 1;
  pdf.setPage(1);
  let rightY = fixedTopY;

  items = [];
  if (dos.length > 0 || donts.length > 0) {
    rightY = ensureSpaceForColumn(pdf, rightY, 5, currentPageRight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.rect(rightStartX, rightY, rightSectionWidth, 5);
    pdf.text("Ok & Not Ok", rightStartX + rightSectionWidth / 2, rightY + 3.5, { align: "center" });
    rightY += 5;

    const colWidth = rightSectionWidth / 4;
    const imgHeightDont = 20;
    const textHeightDont = 8;
    let doIdx = 0;
    let dontIdx = 0;
    const totalItems = dos.length + donts.length;
    for (let i = 0; i < totalItems; i++) {
      if (i % 2 === 0 && doIdx < dos.length) {
        items.push({ type: 'do', data: dos[doIdx++] });
      } else if (i % 2 === 1 && dontIdx < donts.length) {
        items.push({ type: 'dont', data: donts[dontIdx++] });
      } else if (doIdx < dos.length) {
        items.push({ type: 'do', data: dos[doIdx++] });
      } else if (dontIdx < donts.length) {
        items.push({ type: 'dont', data: donts[dontIdx++] });
      }
    }

    const numRows = Math.ceil(items.length / 4);
    for (let row = 0; row < numRows; row++) {
      const rowHeight = imgHeightDont + textHeightDont + 2;
      rightY = ensureSpaceForColumn(pdf, rightY, rowHeight, currentPageRight);
      const rowY = rightY;

      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col;
        const x = rightStartX + col * colWidth;
        pdf.rect(x, rowY, colWidth, imgHeightDont);
        if (idx < items.length) {
          const item = items[idx];
          if (item.data.image_b64) {
            addImageSafe(pdf, item.data.image_b64, x + 2, rowY + 2, colWidth - 4, imgHeightDont - 4);
          } else {
            pdf.setFontSize(4);
            pdf.setFont("helvetica", "italic");
            pdf.text("Add Image", x + colWidth / 2, rowY + imgHeightDont / 2, { align: "center" });
            pdf.setFont("helvetica", "normal");
          }
        }
      }

      const textY = rowY + imgHeightDont;
      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col;
        const x = rightStartX + col * colWidth;
        pdf.rect(x, textY, colWidth, textHeightDont);
        if (idx < items.length) {
          const item = items[idx];
          pdf.setFontSize(4);
          let text = "";
          if (item.type === 'do') {
            pdf.setTextColor(0, 0, 0);
            text = item.data.text || "Do this";
          } else {
            pdf.setTextColor(255, 0, 0);
            text = `• ${item.data.text || "Don't do this"}`;
          }
          pdf.text(pdf.splitTextToSize(text, colWidth - 4), x + 2, textY + 2);
          pdf.setTextColor(0, 0, 0);
        }
      }
      rightY = textY + textHeightDont;
    }
  }

  rightY += 2;
  if (qualities.length > 0) {
    rightY = ensureSpaceForColumn(pdf, rightY, 5, currentPageRight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.rect(rightStartX, rightY, rightSectionWidth, 5);
    pdf.text("Quality", rightStartX + rightSectionWidth / 2, rightY + 3.5, { align: "center" });
    pdf.setFont("helvetica", "normal");
    rightY += 5;

    let qualY = rightY;
    const qualImgSize = 20;
    const cols = 4;
    const colW = rightSectionWidth / cols;
    for (let i = 0; i < qualities.length; i++) {
      qualY = ensureSpaceForColumn(pdf, qualY, 50, currentPageRight);
      const col = i % cols;
      const x = rightStartX + col * colW;
      pdf.rect(x, qualY, colW, qualImgSize);
      if (qualities[i].image_b64) {
        addImageSafe(pdf, qualities[i].image_b64, x + 2, qualY + 2, colW - 4, qualImgSize - 4);
      }
      pdf.rect(x, qualY + qualImgSize, colW, 10);
      pdf.setFontSize(6);
      pdf.text(pdf.splitTextToSize(qualities[i].text || "", colW - 6), x + 3, qualY + qualImgSize + 3);

      if (col === cols - 1 || i === qualities.length - 1) {
        qualY += qualImgSize + 10;
      }
    }
    rightY = qualY;
  }

  // Determine final position
  let maxPage = Math.max(currentPageLeft, currentPageRight);
  let endingY;
  if (currentPageLeft > currentPageRight) {
    endingY = leftY;
  } else if (currentPageRight > currentPageLeft) {
    endingY = rightY;
  } else {
    endingY = Math.max(leftY, rightY);
  }

  const targetPage = Math.max(currentPageLeft, currentPageRight);
  pdf.setPage(targetPage);
  y = endingY - 2;

  // ================ ELEMENTAL STEPS TABLE ================
  y = ensureSpace(pdf, y);
  const stepsBody = (parsedData.elemental_steps || []).map(step => [
    step.step_no || "",
    step.description || "",
    step.tools || "",
    step.time_min || "",
    step.symbol || "",
    step.quality_char || "",
    step.spec || "",
    step.reaction || ""
  ]);

  stepsBody.push([
    "Total Standard Time/line (Mins):",
    parsedData.standard_time_min || "",
    "",
    "",
    "Team Size:",
    parsedData.team_size || "",
    "Technician Grade:",
    parsedData.tech_grade || ""
  ]);

  autoTable(pdf, {
    startY: y,
    head: [["Elemental Step No.", "Elemental Steps Description", "Power tools / Hand Tools Used", "Standard Time / line Dori (Mins):", "Symbol (SC/CC)", "Characteristics", "Specification", "Response"]],
    body: stepsBody,
    theme: "grid",
    styles: { fontSize: 5, cellPadding: 1, valign: "top" },
    headStyles: { fillColor: [63, 98, 137], fontStyle: "bold", fontSize: 5 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 80 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
      4: { cellWidth: 45 },
      5: { cellWidth: 50 },
      6: { cellWidth: 50 },
      7: { cellWidth: 45 }
    },
    margin: { left: contentLeft, right: pageWidth - contentRight }
  });

  y = pdf.lastAutoTable.finalY;

  // ================ SAFETY & PPE ================
  y = ensureSpace(pdf, y, 10);
  const leftSafetyW = contentWidth * 0.54;
  const rightPPEW = contentWidth * 0.44;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.setFillColor(63, 98, 137);
  pdf.setTextColor(255, 255, 255);
  pdf.rect(contentLeft, y, leftSafetyW, 5, "FD");
  pdf.rect(contentLeft + leftSafetyW, y, rightPPEW, 5, "FD");
  pdf.text("Safety Requirements", contentLeft + leftSafetyW / 2, y + 3.5, { align: "center", baseline: "middle" });
  pdf.text("Safety PPE's", contentLeft + leftSafetyW + rightPPEW / 2, y + 3.5, { align: "center", baseline: "middle" });

  y += 5;

  const safetyBody = (parsedData.safety_ppe || []).map((ppe, i) => [
    ppe.sl_no || (i + 1),
    ppe.requirement || "",
    ppe.remarks || ""
  ]);

  autoTable(pdf, {
    startY: y,
    head: [["Sl.No", "Requirements", "Remarks"]],
    body: safetyBody,
    theme: "plain",
    styles: { fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: [180, 180, 180], textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.1 },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: leftSafetyW * 0.63 },
      2: { cellWidth: leftSafetyW * 0.3 },
    },
    margin: {
      left: contentLeft,
      right: pageWidth - (contentLeft + leftSafetyW),
    },
  });

  let safetySectionEndY = pdf.lastAutoTable.finalY;
  const ppeImages = parsedData.safety_ppe?.filter(p => p.image_b64).slice(0, 5) || [];
  if (ppeImages.length > 0) {
    const imgSize = 10;
    const gap = (rightPPEW - 4 * imgSize) / 7;
    let x = contentLeft + leftSafetyW + 5;
    let ppeImagesY = pdf.lastAutoTable.finalY - 12;
    ppeImages.slice(0, 4).forEach(img => {
      addImageSafe(pdf, img.image_b64, x, ppeImagesY, imgSize, imgSize);
      x += imgSize + gap - 10;
    });
    if (ppeImages[4]) {
      const x5 = contentLeft + leftSafetyW + rightPPEW / 2 - imgSize / 2;
      addImageSafe(pdf, ppeImages[4].image_b64, x5, ppeImagesY + imgSize + 4, imgSize, imgSize);
      pdf.text(pdf.splitTextToSize(ppeImages[4].requirement || "", imgSize), x5 + imgSize / 2, ppeImagesY + 2 * imgSize + 7, { align: "center" });
    }
    safetySectionEndY = Math.max(safetySectionEndY, ppeImagesY + 2 * imgSize + 2);
  }

  y = safetySectionEndY - 8;

  // ================ REVISION HISTORY ================
  y = ensureSpace(pdf, y, 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.setFillColor(63, 98, 137);
  pdf.setTextColor(255, 255, 255);
  const headerWidth = contentWidth - 9;
  const headerX = contentLeft;
  pdf.rect(headerX, y, headerWidth, 5, "F");
  pdf.text("Revision History", pageWidth / 2, y + 2.5, { align: "center", baseline: "middle" });

  y += 5;

  let revBody = (parsedData.revision_history || []).map(rev => [
    rev.sl_no || "",
    rev.rev_no || "",
    rev.details || "",
    rev.reason || "",
    rev.date || "",
    rev.remark || ""
  ]);

  autoTable(pdf, {
    startY: y,
    head: [["Sl.No", "Revision No.", "Revision Details", "Reason For Revision", "Revision Date", "Remarks"]],
    body: revBody,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 1, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 6, lineWidth: 0.1 },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 50 },
      2: { cellWidth: 80 },
      3: { cellWidth: 65 },
      4: { cellWidth: 60 },
      5: { cellWidth: 82 },
    },
    margin: { left: contentLeft, right: contentRight },
  });

  y = pdf.lastAutoTable.finalY + 5;
  pdf.setTextColor(0, 0, 0);

  // ================ SIGNATURES ================
  y = ensureSpace(pdf, y, 5);

  const sigH = 18;
  const reduceBy = 25;
  const sigTotalWidth = pageWidth - reduceBy;
  const sigStartX = 8;

  const totalSigners = preparedNames.length + reviewedNames.length + approvedNames.length;
  const numBoxes = Math.max(1, totalSigners);
  const sigW = sigTotalWidth / numBoxes;

  for (let i = 0; i < numBoxes; i++) {
    pdf.rect(sigStartX + i * sigW, y, sigW, sigH);
  }

  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");

  let boxIndex = 0;

  preparedNames.forEach(name => {
    if (name) {
      pdf.text(name, sigStartX + (boxIndex + 0.5) * sigW, y + 13, { align: "center" });
    }
    boxIndex++;
  });

  reviewedNames.forEach(name => {
    if (name) {
      pdf.text(name, sigStartX + (boxIndex + 0.5) * sigW, y + 13, { align: "center" });
    }
    boxIndex++;
  });

  approvedNames.forEach(name => {
    if (name) {
      pdf.text(name, sigStartX + (boxIndex + 0.5) * sigW, y + 13, { align: "center" });
    }
    boxIndex++;
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);

  boxIndex = 0;
  for (let i = 0; i < preparedNames.length; i++) {
    pdf.text("Prepared By", sigStartX + (boxIndex + 0.5) * sigW, y + sigH - 2, { align: "center" });
    boxIndex++;
  }
  for (let i = 0; i < reviewedNames.length; i++) {
    pdf.text("Reviewed By", sigStartX + (boxIndex + 0.5) * sigW, y + sigH - 2, { align: "center" });
    boxIndex++;
  }
  for (let i = 0; i < approvedNames.length; i++) {
    pdf.text("Approved By", sigStartX + (boxIndex + 0.5) * sigW, y + sigH - 2, { align: "center" });
    boxIndex++;
  }

  // ================ OUTPUT ================
  const blob = pdf.output("blob");
  return blob;
};

export default generateSOPPdf;