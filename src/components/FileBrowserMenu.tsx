import {
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
} from "@mui/icons-material";
import {
  Box,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from "@mui/material";
import type { MouseEvent } from "react";
import { useState } from "react";

import {
  FILE_BROWSER_SUBMENU_OFFSET_PX,
  FileBrowserSubmenu,
  GROUP_BY_OPTIONS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_OPTIONS,
  VIEW_MODE_OPTIONS,
  type GroupBy,
  type SortDirection,
  type SortField,
  type ViewMode,
} from "../app/constants";

/**
 * Date: 2026-05-21
 * Time: 15:06
 * Desc: Renders file browser view, sort, and group menu controls
 */

type FileBrowserMenuProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  showAuthActions: boolean;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onClose: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onSortFieldChange: (sortField: SortField) => void;
  onSortDirectionChange: (sortDirection: SortDirection) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onShowProgress: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
};

/**
 * Renders click-driven view, sort, and group controls for the file browser
 */
function FileBrowserMenu({
  anchorEl,
  open,
  showAuthActions,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onClose,
  onViewModeChange,
  onSortFieldChange,
  onSortDirectionChange,
  onGroupByChange,
  onShowProgress,
  onOpenSettings,
  onLogout,
  onLogoutAll,
}: FileBrowserMenuProps) {
  const [submenu, setSubmenu] = useState<FileBrowserSubmenu | null>(null);
  const [submenuAnchorEl, setSubmenuAnchorEl] = useState<HTMLElement | null>(
    null
  );

  // Open secondary menu panels by click so desktop and touch share behavior
  const selectSubmenu =
    (nextSubmenu: FileBrowserSubmenu) => (event: MouseEvent<HTMLElement>) => {
      setSubmenu(nextSubmenu);
      setSubmenuAnchorEl(event.currentTarget);
    };

  // Close root and secondary menu layers together
  const closeAll = () => {
    setSubmenu(null);
    setSubmenuAnchorEl(null);
    onClose();
  };

  // Reset submenu state when the root menu is dismissed externally
  const handleRootClose = () => {
    setSubmenu(null);
    setSubmenuAnchorEl(null);
    onClose();
  };

  return (
    <>
      <Menu anchorEl={anchorEl} open={open} onClose={handleRootClose}>
        <RootMenuItem
          label="View as"
          selected={submenu === FileBrowserSubmenu.View}
          onOpen={selectSubmenu(FileBrowserSubmenu.View)}
        />
        <RootMenuItem
          label="Sort by"
          selected={submenu === FileBrowserSubmenu.Sort}
          onOpen={selectSubmenu(FileBrowserSubmenu.Sort)}
        />
        <RootMenuItem
          label="Group by"
          selected={submenu === FileBrowserSubmenu.Group}
          onOpen={selectSubmenu(FileBrowserSubmenu.Group)}
        />
        <Divider />
        <MenuItem
          onClick={() => {
            closeAll();
            onShowProgress();
          }}>
          Progress
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeAll();
            onOpenSettings();
          }}>
          Settings
        </MenuItem>
        {showAuthActions && [
          <Divider key="auth-divider" />,
          <MenuItem
            key="logout"
            onClick={() => {
              closeAll();
              onLogout();
            }}>
            Logout
          </MenuItem>,
          <MenuItem
            key="logout-all"
            onClick={() => {
              closeAll();
              onLogoutAll();
            }}>
            Logout all devices
          </MenuItem>,
        ]}
      </Menu>

      <Popper
        anchorEl={submenuAnchorEl}
        open={open && Boolean(submenu && submenuAnchorEl)}
        modifiers={[
          {
            name: "offset",
            options: { offset: [0, FILE_BROWSER_SUBMENU_OFFSET_PX] },
          },
        ]}
        placement="left-start"
        sx={(theme) => ({ zIndex: theme.zIndex.modal + 1 })}>
        <Paper elevation={8} sx={{ maxWidth: "calc(100vw - 24px)" }}>
          <MenuList dense sx={{ minWidth: 0, width: "max-content" }}>
            {submenu === FileBrowserSubmenu.View &&
              VIEW_MODE_OPTIONS.map((option) => (
                <CheckedMenuItem
                  key={option.value}
                  label={option.label}
                  selected={viewMode === option.value}
                  onClick={() => {
                    onViewModeChange(option.value);
                    closeAll();
                  }}
                />
              ))}

            {submenu === FileBrowserSubmenu.Sort && (
              <>
                {SORT_FIELD_OPTIONS.map((option) => (
                  <CheckedMenuItem
                    key={option.value}
                    label={option.label}
                    selected={sortField === option.value}
                    onClick={() => {
                      onSortFieldChange(option.value);
                      closeAll();
                    }}
                  />
                ))}
                <Divider />
                {SORT_DIRECTION_OPTIONS.map((option) => (
                  <CheckedMenuItem
                    key={option.value}
                    label={option.label}
                    selected={sortDirection === option.value}
                    onClick={() => {
                      onSortDirectionChange(option.value);
                      closeAll();
                    }}
                  />
                ))}
              </>
            )}

            {submenu === FileBrowserSubmenu.Group &&
              GROUP_BY_OPTIONS.map((option) => (
                <CheckedMenuItem
                  key={option.value}
                  label={option.label}
                  selected={groupBy === option.value}
                  onClick={() => {
                    onGroupByChange(option.value);
                    closeAll();
                  }}
                />
              ))}
          </MenuList>
        </Paper>
      </Popper>
    </>
  );
}

/**
 * Renders a root menu row that opens a secondary panel on click
 */
function RootMenuItem({
  label,
  selected,
  onOpen,
}: {
  label: string;
  selected: boolean;
  onOpen: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <MenuItem selected={selected} onClick={onOpen}>
      <ListItemText>{label}</ListItemText>
      <ChevronLeftIcon fontSize="small" />
    </MenuItem>
  );
}

/**
 * Renders a submenu row with a compact checkmark selection gutter
 */
function CheckedMenuItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <MenuItem selected={selected} onClick={onClick} sx={{ columnGap: 0.75 }}>
      <Box
        component="span"
        sx={{
          alignItems: "center",
          color: "inherit",
          display: "inline-flex",
          flexShrink: 0,
          justifyContent: "center",
          width: 18,
        }}>
        {selected && <CheckIcon sx={{ fontSize: 18 }} />}
      </Box>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );
}

export default FileBrowserMenu;
