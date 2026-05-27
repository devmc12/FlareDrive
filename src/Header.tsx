import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import { Box, IconButton, InputBase, Toolbar } from "@mui/material";
import { useState } from "react";

import type {
  GroupBy,
  SortDirection,
  SortField,
  ViewMode,
} from "./app/constants";
import type { FileCounts } from "./app/type";
import FileBrowserMenu from "./components/FileBrowserMenu";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Renders the file browser search bar and display control menu
 */

/**
 * Renders the search input and opens browser display controls
 */
function Header({
  search,
  fileCounts,
  onSearchChange,
  setShowProgressDialog,
  showAuthActions,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onViewModeChange,
  onSortFieldChange,
  onSortDirectionChange,
  onGroupByChange,
  onOpenSettings,
  onLogout,
  onLogoutAll,
}: {
  search: string;
  fileCounts: FileCounts;
  onSearchChange: (newSearch: string) => void;
  setShowProgressDialog: (show: boolean) => void;
  showAuthActions: boolean;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onViewModeChange: (viewMode: ViewMode) => void;
  onSortFieldChange: (sortField: SortField) => void;
  onSortDirectionChange: (sortDirection: SortDirection) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const folderLabel = `${fileCounts.folders} folder${
    fileCounts.folders === 1 ? "" : "s"
  }`;
  const fileLabel = `${fileCounts.files} file${
    fileCounts.files === 1 ? "" : "s"
  }`;
  const countLabel = `${folderLabel} / ${fileLabel}`;

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
      <Box
        component="span"
        aria-label={countLabel}
        title={countLabel}
        sx={{
          alignItems: "center",
          backgroundColor: "rgba(243, 128, 32, 0.12)",
          border: "1px solid",
          borderColor: "rgba(243, 128, 32, 0.3)",
          borderRadius: "999px",
          color: "primary.main",
          display: "inline-flex",
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 700,
          height: 36,
          justifyContent: "center",
          marginRight: 1,
          minWidth: 72,
          paddingX: 1.25,
        }}>
        {fileCounts.folders}F/{fileCounts.files}D
      </Box>
      <InputBase
        size="small"
        fullWidth
        placeholder="Search…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{
          backgroundColor: "whitesmoke",
          borderRadius: "999px",
          padding: "8px 16px",
          "& .MuiInputBase-input": {
            padding: 0,
          },
        }}
      />
      <IconButton
        aria-label="More"
        color="inherit"
        sx={{ marginLeft: 0.5 }}
        onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreHorizIcon />
      </IconButton>
      <FileBrowserMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        showAuthActions={showAuthActions}
        onClose={() => setAnchorEl(null)}
        viewMode={viewMode}
        sortField={sortField}
        sortDirection={sortDirection}
        groupBy={groupBy}
        onViewModeChange={onViewModeChange}
        onSortFieldChange={onSortFieldChange}
        onSortDirectionChange={onSortDirectionChange}
        onGroupByChange={onGroupByChange}
        onShowProgress={() => setShowProgressDialog(true)}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onLogoutAll={onLogoutAll}
      />
    </Toolbar>
  );
}

export default Header;
