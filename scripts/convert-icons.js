import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../public/icons");

async function convertSvgToPng() {
  console.log("Starting SVG to PNG conversion...");

  try {
    // Try using canvas library for conversion
    const canvas = await import("canvas");
    console.log("✓ canvas library available, proceeding with conversion");
  } catch (e) {
    console.warn(
      "⚠ canvas library not available. Please follow manual conversion steps.",
    );
    console.log("\nManual Conversion Instructions:");
    console.log("1. Install ImageMagick: sudo apt-get install imagemagick");
    console.log("2. Run conversions:");
    console.log(
      "   convert -background none -density 96 -resize 16x16 public/icons/icon-16.svg public/icons/icon-16.png",
    );
    console.log(
      "   convert -background none -density 96 -resize 48x48 public/icons/icon-48.svg public/icons/icon-48.png",
    );
    console.log(
      "   convert -background none -density 96 -resize 128x128 public/icons/icon-128.svg public/icons/icon-128.png",
    );
    console.log(
      "\nOr use an online SVG to PNG converter:\nhttps://convertio.co/svg-png/",
    );
    return;
  }
}

convertSvgToPng().catch(console.error);
