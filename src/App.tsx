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
import ProgressDialog, { ProgressDialogTab } from "./ProgressDialog";
import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from "./app/preview";
import { TransferQueueProvider } from "./app/transferQueue";
import type { FileCounts } from "./app/type";
import ErrorBoundary from "./components/ErrorBoundary";
import SettingsDialog from "./components/SettingsDialog";
import UploadProgressBar from "./components/UploadProgressBar";

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
  const [fileCounts, setFileCounts] = useState<FileCounts>({
    folders: 0,
    files: 0,
  });
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadAppSettings()
  );
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = React.useState(false);
  const [progressDialogTab, setProgressDialogTab] = useState(
    ProgressDialogTab.Downloads
  );
  const [bottomActionBarOpen, setBottomActionBarOpen] = useState(false);
  const [operationModeOpen, setOperationModeOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /**
   * Opens the progress dialog directly to the upload task list
   */
  function openUploadsProgress() {
    setProgressDialogTab(ProgressDialogTab.Uploads);
    setShowProgressDialog(true);
  }

  /**
   * Persists user settings and updates the active app state
   */
  function handleSettingsChange(nextSettings: AppSettings) {
    setSettings(nextSettings);
    saveAppSettings(nextSettings);
  }

  /**
   * Persists partial setting changes without losing recently updated fields
   */
  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((currentSettings) => {
      const nextSettings = { ...currentSettings, ...patch };
      saveAppSettings(nextSettings);
      return nextSettings;
    });
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <TransferQueueProvider>
        <ErrorBoundary>
          <Stack sx={{ height: "100%" }}>
            {!operationModeOpen && (
              <Header
                search={search}
                fileCounts={fileCounts}
                onSearchChange={(newSearch: string) => setSearch(newSearch)}
                setShowProgressDialog={setShowProgressDialog}
                viewMode={settings.viewMode}
                sortField={settings.sortField}
                sortDirection={settings.sortDirection}
                groupBy={settings.groupBy}
                onViewModeChange={(viewMode) => updateSettings({ viewMode })}
                onSortFieldChange={(sortField) => updateSettings({ sortField })}
                onSortDirectionChange={(sortDirection) =>
                  updateSettings({ sortDirection })
                }
                onGroupByChange={(groupBy) => updateSettings({ groupBy })}
                onOpenSettings={() => setShowSettingsDialog(true)}
              />
            )}
            <Main
              search={search}
              onError={setError}
              onStatusMessage={setStatusMessage}
              onFileCountsChange={setFileCounts}
              settings={settings}
              viewMode={settings.viewMode}
              sortField={settings.sortField}
              sortDirection={settings.sortDirection}
              groupBy={settings.groupBy}
              onBottomActionBarVisibilityChange={setBottomActionBarOpen}
              onOperationModeVisibilityChange={setOperationModeOpen}
            />
          </Stack>
          <ProgressDialog
            open={showProgressDialog}
            onClose={() => setShowProgressDialog(false)}
            tab={progressDialogTab}
            onTabChange={setProgressDialogTab}
          />
          <UploadProgressBar
            lifted={bottomActionBarOpen}
            onOpenUploads={openUploadsProgress}
          />
          <SettingsDialog
            open={showSettingsDialog}
            settings={settings}
            onChange={handleSettingsChange}
            onClose={() => setShowSettingsDialog(false)}
          />
        </ErrorBoundary>
        <Snackbar
          autoHideDuration={5000}
          open={Boolean(error)}
          message={error?.message}
          onClose={() => setError(null)}
        />
        <Snackbar
          autoHideDuration={3000}
          open={Boolean(statusMessage)}
          message={statusMessage}
          onClose={() => setStatusMessage(null)}
        />
      </TransferQueueProvider>
    </ThemeProvider>
  );
}

export default App;
