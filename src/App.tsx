import { ThemeProvider } from "@emotion/react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Stack,
} from "@mui/material";
import React, { useState } from "react";

import Header from "./Header";
import Main from "./Main";
import ProgressDialog from "./ProgressDialog";
import {
  DEFAULT_GROUP_BY,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  DEFAULT_VIEW_MODE,
  type GroupBy,
  type SortDirection,
  type SortField,
  type ViewMode,
} from "./app/constants";
import { TransferQueueProvider } from "./app/transferQueue";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Provides the top-level theme, layout, browser display state, and dialogs
 */

const globalStyles = (
  <GlobalStyles styles={{ "html, body, #root": { height: "100%" } }} />
);

const theme = createTheme({
  palette: { primary: { main: "#f38020" } },
});

/**
 * Provides app shell state, theme, and top-level dialogs
 */
function App() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW_MODE);
  const [sortField, setSortField] = useState<SortField>(DEFAULT_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION
  );
  const [groupBy, setGroupBy] = useState<GroupBy>(DEFAULT_GROUP_BY);
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [error, setError] = useState<Error | null>(null);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
        <Stack sx={{ height: "100%" }}>
          <Header
            search={search}
            onSearchChange={(newSearch: string) => setSearch(newSearch)}
            setShowProgressDialog={setShowProgressDialog}
            viewMode={viewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            groupBy={groupBy}
            onViewModeChange={setViewMode}
            onSortFieldChange={setSortField}
            onSortDirectionChange={setSortDirection}
            onGroupByChange={setGroupBy}
          />
          <Main
            search={search}
            onError={setError}
            viewMode={viewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            groupBy={groupBy}
          />
        </Stack>
        <Snackbar
          autoHideDuration={5000}
          open={Boolean(error)}
          message={error?.message}
          onClose={() => setError(null)}
        />
        <ProgressDialog
          open={showProgressDialog}
          onClose={() => setShowProgressDialog(false)}
        />
      </TransferQueueProvider>
    </ThemeProvider>
  );
}

export default App;
