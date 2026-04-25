import { readdir } from "fs/promises";

/**
 * Generates a unique filename with incrementing numbers if file already exists.
 * Pattern: baseName.pdf, baseName1.pdf, baseName2.pdf, etc.
 *
 * @param dir - Directory path to check for existing files
 * @param baseName - Base filename without extension (e.g., "Fee-plan-Md-Kaif-ALI")
 * @param extension - File extension without dot (e.g., "pdf")
 * @returns Unique filename with extension
 */
export async function generateUniqueFilename(
  dir: string,
  baseName: string,
  extension: string = "pdf",
): Promise<string> {
  try {
    const files = await readdir(dir);
    const pattern = new RegExp(`^${baseName}(\\d*)\\.${extension}$`);
    let maxNum = 0;

    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const numStr = match[1];
        if (numStr) {
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    // If baseName.pdf exists, start from 1, otherwise use baseName without number
    const baseExists = files.includes(`${baseName}.${extension}`);
    if (baseExists && maxNum === 0) {
      maxNum = 1;
    } else if (maxNum > 0) {
      maxNum++;
    }

    return maxNum > 0 ? `${baseName}${maxNum}.${extension}` : `${baseName}.${extension}`;
  } catch {
    // If directory doesn't exist or readdir fails, return base name
    return `${baseName}.${extension}`;
  }
}
