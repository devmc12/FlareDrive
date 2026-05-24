import { Button, Toolbar, Typography } from "@mui/material";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Renders the top toolbar used by active file selection mode
 */

/**
 * Renders the header shown while file selection mode is active
 */
function SelectionModeToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onRangeSelect,
  onCancel,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onRangeSelect: () => void;
  onCancel: () => void;
}) {
  return (
    <Toolbar
      disableGutters
      sx={{
        backgroundColor: "primary.main",
        color: "primary.contrastText",
        columnGap: 1,
        minHeight: { xs: 56, sm: 64 },
        paddingX: 1.5,
      }}>
      <Typography
        component="div"
        sx={{
          flexGrow: 1,
          fontSize: { xs: 18, sm: 20 },
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
        {selectedCount}/{totalCount} selected
      </Typography>
      <Button color="inherit" disabled={!totalCount} onClick={onSelectAll}>
        Select All
      </Button>
      <Button
        color="inherit"
        disabled={selectedCount < 2}
        onClick={onRangeSelect}>
        Range Select
      </Button>
      <Button color="inherit" onClick={onCancel}>
        Cancel
      </Button>
    </Toolbar>
  );
}

export default SelectionModeToolbar;
