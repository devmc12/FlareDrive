import { Home as HomeIcon } from "@mui/icons-material";
import { Breadcrumbs, Button, Link, Typography } from "@mui/material";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Renders clickable file browser path breadcrumbs
 */

/**
 * Renders clickable path segments for the current directory
 */
function PathBreadcrumb({
  path,
  onCwdChange,
}: {
  path: string;
  onCwdChange: (newCwd: string) => void;
}) {
  const parts = path.replace(/\/$/, "").split("/");

  return (
    <Breadcrumbs separator="›" sx={{ padding: 1 }}>
      <Button onClick={() => onCwdChange("")} sx={{ minWidth: 0, padding: 0 }}>
        <HomeIcon />
      </Button>
      {parts.map((part, index) =>
        index === parts.length - 1 ? (
          <Typography key={index} color="text.primary">
            {part}
          </Typography>
        ) : (
          <Link
            key={index}
            component="button"
            onClick={() => {
              onCwdChange(parts.slice(0, index + 1).join("/") + "/");
            }}>
            {part}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
}

export default PathBreadcrumb;
