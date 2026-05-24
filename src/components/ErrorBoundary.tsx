import { Box, Button, Typography } from "@mui/material";
import React from "react";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Catches uncaught React render errors and shows a recoverable fallback
 */

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Provides a top-level fallback when a child component throws during rendering
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught React error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            height: "100%",
            justifyContent: "center",
            padding: 3,
            textAlign: "center",
          }}>
          <Typography variant="h6">Something went wrong</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
            The file browser hit an unexpected rendering error. Reload the app
            to restore the current session.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
