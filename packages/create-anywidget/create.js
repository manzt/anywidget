// @ts-check

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import snakecase from "just-snake-case";

export async function create(target, options) {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

  const copyFrom = path.resolve(__dirname, options.template);
  const copyTo = target;

  // read all files from the template folder and store them in a json file
  const allFiles = await gatherFiles(copyFrom);

  // rename the path that is named _gitignore to .gitignore
  const updatedFiles = renameGitignore(allFiles);

  const updatedContentFiles = replaceWidgetName(updatedFiles, options);

  const updatedPathFiles = updateFilePaths(updatedContentFiles, copyFrom, copyTo);
  try {
    await createFiles(updatedPathFiles);
    console.log("All files created successfully!");
  } catch (err) {
    console.error("Error writing files:", err);
  }
}

async function gatherFiles(startDir) {
  const results = [];

  async function walk(dir) {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const entry = path.join(dir, file);
      const stats = await fs.stat(entry);

      if (stats.isDirectory()) {
        await walk(entry);
      } else {
        const content = await fs.readFile(entry, "utf-8");
        results.push({ content, path: entry });
      }
    }
  }

  await walk(startDir);
  return results;
}

function renameGitignore(files) {
  return files.map((file) => {
    if (path.basename(file.path) === "_gitignore") {
      file.path = path.join(path.dirname(file.path), ".gitignore");
    }
    return file;
  });
}

function replaceWidgetName(files, options) {
  const newName = snakecase(options.name);
  return files.map((file) => {
    file.content = file.content.replace(/my_widget/g, newName);
    return file;
  });
}
function updateFilePaths(files, sourceDir, destDir) {
  return files.map((file) => {
    file.path = file.path.replace(sourceDir, destDir);
    return file;
  });
}

/**
 * Writes the files to the specified paths with the given content.
 * @param {Array} files - The array of file objects to write.
 * @returns {Promise} Resolves when all files are written.
 */
async function createFiles(files) {
  const writePromises = files.map(async (file) => {
    // Ensure the directory structure exists
    await fs.mkdir(path.dirname(file.path), { recursive: true });

    // Write (or overwrite) the file
    await fs.writeFile(file.path, file.content, "utf-8");

    // Log the file that was written
    console.log(`Created: ${file.path}`);
  });

  return Promise.all(writePromises);
}
