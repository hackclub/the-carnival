import type { ProjectEditor } from "@/db/schema";

const LABELS: Record<ProjectEditor, string> = {
  vscode: "VS Code",
  chrome: "Chrome",
  firefox: "Firefox",
  figma: "Figma",
  neovim: "Neovim",
  "gnu-emacs": "GNU Emacs",
  jupyterlab: "JupyterLab",
  obsidian: "Obsidian",
  blender: "Blender",
  freecad: "FreeCAD",
  kicad: "KiCad",
  krita: "Krita",
  gimp: "GIMP",
  inkscape: "Inkscape",
  "godot-engine": "Godot Engine",
  unity: "Unity",
  other: "Other",
};

export default function ProjectEditorBadge({
  editor,
  editorOther,
}: {
  editor: ProjectEditor;
  editorOther?: string | null;
}) {
  const other = (editorOther ?? "").trim();
  const label = editor === "other" && other ? `Other: ${other}` : LABELS[editor];

  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-muted text-foreground border-border">
      {label}
    </span>
  );
}


