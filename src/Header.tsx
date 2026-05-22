import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import { IconButton, InputBase, Toolbar } from "@mui/material";
import { useState } from "react";

import type {
  GroupBy,
  SortDirection,
  SortField,
  ViewMode,
} from "./app/constants";
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
  onSearchChange,
  setShowProgressDialog,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onViewModeChange,
  onSortFieldChange,
  onSortDirectionChange,
  onGroupByChange,
  onOpenSettings,
}: {
  search: string;
  onSearchChange: (newSearch: string) => void;
  setShowProgressDialog: (show: boolean) => void;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onViewModeChange: (viewMode: ViewMode) => void;
  onSortFieldChange: (sortField: SortField) => void;
  onSortDirectionChange: (sortDirection: SortDirection) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onOpenSettings: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
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
      />
    </Toolbar>
  );
}

export default Header;
