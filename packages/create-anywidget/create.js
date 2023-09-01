import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import snakecase from "just-snake-case";

export async function create(target, options) {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const copyFrom = path.resolve(__dirname, options.template);
  const copyTo = target;
  const newName = snakecase(options.name); 

  const allFiles = await gatherFiles(copyFrom);
  const updatedFiles = renameGitignore(allFiles);
  const updatedContentFiles = replaceWidgetName(updatedFiles, newName); // Pass newName as argument
  const updatedPathFiles = updateFilePaths(updatedContentFiles, copyFrom, copyTo, newName); // Pass newName as argument

  console.log(copyTo);
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

function replaceWidgetName(files, newName) {
  return files.map((file) => {
    file.content = file.content.replace(/my_widget/g, newName);
    return file;
  });
}

function updateFilePaths(files, sourceDir, destDir, newName) {
  return files.map((file) => {
    let newPath = file.path.replace(sourceDir, destDir);
    newPath = newPath.replace(/my_widget/g, newName); // Replace folder name
    file.path = newPath;
    return file;
  });
}

async function createFiles(files) {
  const writePromises = files.map(async (file) => {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    // Write (or overwrite) the file
    await fs.writeFile(file.path, file.content, "utf-8");
    console.log(`Created: ${file.path}`);
  });

  return Promise.all(writePromises);
}
