import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  BooleanNumber,
  CellValueType,
  LocaleType,
  type ICellData,
  type IWorkbookData,
  type IWorksheetData,
} from "@univerjs/core";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import univerWorkerUrl from "@univerjs/preset-sheets-core/lib/es/worker.js?url";
import univerStyles from "@univerjs/preset-sheets-core/lib/index.css?raw";
import enUS from "@univerjs/preset-sheets-core/locales/en-US";
import { createUniver } from "@univerjs/presets";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";

import {
  fetchWebDavBlob,
  getWebDavFileUrl,
  openExternalFile,
} from "../../app/preview";

/**
 * Date: 2026-05-22
 * Time: 13:22
 * Desc: Loads and renders spreadsheet previews with local SheetJS and Univer
 */

type PreviewStatus = "loading" | "ready" | "error";

// Univer workbook model version used by generated local snapshots
const UNIVER_APP_VERSION = "3.0.0-alpha";

/**
 * Loads a spreadsheet only when spreadsheet preview is requested
 */
function SpreadsheetPreview({
  fileKey,
  filename,
}: {
  fileKey: string;
  filename: string;
}) {
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<IWorkbookData | null>(null);

  useEffect(() => {
    let canceled = false;
    setStatus("loading");
    setError(null);
    setSnapshot(null);

    Promise.all([loadSpreadsheet(fileKey, filename), injectUniverStyles()])
      .then(([nextSnapshot]) => {
        if (canceled) return;
        setSnapshot(nextSnapshot);
        setStatus("ready");
      })
      .catch((error) => {
        if (canceled) return;
        setError(
          error instanceof Error ? error.message : "Spreadsheet preview failed"
        );
        setStatus("error");
      });

    return () => {
      canceled = true;
    };
  }, [fileKey, filename]);

  if (status === "loading") {
    return (
      <CenteredPreview>
        <CircularProgress />
      </CenteredPreview>
    );
  }

  if (status === "error" || !snapshot) {
    return (
      <CenteredPreview>
        <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 520 }}>
          <Typography variant="h6">Spreadsheet preview failed</Typography>
          <Typography align="center" color="text.secondary">
            {error ?? "This spreadsheet can be downloaded or opened instead"}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => downloadUrl(getWebDavFileUrl(fileKey), filename)}>
              Download
            </Button>
            <Button onClick={() => openExternalFile(fileKey)}>Open</Button>
          </Stack>
        </Stack>
      </CenteredPreview>
    );
  }

  return <UniverSpreadsheetPreview snapshot={snapshot} />;
}

/**
 * Loads a spreadsheet workbook from a WebDAV object
 */
async function loadSpreadsheet(fileKey: string, filename: string) {
  const blob = await fetchWebDavBlob(fileKey);
  const workbook = XLSX.read(await blob.arrayBuffer(), {
    cellFormula: true,
    cellStyles: true,
    cellText: true,
    type: "array",
  });

  return createUniverWorkbookSnapshot(workbook, filename);
}

/**
 * Renders a Univer workbook snapshot in a local spreadsheet surface
 */
function UniverSpreadsheetPreview({ snapshot }: { snapshot: IWorkbookData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: enUS,
      },
      presets: [
        UniverSheetsCorePreset({
          container,
          disableAutoFocus: true,
          footer: {
            addSheetButtonConfig: { show: false },
            menus: false,
            sheetBar: true,
            statisticBar: false,
            zoomSlider: true,
          },
          formulaBar: true,
          header: false,
          toolbar: false,
          workerURL: univerWorkerUrl,
        }),
      ],
    });
    const workbook = univerAPI.createUniverSheet(snapshot);

    return () => {
      univerAPI.disposeUnit(workbook.getId());
      univer.dispose();
      container.innerHTML = "";
    };
  }, [snapshot]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flexGrow: 1,
        minHeight: 0,
        overflow: "hidden",
        "& .univer-menubar": {
          display: "none",
        },
      }}
    />
  );
}

/**
 * Creates a Univer workbook snapshot from a locally parsed workbook
 */
function createUniverWorkbookSnapshot(
  workbook: XLSX.WorkBook,
  filename: string
): IWorkbookData {
  const workbookId = `workbook-${Date.now()}`;
  const sheetOrder = workbook.SheetNames.map((_, index) => `sheet-${index}`);
  const sheets = Object.fromEntries(
    workbook.SheetNames.map((name, index) => {
      const worksheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
      const sheetId = sheetOrder[index];

      return [
        sheetId,
        createUniverWorksheetSnapshot({
          id: sheetId,
          name,
          range,
          worksheet,
        }),
      ];
    })
  );

  return {
    appVersion: UNIVER_APP_VERSION,
    id: workbookId,
    locale: LocaleType.EN_US,
    name: filename,
    resources: [] as unknown as IWorkbookData["resources"],
    sheetOrder,
    sheets,
    styles: {},
  };
}

/**
 * Creates a Univer worksheet snapshot from a SheetJS worksheet
 */
function createUniverWorksheetSnapshot({
  id,
  name,
  range,
  worksheet,
}: {
  id: string;
  name: string;
  range: XLSX.Range;
  worksheet: XLSX.WorkSheet;
}): Partial<IWorksheetData> {
  const rowCount = Math.max(range.e.r + 1, 100);
  const columnCount = Math.max(range.e.c + 1, 26);
  const cellData: IWorksheetData["cellData"] = {};

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;

      const univerCell = createUniverCellData(cell);
      if (!univerCell) continue;

      cellData[row] ??= {};
      cellData[row][column] = univerCell;
    }
  }

  return {
    cellData,
    columnCount,
    columnData: createUniverColumnData(worksheet),
    columnHeader: { height: 24 },
    defaultColumnWidth: 88,
    defaultRowHeight: 24,
    freeze: {
      startColumn: 0,
      startRow: 0,
      xSplit: 0,
      ySplit: 0,
    },
    hidden: BooleanNumber.FALSE,
    id,
    mergeData: createUniverMergeData(worksheet),
    name,
    rightToLeft: BooleanNumber.FALSE,
    rowCount,
    rowData: createUniverRowData(worksheet),
    rowHeader: { width: 46 },
    scrollLeft: 0,
    scrollTop: 0,
    showGridlines: BooleanNumber.TRUE,
    tabColor: "",
    zoomRatio: 1,
  };
}

/**
 * Converts one SheetJS cell into a Univer cell
 */
function createUniverCellData(cell: XLSX.CellObject): ICellData | null {
  const value = cell.v;
  if (value === undefined || value === null) return null;

  const univerCell: ICellData = {
    v:
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : String(value),
    t: getUniverCellType(cell),
  };
  if (cell.f) univerCell.f = `=${cell.f.replace(/^=/, "")}`;
  return univerCell;
}

/**
 * Resolves the Univer cell value type for a SheetJS cell
 */
function getUniverCellType(cell: XLSX.CellObject) {
  if (cell.t === "n" || typeof cell.v === "number") {
    return CellValueType.NUMBER;
  }
  if (cell.t === "b" || typeof cell.v === "boolean") {
    return CellValueType.BOOLEAN;
  }
  return CellValueType.STRING;
}

/**
 * Converts SheetJS merge ranges into Univer merge ranges
 */
function createUniverMergeData(worksheet: XLSX.WorkSheet) {
  return (worksheet["!merges"] ?? []).map((merge) => ({
    endColumn: merge.e.c,
    endRow: merge.e.r,
    startColumn: merge.s.c,
    startRow: merge.s.r,
  }));
}

/**
 * Converts SheetJS row metadata into Univer row metadata
 */
function createUniverRowData(worksheet: XLSX.WorkSheet) {
  return Object.fromEntries(
    (worksheet["!rows"] ?? [])
      .map((row, index) => [index, row?.hpt ? { h: row.hpt } : null] as const)
      .filter((entry): entry is readonly [number, { h: number }] =>
        Boolean(entry[1])
      )
  );
}

/**
 * Converts SheetJS column metadata into Univer column metadata
 */
function createUniverColumnData(worksheet: XLSX.WorkSheet) {
  return Object.fromEntries(
    (worksheet["!cols"] ?? [])
      .map((column, index) => {
        const width = column?.wpx ?? (column?.wch ? column.wch * 8 : undefined);
        return [index, width ? { w: width } : null] as const;
      })
      .filter((entry): entry is readonly [number, { w: number }] =>
        Boolean(entry[1])
      )
  );
}

/**
 * Centers spreadsheet loading and fallback content
 */
function CenteredPreview({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexGrow: 1,
        justifyContent: "center",
        minHeight: 0,
        overflow: "auto",
      }}>
      {children}
    </Box>
  );
}

/**
 * Starts a browser download for a URL
 */
function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

/**
 * Injects Univer styles from the lazy spreadsheet JavaScript chunk
 */
function injectUniverStyles() {
  const styleId = "flaredrive-univer-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = univerStyles;
  document.head.appendChild(style);
}

export default SpreadsheetPreview;
