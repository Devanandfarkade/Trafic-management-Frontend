import ExcelJS from "exceljs";
import SobhaLogo from '../../../public/images/ExcelShobhaLogo.png';

const SAFETY_KEYWORDS = {
  helmet: ["helmet", "hard hat", "safety helmet", "hardhat"],
  "safety vest": ["vest", "safety vest", "reflective vest", "high visibility", "hi-vis"],
  gloves: ["glove", "gloves", "hand protection"],
  goggles: ["goggle", "goggles", "safety glasses", "eye protection"],
  "safety shoes": ["safety shoe", "safety boot", "steel toe", "protective footwear", "safety footwear"],
  mask: ["mask", "face mask", "respirator", "dust mask"],
  "face shield": ["face shield", "face protection"],
  "ear plugs": ["ear plug", "earplug", "hearing protection", "ear muff"],
  harness: ["harness", "safety harness", "fall arrest", "full body harness"],
  vernier: ["vernier", "vernier calipers"],
  temperature: ["temperature"],
  cutters: [
    "cutter", "cutters", "cutting tool", "cutting tools",
    "wire cutter", "cut wire", "cutting", "cut ", " cuts", " cut.", "cut.",
    "cutting and fitting", "pipe cutters", "cutting plier", "cutting plier"
  ],
  pliers: ["plier", "pliers", "cutting plier"],
  hammer: ["hammer"],
  drill: ["drill", "power drill", "drilling"],
  screwdriver: ["screwdriver", "screw driver"],
  ladder: ["ladder", "step ladder"],
  "measuring tape": ["measuring tape", "tape measure", "measure"],
  "spirit level": ["spirit level", "level tool", "bubble level"],
  wrench: ["wrench", "spanner", "adjustable wrench"],
  torch: ["torch", "flashlight"]
};

const detectSafetyItem = (text = "") => {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  if (
    /cutter|cutters|cutting|cut\s|cuts|cut\./i.test(lower) ||
    /wire.?cutter|pipe.?cutter|cutting.?(tool|plier|fit)/i.test(lower)
  ) {
    return "cutters";
  }
  if (/plier|pliers/i.test(lower) && !lower.includes("cutting")) {
    return "pliers";
  }
  for (const [key, keywords] of Object.entries(SAFETY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return key;
    }
  }
  return null;
};

const base64ToArrayBuffer = (base64) => {
  if (!base64 || typeof base64 !== "string") return null;

  const cleanBase64 = base64.includes(",")
    ? base64.split(",")[1]
    : base64;

  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
};

const formatDate = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const generateExcelWorkbook = async (parsedData) => {
  const workbook = new ExcelJS.Workbook();
  const sopSheet = workbook.addWorksheet("SOP");
  sopSheet.pageSetup = { paperSize: 9, orientation: "landscape" };
  sopSheet.columns = [
    { width: 10 }, // A
    { width: 10 }, // B
    { width: 35 }, // C
    { width: 10 }, // D
    { width: 10 }, // E
    { width: 10 }, // F
    { width: 10 }, // G
    { width: 10 }, // H
    { width: 10 }, // I
    { width: 10 }, // J
    { width: 10 }, // K
    { width: 10 }, // L
    { width: 10 }, // M
    { width: 25 }, // N
    { width: 10 }, // O
    { width: 10 }, // P
    { width: 10 }, // Q
    { width: 15 }, // R
    { width: 15 }, // S
    { width: 15 }, // T
    { width: 15 }, // U
    { width: 20 }, // V
    { width: 20 }, // W
  ];

  const stepsArr = parsedData.elemental_steps || [];
  const imagesArr = parsedData.images || [];
  let rowNumber = 1;
  let imageRanges = [];

  // Extract names from remarks (same logic as PDF)
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

  // Display values (joined with " / " if multiple) - used in header
  const preparedDisplay = preparedNames.length > 0 ? preparedNames.join(" / ") : "";
  const reviewedDisplay = reviewedNames.length > 0 ? reviewedNames.join(" / ") : "";
  const approvedDisplay = approvedNames.length > 0 ? approvedNames.join(" / ") : "";

  /* ======================= HEADER (ROWS 1–7) ======================= */
  sopSheet.addRow(new Array(23).fill(""));
  sopSheet.getRow(1).height = 20;
  rowNumber++;
  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[1] = "SOBHA CONSTRUCTION LLC";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`B${idx}:Q${idx}`);
    const r = sopSheet.getRow(idx);
    r.getCell("B").font = { bold: true, size: 14 };
    r.getCell("B").alignment = { horizontal: "center", vertical: "middle" };
    sopSheet.getRow(idx).height = 40;
    rowNumber++;
  }

  // Logo
  {
    try {
      const response = await fetch(SobhaLogo);
      if (!response.ok) throw new Error('Failed to fetch logo');
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const logoImageId = workbook.addImage({
        buffer,
        extension: 'png',
      });
      sopSheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 },
        br: { col: 1, row: 1 },
      });
      sopSheet.mergeCells('A1:A2');
    } catch (e) {
      console.error("Error adding logo image:", e);
    }
  }

  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[1] = "STANDARD OPERATING PROCEDURE";
    row[18] = "Name";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`B${idx}:Q${idx}`);
    sopSheet.mergeCells(`S${idx}:U${idx}`);
    const r = sopSheet.getRow(idx);
    r.getCell("B").font = { bold: true, size: 14 };
    r.getCell("B").alignment = { horizontal: "center", vertical: "middle" };
    r.getCell("S").font = { bold: true, size: 12 };
    r.getCell("S").alignment = { horizontal: "center", vertical: "middle" };
    sopSheet.getRow(idx).height = 30;
    rowNumber++;
  }

  // Row 4 – SOU/Division + Prepared By
  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = "SOU/Division";
    row[5] = parsedData.sou_division || "SOU 1";
    row[17] = "Prepared By";
    row[18] = preparedDisplay;
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:M${idx}`);
    sopSheet.mergeCells(`S${idx}:U${idx}`);
    sopSheet.getRow(idx).height = 30;
    rowNumber++;
  }

  // Row 5 – Activity + Reviewed By
  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = "Activity";
    row[5] = parsedData.activity || "";
    row[17] = "Reviewed By";
    row[18] = reviewedDisplay;
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:M${idx}`);
    sopSheet.mergeCells(`S${idx}:U${idx}`);
    sopSheet.getRow(idx).height = 30;
    rowNumber++;
  }

  // Row 6 – Sub Activity + Approved By
  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = "Sub Activity";
    row[5] = parsedData.sub_activity || "";
    row[17] = "Approved By";
    row[18] = approvedDisplay;
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:M${idx}`);
    sopSheet.mergeCells(`S${idx}:U${idx}`);
    sopSheet.getRow(idx).height = 30;
    rowNumber++;
  }

  // Row 7 – Element + SOP No + Date
  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = "Element";
    row[5] = parsedData.element || "";
    row[17] = "SOP No.:";
    row[18] = parsedData.sop_number || "";
    row[20] = "Date";
    row[21] = formatDate(parsedData.date);
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:M${idx}`);
    sopSheet.mergeCells(`S${idx}:U${idx}`);
    sopSheet.getRow(idx).height = 30;
    rowNumber++;
  }

  sopSheet.mergeCells(`N4:O7`);
  sopSheet.mergeCells(`P4:Q7`);
  const standardTimeHeadingCell = sopSheet.getCell(`N4`);
  standardTimeHeadingCell.value = "Standard Time:";
  standardTimeHeadingCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  standardTimeHeadingCell.font = { bold: true };
  const standardTimeValueCell = sopSheet.getCell(`P4`);
  standardTimeValueCell.value = (parsedData.standard_time_min || "") + " min";
  standardTimeValueCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  standardTimeValueCell.font = { bold: true };

  /* ======================= IMAGES + Do's/Don'ts ======================= */
  if (rowNumber < 7) {
    while (rowNumber < 7) {
      sopSheet.addRow(new Array(23).fill(""));
      rowNumber++;
    }
  }

  let imageAreaStartRow = null;
  let imageAreaEndRow = null;
  if (imagesArr.length > 0) {
    const maxImages = Math.min(imagesArr.length, 12);
    let imgIndex = 0;
    const imageHeightRows = 6;
    const blocks = [
      { start: 1, end: 5 },
      { start: 6, end: 10 },
      { start: 11, end: 15 },
    ];
    rowNumber = 9;
    while (imgIndex < maxImages) {
      const imageTopRow = rowNumber;
      if (imageAreaStartRow === null) imageAreaStartRow = imageTopRow;
      for (let r = 0; r < imageHeightRows; r++) {
        sopSheet.addRow(new Array(23).fill(""));
        sopSheet.getRow(rowNumber).height = 25;
        rowNumber++;
      }
      const imageBottomRow = imageTopRow + imageHeightRows - 1;
      imageAreaEndRow = imageBottomRow;
      const captionRow = rowNumber;
      const captionRowObj = sopSheet.addRow(new Array(23).fill(""));
      rowNumber++;

      let maxLinesNeeded = 3;
      let tempIndex = imgIndex;
      for (let j = 0; j < 3 && tempIndex < maxImages; j++, tempIndex++) {
        const step = stepsArr[tempIndex];
        const img = imagesArr[tempIndex];
        const caption = img?.caption || "";
        const desc = step?.description || "";
        const combined = caption && desc ? `${caption}\nElemental Step: ${desc}` : caption || desc || "";
        if (combined) {
          const explicitLines = combined.split('\n').length;
          const wrappedLines = Math.ceil(combined.replace(/\n/g, ' ').length / 50);
          const totalLines = Math.max(explicitLines, wrappedLines, 1);
          if (totalLines > maxLinesNeeded) maxLinesNeeded = totalLines;
        }
      }

      for (let j = 0; j < 3 && imgIndex < maxImages; j++, imgIndex++) {
        const img = imagesArr[imgIndex];
        const block = blocks[j];
        const captionColStart = block.start + 1;
        const captionColEnd = block.end;
        if (img && img.base64) {
          const buffer = base64ToArrayBuffer(img.base64);
          const imageId = workbook.addImage({ buffer, extension: "jpeg" });
          sopSheet.addImage(imageId, {
            tl: { col: block.start, row: imageTopRow },
            br: { col: block.end, row: imageBottomRow },
          });
          imageRanges.push({
            startRow: imageTopRow,
            endRow: imageBottomRow,
            startCol: captionColStart,
            endCol: captionColEnd
          });
        }
        const step = stepsArr[imgIndex];
        const caption = img?.caption || "";
        const desc = step?.description || "";
        const combined = caption && desc ? `${caption}\nElemental Step: ${desc}` : caption || desc || "";
        if (combined) {
          const cell = sopSheet.getRow(captionRow).getCell(captionColStart);
          cell.value = combined;
          sopSheet.mergeCells(captionRow, captionColStart, captionRow, captionColEnd);
          cell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
          const existingFont = cell.font || {};
          cell.font = { ...existingFont, size: 10 };
        }
      }
      captionRowObj.height = Math.max(90, maxLinesNeeded * 25);
    }
  }

  if (imageAreaStartRow !== null && imageAreaEndRow !== null) {
    const dos = parsedData.dos || [];
    const donts = parsedData.donts || [];
    const totalRows = imageAreaEndRow - imageAreaStartRow + 1;
    if (totalRows >= 5) {
      const columns = [17, 18, 19, 20, 21, 22];
      const dosHeaderRow = imageAreaStartRow;
      sopSheet.mergeCells(`R${dosHeaderRow}:W${dosHeaderRow}`);
      sopSheet.getCell(`R${dosHeaderRow}`).value = "Do's & Don'ts";
      sopSheet.getCell(`R${dosHeaderRow}`).font = { bold: true, size: 13 };
      sopSheet.getCell(`R${dosHeaderRow}`).alignment = { horizontal: "center", vertical: "middle" };

      const contentStartRow = dosHeaderRow + 1;
      const contentEndRow = imageAreaEndRow;
      const contentHeight = contentEndRow - contentStartRow + 1;
      const itemHeight = 5;
      const numItemRows = Math.floor(contentHeight / itemHeight);
      const doColumns0based = [17, 19, 21];
      const dontColumns0based = [18, 20, 22];
      let maxDoDontEndRow = contentStartRow - 1;

      // Do's
      for (let iRow = 0; iRow < numItemRows; iRow++) {
        const rowStart = contentStartRow + iRow * itemHeight;
        for (let colLoop = 0; colLoop < 3; colLoop++) {
          const globalItemIdx = iRow * 3 + colLoop;
          if (globalItemIdx >= dos.length) break;
          const doItem = dos[globalItemIdx];
          const col0based = doColumns0based[colLoop];
          const col1based = col0based + 1;
          for (let h = 0; h < 3; h++) {
            sopSheet.getRow(rowStart + h).height = 30;
          }
          const descRow1 = rowStart + 3;
          const descRow2 = rowStart + 4;
          sopSheet.getRow(descRow1).height = 35;
          sopSheet.getRow(descRow2).height = 35;
          sopSheet.mergeCells(rowStart, col1based, rowStart + 2, col1based);
          if (doItem && doItem.image_b64) {
            try {
              const buffer = base64ToArrayBuffer(doItem.image_b64);
              const imageId = workbook.addImage({ buffer, extension: "jpeg" });
              sopSheet.addImage(imageId, {
                tl: { col: col0based, row: rowStart - 1 },
                br: { col: col0based + 1, row: rowStart + 2 },
              });
              imageRanges.push({
                startRow: rowStart,
                endRow: rowStart + 2,
                startCol: col1based,
                endCol: col1based
              });
            } catch (e) {
              console.error("Error adding Do's image:", e);
            }
          }
          sopSheet.mergeCells(descRow1, col1based, descRow2, col1based);
          const captionCell = sopSheet.getCell(descRow1, col1based);
          captionCell.value = doItem.text || "Do this";
          captionCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          captionCell.font = { size: 10, bold: false };
          maxDoDontEndRow = Math.max(maxDoDontEndRow, rowStart + 4);
        }
      }

      // Don'ts
      for (let iRow = 0; iRow < numItemRows; iRow++) {
        const rowStart = contentStartRow + iRow * itemHeight;
        for (let colLoop = 0; colLoop < 3; colLoop++) {
          const globalItemIdx = iRow * 3 + colLoop;
          if (globalItemIdx >= donts.length) break;
          const dontItem = donts[globalItemIdx];
          const col0based = dontColumns0based[colLoop];
          const col1based = col0based + 1;
          for (let h = 0; h < 3; h++) {
            sopSheet.getRow(rowStart + h).height = 30;
          }
          const descRow1 = rowStart + 3;
          const descRow2 = rowStart + 4;
          sopSheet.getRow(descRow1).height = 35;
          sopSheet.getRow(descRow2).height = 35;
          sopSheet.mergeCells(rowStart, col1based, rowStart + 2, col1based);
          if (dontItem && dontItem.image_b64) {
            try {
              const buffer = base64ToArrayBuffer(dontItem.image_b64);
              const imageId = workbook.addImage({ buffer, extension: "jpeg" });
              sopSheet.addImage(imageId, {
                tl: { col: col0based, row: rowStart - 1 },
                br: { col: col0based + 1, row: rowStart + 2 },
              });
              imageRanges.push({
                startRow: rowStart,
                endRow: rowStart + 2,
                startCol: col1based,
                endCol: col1based
              });
            } catch (e) {
              console.error("Error adding Don't image:", e);
            }
          }
          sopSheet.mergeCells(descRow1, col1based, descRow2, col1based);
          const captionCell = sopSheet.getCell(descRow1, col1based);
          captionCell.value = `• ${dontItem.text || "Don't do this"}`;
          captionCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          captionCell.font = { size: 10, bold: false, color: { argb: "FFFF0000" } };
          maxDoDontEndRow = Math.max(maxDoDontEndRow, rowStart + 4);
        }
      }

      // Qualities
      const qualities = parsedData.quality_inspection || [];
      if (qualities.length > 0) {
        const qualitiesHeaderRow = maxDoDontEndRow + 1;
        sopSheet.getRow(qualitiesHeaderRow).height = 30;
        sopSheet.mergeCells(`R${qualitiesHeaderRow}:W${qualitiesHeaderRow}`);
        sopSheet.getCell(`R${qualitiesHeaderRow}`).value = "Qualities";
        sopSheet.getCell(`R${qualitiesHeaderRow}`).font = { bold: true, size: 13 };
        sopSheet.getCell(`R${qualitiesHeaderRow}`).alignment = { horizontal: "center", vertical: "middle" };

        const qualitiesContentStartRow = qualitiesHeaderRow + 1;
        const numQualItemRows = Math.ceil(qualities.length / 3);
        const itemHeight = 5;
        let qualEndRow = qualitiesContentStartRow + numQualItemRows * itemHeight - 1;
        const currentRowCount = sopSheet.rowCount;
        if (qualEndRow > currentRowCount) {
          for (let r = currentRowCount + 1; r <= qualEndRow; r++) {
            sopSheet.addRow(new Array(23).fill(""));
          }
        }
        const qualColumns0based = [17, 19, 21];
        for (let iRow = 0; iRow < numQualItemRows; iRow++) {
          const rowStart = qualitiesContentStartRow + iRow * itemHeight;
          for (let colLoop = 0; colLoop < 3; colLoop++) {
            const globalItemIdx = iRow * 3 + colLoop;
            if (globalItemIdx >= qualities.length) break;
            const qItem = qualities[globalItemIdx];
            const col0based = qualColumns0based[colLoop];
            const col1based = col0based + 1;
            for (let h = 0; h < 3; h++) {
              sopSheet.getRow(rowStart + h).height = 30;
            }
            const descRow1 = rowStart + 3;
            const descRow2 = rowStart + 4;
            sopSheet.getRow(descRow1).height = 35;
            sopSheet.getRow(descRow2).height = 35;
            sopSheet.mergeCells(rowStart, col1based, rowStart + 2, col1based);
            if (qItem && qItem.image_b64) {
              try {
                const buffer = base64ToArrayBuffer(qItem.image_b64);
                const imageId = workbook.addImage({ buffer, extension: "jpeg" });
                sopSheet.addImage(imageId, {
                  tl: { col: col0based, row: rowStart - 1 },
                  br: { col: col0based + 1, row: rowStart + 2 },
                });
                imageRanges.push({
                  startRow: rowStart,
                  endRow: rowStart + 2,
                  startCol: col1based,
                  endCol: col1based
                });
              } catch (e) {
                console.error("Error adding Quality image:", e);
              }
            }
            sopSheet.mergeCells(descRow1, col1based, descRow2, col1based);
            const captionCell = sopSheet.getCell(descRow1, col1based);
            captionCell.value = qItem.text || "Quality description";
            captionCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            captionCell.font = { size: 10, bold: false };
          }
        }
        imageAreaEndRow = Math.max(imageAreaEndRow, qualEndRow);
      }
      rowNumber = Math.max(rowNumber, imageAreaEndRow + 1);
    }
  }

  sopSheet.addRow(new Array(23).fill(""));
  rowNumber++;

  /* ======================= ELEMENTAL STEPS TABLE ======================= */
  const tableHeaderRow1 = rowNumber;
  const tableHeaderRow2 = rowNumber + 1;
  {
    const row = new Array(23).fill("");
    row[0] = "Elemental Step No.";
    row[2] = "Elemental Steps Description";
    row[13] = "Power tools / Hand Tools Used";
    row[17] = "Standard Time / line Dori (Mins):";
    row[19] = "Quality Characteristics";
    row[21] = "Specification";
    row[22] = "Response";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${tableHeaderRow1}:B${tableHeaderRow1}`);
    sopSheet.mergeCells(`C${tableHeaderRow1}:M${tableHeaderRow1}`);
    sopSheet.mergeCells(`N${tableHeaderRow1}:Q${tableHeaderRow1}`);
    sopSheet.mergeCells(`R${tableHeaderRow1}:S${tableHeaderRow1}`);
    sopSheet.mergeCells(`T${tableHeaderRow1}:U${tableHeaderRow1}`);
    sopSheet.mergeCells(`V${tableHeaderRow1}:V${tableHeaderRow1}`);
    sopSheet.mergeCells(`W${tableHeaderRow1}:W${tableHeaderRow1}`);
    sopSheet.getRow(tableHeaderRow1).height = 30;
    sopSheet.getRow(tableHeaderRow1).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
    });
  }
  rowNumber++;
  {
    const row = new Array(23).fill("");
    row[19] = "Symbol (SC/CC)";
    row[20] = "Characteristics";
    sopSheet.addRow(row);
    sopSheet.getRow(tableHeaderRow2).height = 30;
    sopSheet.getRow(tableHeaderRow2).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
    });
  }
  rowNumber++;

  (parsedData.elemental_steps || []).forEach(step => {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = step.step_no || "";
    row[2] = step.description || "";
    row[13] = step.tools || "";
    row[17] = step.time_min || "";
    row[19] = step.symbol || "";
    row[20] = step.quality_char || "";
    row[21] = step.spec || "";
    row[22] = step.reaction || "";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:B${idx}`);
    sopSheet.mergeCells(`C${idx}:M${idx}`);
    sopSheet.mergeCells(`N${idx}:Q${idx}`);
    sopSheet.mergeCells(`R${idx}:S${idx}`);
    const r = sopSheet.getRow(idx);
    r.height = 45;
    r.getCell(3).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    r.getCell("N").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("T").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("U").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("V").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("W").alignment = { wrapText: true, vertical: "middle" };
    rowNumber++;
  });

  {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = "Total Standard Time/line Dori (Mins):";
    row[17] = parsedData.standard_time_min || "";
    row[19] = "Team Size:";
    row[20] = parsedData.team_size || "";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`A${idx}:Q${idx}`);
    sopSheet.mergeCells(`R${idx}:S${idx}`);
    sopSheet.mergeCells(`T${idx}:U${idx}`);
    sopSheet.mergeCells(`V${idx}:W${idx}`);
    sopSheet.getRow(idx).height = 40;
    sopSheet.getRow(idx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
    rowNumber++;
  }
  rowNumber++;

  /* ================= SAFETY REQUIREMENTS & PPE ================= */
  const safetyTitleRow1 = rowNumber;
  sopSheet.addRow(new Array(23).fill(""));
  const safetyTitleRow2 = safetyTitleRow1 + 1;
  sopSheet.addRow(new Array(23).fill(""));
  sopSheet.mergeCells(`A${safetyTitleRow1}:L${safetyTitleRow2}`);
  const leftCell = sopSheet.getCell(`A${safetyTitleRow1}`);
  leftCell.value = "Safety Requirements";
  leftCell.font = { bold: true, size: 14 };
  leftCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  leftCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
  sopSheet.mergeCells(`M${safetyTitleRow1}:W${safetyTitleRow2}`);
  const rightCell = sopSheet.getCell(`M${safetyTitleRow1}`);
  rightCell.value = "Safety PPE's";
  rightCell.font = { bold: true, size: 14 };
  rightCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  rightCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
  rowNumber = safetyTitleRow2 + 1;

  const safetyHeaderRow = rowNumber;
  {
    const row = new Array(23).fill("");
    row[0] = "Sl.No";
    row[1] = "Requirements";
    row[6] = "Remarks";
    row[12] = "Safety Items / Tools";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`B${safetyHeaderRow}:F${safetyHeaderRow}`);
    sopSheet.mergeCells(`G${safetyHeaderRow}:L${safetyHeaderRow}`);
    sopSheet.getRow(safetyHeaderRow).font = { bold: true };
    sopSheet.getRow(safetyHeaderRow).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sopSheet.getRow(safetyHeaderRow).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
    sopSheet.getRow(safetyHeaderRow).height = 40;
  }
  rowNumber++;

  const safetyList = parsedData.safety_ppe || [];
  const safetyDataStartRow = rowNumber;
  safetyList.forEach((ppe, i) => {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = ppe.sl_no || (i + 1);
    row[1] = ppe.requirement || "";
    row[6] = ppe.remarks || "";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`B${idx}:F${idx}`);
    sopSheet.mergeCells(`G${idx}:L${idx}`);
    const r = sopSheet.getRow(idx);
    r.height = 40;
    r.getCell(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    r.getCell(2).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    r.getCell(7).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    rowNumber++;
  });

  const customPPEImages = safetyList.filter(ppe => ppe.image_b64).slice(0, 5);
  if (customPPEImages.length > 0) {
    const imageHeight = 3;
    const captionOffset = 4;
    const groupHeight = 5;
    const firstRowImages = customPPEImages.slice(0, 4);
    const secondRowImages = customPPEImages.slice(4, 5);

    if (firstRowImages.length > 0) {
      const dataRowIdx = safetyDataStartRow;
      const imageTopRow = dataRowIdx;
      const captionRow = imageTopRow + captionOffset;
      while (sopSheet.rowCount < captionRow + 1) {
        sopSheet.addRow(new Array(23).fill(""));
      }
      sopSheet.getRow(captionRow).height = 25;
      for (let r = 0; r < imageHeight; r++) {
        sopSheet.getRow(imageTopRow + r).height = 35;
      }
      firstRowImages.forEach((ppe, idx) => {
        const colStart = 13 + idx * 2.5;
        const colEnd = colStart + 2;
        try {
          const buffer = base64ToArrayBuffer(ppe.image_b64);
          const imageId = workbook.addImage({ buffer, extension: "jpeg" });
          sopSheet.addImage(imageId, {
            tl: { col: colStart - 0.2, row: imageTopRow - 1 },
            br: { col: colEnd - 0.3, row: imageTopRow + imageHeight - 1 }
          });
          imageRanges.push({
            startRow: imageTopRow,
            endRow: imageTopRow + imageHeight - 1,
            startCol: Math.floor(colStart),
            endCol: Math.ceil(colEnd)
          });
        } catch (e) {
          console.error("Error adding custom PPE image:", e);
        }
        const captionCell = sopSheet.getCell(captionRow, Math.floor(colStart + 0.4));
        captionCell.value = ppe.requirement || `PPE ${idx + 1}`;
        captionCell.font = { size: 9, bold: true };
        captionCell.alignment = { horizontal: "center", vertical: "middle" };
        sopSheet.mergeCells(captionRow, Math.floor(colStart), captionRow, Math.ceil(colEnd) - 1);
      });
    }

    if (secondRowImages.length > 0) {
      const dataRowIdx = safetyDataStartRow + groupHeight;
      const imageTopRow = dataRowIdx;
      const captionRow = imageTopRow + captionOffset;
      while (sopSheet.rowCount < captionRow + 1) {
        sopSheet.addRow(new Array(23).fill(""));
      }
      sopSheet.getRow(captionRow).height = 25;
      for (let r = 0; r < imageHeight; r++) {
        sopSheet.getRow(imageTopRow + r).height = 35;
      }
      const ppe = secondRowImages[0];
      const colStart = 17;
      const colEnd = colStart + 2;
      try {
        const buffer = base64ToArrayBuffer(ppe.image_b64);
        const imageId = workbook.addImage({ buffer, extension: "jpeg" });
        sopSheet.addImage(imageId, {
          tl: { col: colStart - 0.2, row: imageTopRow - 1 },
          br: { col: colEnd - 0.3, row: imageTopRow + imageHeight - 1 }
        });
        imageRanges.push({
          startRow: imageTopRow,
          endRow: imageTopRow + imageHeight - 1,
          startCol: colStart,
          endCol: colEnd
        });
      } catch (e) {
        console.error("Error adding 5th PPE image:", e);
      }
      const captionCell = sopSheet.getCell(captionRow, colStart);
      captionCell.value = ppe.requirement || "PPE 5";
      captionCell.font = { size: 9, bold: true };
      captionCell.alignment = { horizontal: "center", vertical: "middle" };
      sopSheet.mergeCells(captionRow, colStart, captionRow, colEnd - 1);
    }

    const lastUsedRow = safetyDataStartRow + (secondRowImages.length > 0 ? 2 * groupHeight : groupHeight) - 1;
    rowNumber = Math.max(rowNumber, lastUsedRow + 1);
  }

  /* ================= REVISION HISTORY ================= */
  const revTitleRow1 = rowNumber;
  sopSheet.addRow(new Array(23).fill(""));
  const revTitleRow2 = revTitleRow1 + 1;
  sopSheet.addRow(new Array(23).fill(""));
  sopSheet.mergeCells(`A${revTitleRow1}:W${revTitleRow2}`);
  const revTitleCell = sopSheet.getCell(`A${revTitleRow1}`);
  revTitleCell.value = "Revision History";
  revTitleCell.font = { bold: true, size: 14 };
  revTitleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  revTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
  rowNumber = revTitleRow2 + 1;

  const revHeaderRow1 = rowNumber;
  sopSheet.addRow(new Array(23).fill(""));
  const revHeaderRow2 = revHeaderRow1 + 1;
  sopSheet.addRow(new Array(23).fill(""));
  sopSheet.mergeCells(`A${revHeaderRow1}:A${revHeaderRow2}`);
  sopSheet.mergeCells(`B${revHeaderRow1}:E${revHeaderRow2}`);
  sopSheet.mergeCells(`F${revHeaderRow1}:L${revHeaderRow2}`);
  sopSheet.mergeCells(`M${revHeaderRow1}:Q${revHeaderRow2}`);
  sopSheet.mergeCells(`R${revHeaderRow1}:T${revHeaderRow2}`);
  sopSheet.mergeCells(`U${revHeaderRow1}:W${revHeaderRow2}`);
  sopSheet.getCell(`A${revHeaderRow1}`).value = "Sl.No";
  sopSheet.getCell(`B${revHeaderRow1}`).value = "Revision No.";
  sopSheet.getCell(`F${revHeaderRow1}`).value = "Revision Details";
  sopSheet.getCell(`M${revHeaderRow1}`).value = "Reason For Revision";
  sopSheet.getCell(`R${revHeaderRow1}`).value = "Revision Date";
  sopSheet.getCell(`U${revHeaderRow1}`).value = "Remarks";

  [revHeaderRow1, revHeaderRow2].forEach((idx) => {
    const r = sopSheet.getRow(idx);
    r.font = { bold: true };
    r.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCDC" } };
  });

  rowNumber = revHeaderRow2 + 1;
  (parsedData.revision_history || []).forEach((rev) => {
    const idx = rowNumber;
    const row = new Array(23).fill("");
    row[0] = rev.sl_no || "";
    row[1] = rev.rev_no || "";
    row[5] = rev.details || "";
    row[12] = rev.reason || "";
    row[17] = rev.date || "";
    row[20] = rev.remark || "";
    sopSheet.addRow(row);
    sopSheet.mergeCells(`B${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:L${idx}`);
    sopSheet.mergeCells(`M${idx}:Q${idx}`);
    sopSheet.mergeCells(`R${idx}:T${idx}`);
    sopSheet.mergeCells(`U${idx}:W${idx}`);
    const r = sopSheet.getRow(idx);
    r.getCell("F").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("M").alignment = { wrapText: true, vertical: "middle" };
    r.getCell("U").alignment = { wrapText: true, vertical: "middle" };
    rowNumber++;
  });

  for (let i = (parsedData.revision_history || []).length; i < 3; i++) {
    const idx = rowNumber;
    sopSheet.addRow(new Array(23).fill(""));
    sopSheet.mergeCells(`B${idx}:E${idx}`);
    sopSheet.mergeCells(`F${idx}:L${idx}`);
    sopSheet.mergeCells(`M${idx}:Q${idx}`);
    sopSheet.mergeCells(`R${idx}:T${idx}`);
    sopSheet.mergeCells(`U${idx}:W${idx}`);
    rowNumber++;
  }

  sopSheet.addRow(new Array(23).fill(""));
  rowNumber++;

/* ================= SIGNATURES (exactly 10 rows - NAME → 1 space → ROLE → 2 spaces → UNDERLINE) ================= */
const sigStartRow = rowNumber + 2;   // Reasonable padding from previous content
for (let i = 0; i < 10; i++) {       // Reserve exactly 10 rows
  sopSheet.addRow(new Array(23).fill(""));
  rowNumber++;
}
const sigEndRow = sigStartRow + 9;   // Box = exactly 10 rows (sigEndRow - sigStartRow + 1 = 10)

// Reuse same data as header
const allSigners = [
  ...preparedNames.map(name => ({ name: name.trim(), role: "Prepared By" })),
  ...reviewedNames.map(name => ({ name: name.trim(), role: "Reviewed By" })),
  ...approvedNames.map(name => ({ name: name.trim(), role: "Approved By" })),
].filter(s => s.name && s.name.length > 0);

// Max 4 boxes
const MAX_BOXES = 4;
const numBoxes = Math.max(1, Math.min(allSigners.length, MAX_BOXES));

const boxRanges = [
  { start: "A", end: "F" },
  { start: "G", end: "L" },
  { start: "M", end: "R" },
  { start: "S", end: "W" },
];

// Merge exactly 10 rows for each box
for (let i = 0; i < numBoxes; i++) {
  const { start, end } = boxRanges[i];
  sopSheet.mergeCells(`${start}${sigStartRow}:${end}${sigEndRow}`);
}

// Pure white background + thick border
for (let i = 0; i < numBoxes; i++) {
  const { start, end } = boxRanges[i];
  const startCol = start.charCodeAt(0) - 64;
  const endCol   = end.charCodeAt(0)   - 64;
  for (let r = sigStartRow; r <= sigEndRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sopSheet.getRow(r).getCell(c);
      cell.border = {
        top:    { style: "medium" },
        left:   { style: "medium" },
        bottom: { style: "medium" },
        right:  { style: "medium" }
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" }   // Pure white
      };
    }
  }
}

// Place content with your spacing: Name → 1 space → Role → 2 spaces → Underline
allSigners.slice(0, numBoxes).forEach((signer, i) => {
  const { start } = boxRanges[i];

  // Name — row 2 of the box (top)
  const nameCell = sopSheet.getCell(`${start}${sigEndRow - 6}`);
  nameCell.value = signer.name;
  nameCell.font = { name: "Calibri", size: 16, bold: true };
  nameCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Role — row 4 of the box (after 1 space)
  const roleCell = sopSheet.getCell(`${start}${sigEndRow - 4}`);
  roleCell.value = signer.role;
  roleCell.font = { name: "Calibri", size: 14, bold: true };
  roleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Underline — row 8 of the box (after 2 spaces from role)
  const lineCell = sopSheet.getCell(`${start}${sigEndRow - 2}`);
  lineCell.value = "___________________________";
  lineCell.alignment = { horizontal: "center", vertical: "middle" };
  lineCell.font = { size: 12 };
});

// Debug (only if no data)
if (allSigners.length === 0 && numBoxes >= 1) {
  const debugCell = sopSheet.getCell(`A${sigStartRow + 5}`);
  debugCell.value = "DEBUG: No signers found";
  debugCell.font = { color: { argb: "FFFF0000" } };
}
  /* ================= BORDERS & FONTS ================= */
  const lastRow = sopSheet.rowCount;
  for (let r = 1; r <= lastRow; r++) {
    const row = sopSheet.getRow(r);
    for (let c = 1; c <= 23; c++) {
      const cell = row.getCell(c);
      let applyBorder = true;
      for (const range of imageRanges) {
        if (r >= range.startRow && r <= range.endRow && c >= range.startCol && c <= range.endCol) {
          applyBorder = false;
          break;
        }
      }
      if (applyBorder) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: c === 23 ? { style: "thick" } : { style: "thin" }
        };
      }
      const existing = cell.font || {};
      if (!existing.name) existing.name = "Calibri";
      if (!existing.size) existing.size = 12;
      cell.font = existing;
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle", wrapText: true };
      }
    }
  }

  if (sopSheet.getRow(15)) sopSheet.getRow(15).height = 90;
  if (sopSheet.getRow(22)) sopSheet.getRow(22).height = 90;

  return workbook;
};

export default generateExcelWorkbook;