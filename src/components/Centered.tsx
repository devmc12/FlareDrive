import { Box } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Centers loading and empty-state content inside the browser body
 */

/**
 * Centers content inside the available browser body area
 */
function Centered({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "center",
      }}>
      {children}
    </Box>
  );
}

export default Centered;
