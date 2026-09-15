import ExcelJS from "exceljs";

const BORDER_COLOR = "FFCCCCCC";

const cellBorder = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

const NUMERIC_KEY_PATTERN =
  /amount|total|balance|debit|credit|price|qty|rate|tax|percent|slno|round/i;

const isNumericColumn = (col, value) => {
  if (col.key === "slno" || col.virtual) return false;
  if (typeof value === "number") return true;
  return NUMERIC_KEY_PATTERN.test(col.key);
};

const columnAlignment = (col, numeric) => {
  if (col.key === "slno" || col.virtual) return "left";
  if (col.align === "right") return "right";
  if (col.align === "center") return "center";
  return numeric ? "right" : "left";
};

const columnNumberFormat = (col) => {
  if (col.key === "slno" || col.virtual) return "0";
  return "#,##0.00";
};

const styleSheet = (sheet, columns) => {
  const lastRow = sheet.rowCount;
  const columnCount = columns.length;

  for (let rowIndex = 1; rowIndex <= lastRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const isHeader = rowIndex === 1;

    for (let colIndex = 1; colIndex <= columnCount; colIndex += 1) {
      const cell = row.getCell(colIndex);
      cell.border = cellBorder;

      if (isHeader) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        continue;
      }

      const col = columns[colIndex - 1];
      const numeric = isNumericColumn(col, cell.value);

      cell.alignment = {
        vertical: "middle",
        horizontal: columnAlignment(col, numeric),
        wrapText: true,
      };

      if (numeric && typeof cell.value === "number") {
        cell.numFmt = columnNumberFormat(col);
      } else if ((col.key === "slno" || col.virtual) && typeof cell.value === "number") {
        cell.numFmt = columnNumberFormat(col);
      }
    }

    row.height = isHeader ? 22 : 18;
    row.commit();
  }

  sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
};

export const buildWorkbook = async (rows, columns, sheetName = "Report") => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((col) => ({
    key: col.key,
    width: col.width || Math.max(String(col.header).length + 4, 14),
  }));

  const headerRow = sheet.addRow(columns.map((col) => col.header));
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  for (const [index, row] of rows.entries()) {
    sheet.addRow(
      columns.map((col) => {
        if (col.key === "slno" || col.virtual) return index + 1;
        return col.get(row, index);
      })
    );
  }

  styleSheet(sheet, columns);

  return workbook.xlsx.writeBuffer();
};

export const sendExcel = async (res, rows, columns, filename, sheetName) => {
  const buffer = await buildWorkbook(rows, columns, sheetName);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  res.send(Buffer.from(buffer));
};

export const pickColumns = (allColumns, selectedKeys) => {
  if (!selectedKeys?.length) return allColumns;
  const set = new Set(selectedKeys);
  return allColumns.filter((col) => set.has(col.key));
};
