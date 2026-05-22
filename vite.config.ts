import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

type Difficulty = "easy" | "hard" | "brutal";

type SavePromptBody = {
  name?: string;
  slug?: string;
  category?: string;
  difficulty?: Difficulty | "all";
  imageDataUrl?: string;
  targetHsb?: [number, number, number];
};

type DeletePromptBody = {
  slug?: string;
};

type GeneratedPrompt = {
  slug: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  imageSrc: string;
  targetHsb: [number, number, number];
  active: true;
  sortOrder: number;
  createdAt: string;
};

const difficulties: Difficulty[] = ["easy", "hard", "brutal"];
const generatedDir = path.resolve("public/assets/prompts/generated");
const generatedPromptPath = path.join(generatedDir, "prompts.json");
const generatedCategoryPath = path.join(generatedDir, "categories.json");

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/color-game/" : "/",
  plugins: [debugPromptWriter()],
}));

function debugPromptWriter(): Plugin {
  return {
    name: "debug-prompt-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__debug/prompt-options", async (_req, res) => {
        try {
          const prompts = await readJson<GeneratedPrompt[]>(generatedPromptPath, []);
          const categories = await readJson<string[]>(generatedCategoryPath, []);
          sendJson(res, 200, {
            categories: normalizeCategories([
              ...categories,
              ...prompts.map((prompt) => prompt.category),
            ]),
            prompts,
          });
        } catch (error) {
          sendJson(res, 500, { error: errorMessage(error) });
        }
      });

      server.middlewares.use("/__debug/save-prompt", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = validateBody(await readRequestJson<SavePromptBody>(req));
          await mkdir(generatedDir, { recursive: true });

          const imageBuffer = decodePngDataUrl(body.imageDataUrl);
          const imageFileName = `${body.slug}.png`;
          const imageSrc = `/assets/prompts/generated/${imageFileName}`;
          await writeFile(path.join(generatedDir, imageFileName), imageBuffer);

          const prompts = await readJson<GeneratedPrompt[]>(generatedPromptPath, []);
          const categories = normalizeCategories([
            ...(await readJson<string[]>(generatedCategoryPath, [])),
            body.category,
          ]);
          const selectedDifficulties =
            body.difficulty === "all" ? difficulties : [body.difficulty];
          const existingWithoutPrompt = prompts.filter(
            (prompt) =>
              !(
                prompt.slug === body.slug &&
                selectedDifficulties.includes(prompt.difficulty)
              ),
          );
          const nextSortOrder =
            Math.max(0, ...existingWithoutPrompt.map((prompt) => prompt.sortOrder)) +
            10;
          const createdAt = new Date().toISOString();
          const nextPrompts = [
            ...existingWithoutPrompt,
            ...selectedDifficulties.map((difficulty, index) => ({
              slug: body.slug,
              name: body.name,
              category: body.category,
              difficulty,
              imageSrc,
              targetHsb: body.targetHsb,
              active: true as const,
              sortOrder: nextSortOrder + index,
              createdAt,
            })),
          ].sort((a, b) => a.sortOrder - b.sortOrder);

          await writeFile(generatedPromptPath, `${JSON.stringify(nextPrompts, null, 2)}\n`);
          await writeFile(generatedCategoryPath, `${JSON.stringify(categories, null, 2)}\n`);
          sendJson(res, 200, { prompts: nextPrompts, categories, imageSrc });
        } catch (error) {
          sendJson(res, 400, { error: errorMessage(error) });
        }
      });

      server.middlewares.use("/__debug/delete-prompt", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await readRequestJson<DeletePromptBody>(req);
          const slug = body.slug?.trim();
          if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            throw new Error("Invalid prompt slug");
          }

          const prompts = await readJson<GeneratedPrompt[]>(generatedPromptPath, []);
          const removed = prompts.filter((prompt) => prompt.slug === slug);
          const remaining = prompts.filter((prompt) => prompt.slug !== slug);
          if (!removed.length) throw new Error("Prompt not found");

          const remainingImageSrcs = new Set(
            remaining.map((prompt) => prompt.imageSrc),
          );
          await Promise.all(
            Array.from(new Set(removed.map((prompt) => prompt.imageSrc)))
              .filter((imageSrc) => !remainingImageSrcs.has(imageSrc))
              .map((imageSrc) =>
                rm(path.join("public", imageSrc.replace(/^\//, "")), {
                  force: true,
                }),
              ),
          );

          const categories = normalizeCategories(
            remaining.map((prompt) => prompt.category),
          );
          await writeFile(generatedPromptPath, `${JSON.stringify(remaining, null, 2)}\n`);
          await writeFile(generatedCategoryPath, `${JSON.stringify(categories, null, 2)}\n`);
          sendJson(res, 200, { prompts: remaining, categories });
        } catch (error) {
          sendJson(res, 400, { error: errorMessage(error) });
        }
      });
    },
  };
}

function validateBody(body: SavePromptBody): Required<SavePromptBody> {
  const name = body.name?.trim();
  const slug = body.slug?.trim();
  const category = body.category?.trim();
  const difficulty = body.difficulty || "all";
  const targetHsb = body.targetHsb;

  if (!name) throw new Error("Name is required");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must use lowercase letters, numbers, and hyphens");
  }
  if (!category) throw new Error("Category is required");
  if (!(difficulty === "all" || difficulties.includes(difficulty as Difficulty))) {
    throw new Error("Difficulty is invalid");
  }
  if (!body.imageDataUrl?.startsWith("data:image/png;base64,")) {
    throw new Error("PNG image data is required");
  }
  if (
    !Array.isArray(targetHsb) ||
    targetHsb.length !== 3 ||
    targetHsb.some((channel) => !Number.isFinite(channel))
  ) {
    throw new Error("Target color is required");
  }

  return {
    name,
    slug,
    category,
    difficulty,
    imageDataUrl: body.imageDataUrl,
    targetHsb: [
      clamp(Math.round(targetHsb[0]), 0, 359),
      clamp(Math.round(targetHsb[1]), 0, 100),
      clamp(Math.round(targetHsb[2]), 0, 100),
    ],
  };
}

function decodePngDataUrl(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
}

function normalizeCategories(categories: string[]): string[] {
  return Array.from(
    new Set(
      categories
        .map((category) => category.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents.replace(/^\uFEFF/, "")) as T;
  } catch {
    return fallback;
  }
}

function readRequestJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}") as T);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
