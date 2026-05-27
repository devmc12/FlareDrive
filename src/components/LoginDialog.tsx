import {
  LockOutlined as LockOutlinedIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import { useState, type FormEvent } from "react";

import { loginWithPassword, type AuthStatus } from "../app/auth";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Renders the password-auth login dialog without storing credentials
 */

type LoginDialogProps = {
  open: boolean;
  onAuthenticated: (status: AuthStatus) => void;
  onError: (error: Error) => void;
};

/**
 * Renders a blocking sign-in dialog for password auth mode
 */
function LoginDialog({ open, onAuthenticated, onError }: LoginDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  /**
   * Submits the login request and stores only the server session cookie
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setLoginError(null);
    try {
      const status = await loginWithPassword({ username, password, remember });
      setPassword("");
      onAuthenticated(status);
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error("Login failed");
      setLoginError(nextError.message);
      onError(nextError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog fullWidth maxWidth="xs" open={open}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ alignItems: "center", display: "flex", gap: 1 }}>
          <Box
            component="span"
            sx={{
              alignItems: "center",
              backgroundColor: "rgba(243, 128, 32, 0.12)",
              borderRadius: "50%",
              color: "primary.main",
              display: "inline-flex",
              height: 34,
              justifyContent: "center",
              width: 34,
            }}>
            <LockOutlinedIcon fontSize="small" />
          </Box>
          Sign in
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ paddingTop: 1 }}>
            {loginError && <Alert severity="error">{loginError}</Alert>}
            <TextField
              autoFocus
              fullWidth
              autoComplete="username"
              disabled={busy}
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              fullWidth
              autoComplete="current-password"
              disabled={busy}
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        edge="end"
                        onClick={() => setShowPassword((show) => !show)}>
                        {showPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={remember}
                  disabled={busy}
                  onChange={(event) => setRemember(event.target.checked)}
                />
              }
              label="Keep me signed in"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !username || !password}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default LoginDialog;
