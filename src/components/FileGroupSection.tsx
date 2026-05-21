import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
} from "@mui/icons-material";
import { Box, ButtonBase, Collapse, Typography } from "@mui/material";
import React, { useState } from "react";

/**
 * Date: 2026-05-21
 * Time: 15:06
 * Desc: Displays a collapsible Windows-style file group section
 */

/**
 * Displays a collapsible group header with count and divider
 */
function FileGroupSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Box sx={{ paddingX: 1, paddingTop: 1 }}>
      <ButtonBase
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        sx={{
          alignItems: "center",
          color: "primary.main",
          display: "flex",
          justifyContent: "flex-start",
          minHeight: 28,
          textAlign: "left",
          width: "100%",
        }}>
        {expanded ? (
          <KeyboardArrowDownIcon fontSize="small" />
        ) : (
          <KeyboardArrowRightIcon fontSize="small" />
        )}
        <Typography
          component="span"
          sx={{
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1,
            marginLeft: 0.25,
            whiteSpace: "nowrap",
          }}>
          {label} ({count})
        </Typography>
        <Box
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            flexGrow: 1,
            marginLeft: 1,
          }}
        />
      </ButtonBase>
      <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
        {children}
      </Collapse>
    </Box>
  );
}

export default FileGroupSection;
