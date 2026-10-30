import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Ensures an MP4 or any uploaded video is encoded in standard, universally playable H.264 (avc1/yuv420p)
 * with faststart header (+faststart) so all HTML5 browsers can play it immediately without black screen.
 *
 * @param {string} filePath - Absolute or relative file path to the video file
 * @returns {string} - The filePath (original or transcoded)
 */
export function transcodeToBrowserMp4(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return filePath;
  }

  // Verify ffmpeg binary is available
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.warn("⚠️ ffmpeg binary not available, skipping transcode");
    return filePath;
  }

  const ext = path.extname(filePath);
  const tempOutput = filePath.replace(ext, `_browser_temp_${Date.now()}.mp4`);

  try {
    // Run ffmpeg with universal H.264 + AAC settings
    // -c:v libx264: standard H.264 codec
    // -pix_fmt yuv420p: progressive 8-bit YUV 4:2:0 format (100% browser compatibility)
    // -movflags +faststart: moves moov atom to the beginning so streaming starts instantly
    // -c:a aac: standard AAC audio codec
    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-i", filePath,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "128k",
        tempOutput
      ],
      { stdio: "pipe", timeout: 45000 }
    );

    if (fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 0) {
      // Safely replace original file with the transcoded web-ready version
      fs.unlinkSync(filePath);
      fs.renameSync(tempOutput, filePath);
      console.log(`✅ [videoTranscoder] Transcoded video to browser H.264: ${filePath}`);
    }
  } catch (err) {
    console.warn(`⚠️ [videoTranscoder] Transcode skipped/failed for ${filePath}:`, err.message);
    if (fs.existsSync(tempOutput)) {
      try {
        fs.unlinkSync(tempOutput);
      } catch (_) {}
    }
  }

  return filePath;
}
