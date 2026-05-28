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
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { loginWithPassword, type AuthStatus } from "../app/auth";
import TurnstileWidget from "./TurnstileWidget";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Renders the password-auth login dialog without storing credentials
 */

type LoginDialogProps = {
  open: boolean;
  turnstileRequired?: boolean;
  turnstileSiteKey?: string;
  onAuthenticated: (status: AuthStatus) => void;
  onError: (error: Error) => void;
};

/**
 * Renders a blocking sign-in dialog for password auth mode
 */
function LoginDialog({
  open,
  turnstileRequired = false,
  turnstileSiteKey,
  onAuthenticated,
  onError,
}: LoginDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const turnstileUnavailable = turnstileRequired && !turnstileSiteKey;

  useEffect(() => {
    if (!open) return;

    setLoginError(null);
    setTurnstileToken(null);
    setTurnstileResetKey((currentKey) => currentKey + 1);
  }, [open]);

  /**
   * Stores a Turnstile render or challenge error for the current login attempt
   */
  const handleTurnstileError = useCallback(
    (message: string) => setLoginError(message),
    []
  );

  /**
   * Submits the login request and stores only the server session cookie
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (turnstileRequired && !turnstileToken) {
      setLoginError("Complete verification before signing in");
      return;
    }

    setBusy(true);
    setLoginError(null);
    try {
      const status = await loginWithPassword({
        username,
        password,
        remember,
        turnstileToken: turnstileToken ?? undefined,
      });
      setPassword("");
      onAuthenticated(status);
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error("Login failed");
      setLoginError(nextError.message);
      onError(nextError);
      setTurnstileToken(null);
      setTurnstileResetKey((currentKey) => currentKey + 1);
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
            {turnstileUnavailable && (
              <Alert severity="error">Turnstile is not configured</Alert>
            )}
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
            {turnstileSiteKey && (
              <TurnstileWidget
                key={turnstileResetKey}
                siteKey={turnstileSiteKey}
                disabled={busy}
                onTokenChange={setTurnstileToken}
                onError={handleTurnstileError}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            type="submit"
            variant="contained"
            disabled={
              busy ||
              !username ||
              !password ||
              turnstileUnavailable ||
              (turnstileRequired && !turnstileToken)
            }>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default LoginDialog;
