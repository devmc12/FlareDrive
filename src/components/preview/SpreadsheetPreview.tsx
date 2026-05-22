import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  BooleanNumber,
  BorderStyleTypes,
  CellValueType,
  HorizontalAlign,
  LocaleType,
  VerticalAlign,
  WrapStrategy,
  type IBorderData,
  type ICellData,
  type IStyleData,
  type IWorkbookData,
  type IWorksheetData,
} from "@univerjs/core";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import univerWorkerUrl from "@univerjs/preset-sheets-core/lib/es/worker.js?url";
import univerStyles from "@univerjs/preset-sheets-core/lib/index.css?raw";
import enUS from "@univerjs/preset-sheets-core/locales/en-US";
import { createUniver } from "@univerjs/presets";
import { strFromU8, unzipSync } from "fflate";
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
type CellStyleMap = Map<string, Map<string, IStyleData>>;
type SheetJsCellStyle = {
  bgColor?: { rgb?: string };
  fgColor?: { rgb?: string };
};
type XlsxBorderSide = {
  color?: string;
  style?: string;
};
type XlsxBorder = Partial<
  Record<"bottom" | "left" | "right" | "top", XlsxBorderSide>
>;

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
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    cellFormula: true,
    cellStyles: true,
    cellText: true,
    type: "array",
  });
  const cellStyles = filename.toLowerCase().endsWith(".xlsx")
    ? loadXlsxCellStyles(arrayBuffer, workbook.SheetNames)
    : new Map();

  return createUniverWorkbookSnapshot(workbook, filename, cellStyles);
}

/**
 * Renders a Univer workbook snapshot in a local spreadsheet surface
 */
function UniverSpreadsheetPreview({ snapshot }: { snapshot: IWorkbookData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const host = document.createElement("div");
    host.style.height = "100%";
    host.style.minHeight = "0";
    container.replaceChildren(host);

    const worker = new Worker(univerWorkerUrl, { type: "module" });
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: enUS,
      },
      presets: [
        UniverSheetsCorePreset({
          container: host,
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
          workerURL: worker,
        }),
      ],
    });
    const workbook = univerAPI.createUniverSheet(snapshot);

    return () => {
      window.setTimeout(() => {
        try {
          univerAPI.disposeUnit(workbook.getId());
        } catch {
          // Univer can already be partially disposed during React strict cleanup
        }
        try {
          univer.dispose();
        } catch {
          // Univer owns an internal React root that may already be unmounted
        }
        worker.terminate();
        host.remove();
      });
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
        "& [data-range-selector] > div:first-of-type > div:first-of-type": {
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
  filename: string,
  cellStyles: CellStyleMap
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
          cellStyles: cellStyles.get(name),
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
  cellStyles,
  id,
  name,
  range,
  worksheet,
}: {
  cellStyles?: Map<string, IStyleData>;
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
      const style = createUniverStyleData(cell, cellStyles?.get(address));
      if (!cell && !style) continue;

      const univerCell = createUniverCellData(cell, style);
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
function createUniverCellData(
  cell: XLSX.CellObject | undefined,
  style?: IStyleData
): ICellData | null {
  const value = cell?.v;
  if ((value === undefined || value === null) && !cell?.f && !style) {
    return null;
  }

  const univerCell: ICellData = {
    v:
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : value === undefined || value === null
          ? undefined
          : String(value),
    t: cell ? getUniverCellType(cell) : undefined,
  };
  if (cell?.f) univerCell.f = `=${cell.f.replace(/^=/, "")}`;
  if (style) univerCell.s = style;
  return univerCell;
}

/**
 * Converts available SheetJS and XLSX XML style data into Univer style data
 */
function createUniverStyleData(
  cell: XLSX.CellObject | undefined,
  xmlStyle?: IStyleData
) {
  const style: IStyleData = { ...(xmlStyle ?? {}) };
  const sheetStyle = cell?.s as SheetJsCellStyle | undefined;
  const background = normalizeExcelColor(
    sheetStyle?.fgColor?.rgb ?? sheetStyle?.bgColor?.rgb
  );
  if (background) style.bg = { rgb: background };

  return Object.keys(style).length ? style : undefined;
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
 * Loads cell styles from OOXML parts because SheetJS CE does not expose all formatting
 */
function loadXlsxCellStyles(
  arrayBuffer: ArrayBuffer,
  sheetNames: string[]
): CellStyleMap {
  try {
    const files = unzipSync(new Uint8Array(arrayBuffer));
    const stylesXml = readZipText(files, "xl/styles.xml");
    const workbookXml = readZipText(files, "xl/workbook.xml");
    const workbookRelsXml = readZipText(files, "xl/_rels/workbook.xml.rels");
    if (!stylesXml || !workbookXml || !workbookRelsXml) return new Map();

    const stylesByStyleIndex = parseXlsxStylesByStyleIndex(stylesXml);
    const sheetPaths = parseXlsxSheetPaths(workbookXml, workbookRelsXml);
    const stylesBySheet = new Map<string, Map<string, IStyleData>>();

    sheetNames.forEach((sheetName) => {
      const sheetPath = sheetPaths.get(sheetName);
      const sheetXml = sheetPath ? readZipText(files, sheetPath) : null;
      if (!sheetXml) return;

      const sheetStyles = parseXlsxSheetCellStyles(
        sheetXml,
        stylesByStyleIndex
      );
      if (sheetStyles.size) stylesBySheet.set(sheetName, sheetStyles);
    });

    return stylesBySheet;
  } catch {
    return new Map();
  }
}

/**
 * Parses workbook relationships into sheet XML paths by sheet name
 */
function parseXlsxSheetPaths(workbookXml: string, workbookRelsXml: string) {
  const workbookDoc = parseXml(workbookXml);
  const relsDoc = parseXml(workbookRelsXml);
  const relTargets = new Map<string, string>();

  getElementsByLocalName(relsDoc, "Relationship").forEach((relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (!id || !target) return;
    relTargets.set(id, normalizeXlsxPath(target));
  });

  const sheetPaths = new Map<string, string>();
  getElementsByLocalName(workbookDoc, "sheet").forEach((sheet) => {
    const name = sheet.getAttribute("name");
    const relationshipId =
      sheet.getAttribute("r:id") ??
      sheet.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id"
      );
    const path = relationshipId ? relTargets.get(relationshipId) : null;
    if (name && path) sheetPaths.set(name, path);
  });

  return sheetPaths;
}

/**
 * Parses cell style definitions and maps style indexes to Univer style data
 */
function parseXlsxStylesByStyleIndex(stylesXml: string) {
  const doc = parseXml(stylesXml);
  const borderDefinitions = getDirectChildrenByLocalName(
    getFirstElementByLocalName(doc, "borders"),
    "border"
  ).map(parseXlsxBorder);

  return getDirectChildrenByLocalName(
    getFirstElementByLocalName(doc, "cellXfs"),
    "xf"
  ).map((xf) => {
    const style: IStyleData = {};
    const borderId = Number(xf.getAttribute("borderId") ?? 0);
    const border = convertXlsxBorder(borderDefinitions[borderId]);
    const alignment = getDirectChildByLocalName(xf, "alignment");
    const horizontalAlign = getUniverHorizontalAlign(
      alignment?.getAttribute("horizontal")
    );
    const verticalAlign = getUniverVerticalAlign(
      alignment?.getAttribute("vertical")
    );
    const wrapStrategy = getUniverWrapStrategy(
      alignment?.getAttribute("wrapText")
    );

    if (border) style.bd = border;
    if (horizontalAlign !== undefined) style.ht = horizontalAlign;
    if (verticalAlign !== undefined) style.vt = verticalAlign;
    if (wrapStrategy !== undefined) style.tb = wrapStrategy;

    return Object.keys(style).length ? style : undefined;
  });
}

/**
 * Parses sheet cells with style indexes into Univer style data
 */
function parseXlsxSheetCellStyles(
  sheetXml: string,
  stylesByStyleIndex: (IStyleData | undefined)[]
) {
  const doc = parseXml(sheetXml);
  const cellStyles = new Map<string, IStyleData>();

  getElementsByLocalName(doc, "c").forEach((cell) => {
    const address = cell.getAttribute("r");
    const styleIndex = Number(cell.getAttribute("s") ?? -1);
    const style = stylesByStyleIndex[styleIndex];
    if (!address || !style) return;
    cellStyles.set(address, style);
  });

  return cellStyles;
}

/**
 * Parses one OOXML border definition
 */
function parseXlsxBorder(border: Element): XlsxBorder {
  return {
    bottom: parseXlsxBorderSide(getDirectChildByLocalName(border, "bottom")),
    left: parseXlsxBorderSide(getDirectChildByLocalName(border, "left")),
    right: parseXlsxBorderSide(getDirectChildByLocalName(border, "right")),
    top: parseXlsxBorderSide(getDirectChildByLocalName(border, "top")),
  };
}

/**
 * Parses one OOXML border side
 */
function parseXlsxBorderSide(side: Element | null): XlsxBorderSide | undefined {
  const style = side?.getAttribute("style");
  if (!side || !style) return undefined;

  return {
    color: normalizeExcelColor(
      getDirectChildByLocalName(side, "color")?.getAttribute("rgb")
    ),
    style,
  };
}

/**
 * Converts one OOXML border definition into Univer border data
 */
function convertXlsxBorder(border: XlsxBorder | undefined) {
  if (!border) return undefined;

  const univerBorder: IBorderData = {};
  const top = convertXlsxBorderSide(border.top);
  const right = convertXlsxBorderSide(border.right);
  const bottom = convertXlsxBorderSide(border.bottom);
  const left = convertXlsxBorderSide(border.left);

  if (top) univerBorder.t = top;
  if (right) univerBorder.r = right;
  if (bottom) univerBorder.b = bottom;
  if (left) univerBorder.l = left;

  return Object.keys(univerBorder).length ? univerBorder : undefined;
}

/**
 * Converts one OOXML border side into Univer style data
 */
function convertXlsxBorderSide(side: XlsxBorderSide | undefined) {
  const style = getUniverBorderStyle(side?.style);
  if (!style) return undefined;

  return {
    cl: { rgb: side?.color ?? "#000000" },
    s: style,
  };
}

/**
 * Maps OOXML border style names to Univer border styles
 */
function getUniverBorderStyle(style: string | undefined) {
  switch (style) {
    case "dashDot":
      return BorderStyleTypes.DASH_DOT;
    case "dashDotDot":
      return BorderStyleTypes.DASH_DOT_DOT;
    case "dashed":
      return BorderStyleTypes.DASHED;
    case "dotted":
      return BorderStyleTypes.DOTTED;
    case "double":
      return BorderStyleTypes.DOUBLE;
    case "hair":
      return BorderStyleTypes.HAIR;
    case "medium":
      return BorderStyleTypes.MEDIUM;
    case "mediumDashDot":
      return BorderStyleTypes.MEDIUM_DASH_DOT;
    case "mediumDashDotDot":
      return BorderStyleTypes.MEDIUM_DASH_DOT_DOT;
    case "mediumDashed":
      return BorderStyleTypes.MEDIUM_DASHED;
    case "slantDashDot":
      return BorderStyleTypes.SLANT_DASH_DOT;
    case "thick":
      return BorderStyleTypes.THICK;
    case "thin":
      return BorderStyleTypes.THIN;
    default:
      return undefined;
  }
}

/**
 * Maps OOXML horizontal alignment names to Univer values
 */
function getUniverHorizontalAlign(value: string | null | undefined) {
  switch (value) {
    case "center":
    case "centerContinuous":
      return HorizontalAlign.CENTER;
    case "distributed":
      return HorizontalAlign.DISTRIBUTED;
    case "justify":
      return HorizontalAlign.JUSTIFIED;
    case "left":
      return HorizontalAlign.LEFT;
    case "right":
      return HorizontalAlign.RIGHT;
    default:
      return undefined;
  }
}

/**
 * Maps OOXML vertical alignment names to Univer values
 */
function getUniverVerticalAlign(value: string | null | undefined) {
  switch (value) {
    case "bottom":
      return VerticalAlign.BOTTOM;
    case "center":
      return VerticalAlign.MIDDLE;
    case "top":
      return VerticalAlign.TOP;
    default:
      return undefined;
  }
}

/**
 * Maps OOXML wrap text flags to a Univer wrap strategy
 */
function getUniverWrapStrategy(value: string | null | undefined) {
  if (value === "1" || value === "true") return WrapStrategy.WRAP;
  return undefined;
}

/**
 * Reads one ZIP entry as UTF-8 text
 */
function readZipText(files: Record<string, Uint8Array>, path: string) {
  const file = files[path];
  return file ? strFromU8(file) : null;
}

/**
 * Normalizes workbook relationship targets to ZIP entry paths
 */
function normalizeXlsxPath(path: string) {
  if (path.startsWith("/")) return path.slice(1);
  return path.startsWith("xl/") ? path : `xl/${path}`;
}

/**
 * Parses an XML string into a DOM document
 */
function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

/**
 * Gets all elements with one local tag name
 */
function getElementsByLocalName(root: ParentNode, name: string) {
  return Array.from(root.querySelectorAll("*")).filter(
    (element) => element.localName === name
  );
}

/**
 * Gets the first element with one local tag name
 */
function getFirstElementByLocalName(root: ParentNode, name: string) {
  return getElementsByLocalName(root, name)[0] ?? null;
}

/**
 * Gets direct child elements with one local tag name
 */
function getDirectChildrenByLocalName(
  root: Element | Document | null,
  name: string
) {
  if (!root) return [];
  return Array.from(root.children).filter((child) => child.localName === name);
}

/**
 * Gets the first direct child element with one local tag name
 */
function getDirectChildByLocalName(root: Element, name: string) {
  return getDirectChildrenByLocalName(root, name)[0] ?? null;
}

/**
 * Converts Excel ARGB/RGB colors into CSS hex colors
 */
function normalizeExcelColor(color: string | null | undefined) {
  if (!color) return undefined;
  const normalizedColor = color.startsWith("#") ? color.slice(1) : color;
  if (!/^[0-9a-f]{6,8}$/i.test(normalizedColor)) return undefined;
  return `#${normalizedColor.slice(-6)}`;
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
