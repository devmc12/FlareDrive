import AudioFileIcon from "@mui/icons-material/AudioFile";
import CodeIcon from "@mui/icons-material/Code";
import FolderIcon from "@mui/icons-material/Folder";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PdfIcon from "@mui/icons-material/PictureAsPdf";
import VideoFileIcon from "@mui/icons-material/VideoFile";

import {
  ARCHIVE_CONTENT_TYPES,
  DIRECTORY_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
} from "./app/constants";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Chooses a Material icon for common file content types
 */

type MimeIconSize = "inherit" | "large" | "medium" | "small";

/**
 * Chooses a Material icon for a content type and display size
 */
function MimeIcon({
  contentType,
  fontSize = "large",
}: {
  contentType: string;
  fontSize?: MimeIconSize;
}) {
  const fallbackIcon = <InsertDriveFileOutlinedIcon fontSize={fontSize} />;
  if (typeof contentType !== "string") return fallbackIcon;

  return contentType.startsWith("image/") ? (
    <ImageIcon fontSize={fontSize} />
  ) : contentType.startsWith("audio/") ? (
    <AudioFileIcon fontSize={fontSize} />
  ) : contentType.startsWith("video/") ? (
    <VideoFileIcon fontSize={fontSize} />
  ) : contentType === PDF_CONTENT_TYPE ? (
    <PdfIcon fontSize={fontSize} />
  ) : (ARCHIVE_CONTENT_TYPES as readonly string[]).includes(contentType) ? (
    <FolderZipOutlinedIcon fontSize={fontSize} />
  ) : contentType.startsWith("text/") ? (
    <CodeIcon fontSize={fontSize} />
  ) : contentType === DIRECTORY_CONTENT_TYPE ? (
    <FolderIcon fontSize={fontSize} />
  ) : (
    fallbackIcon
  );
}

export default MimeIcon;
