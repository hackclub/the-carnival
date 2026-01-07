DO $$ BEGIN
  CREATE TYPE "project_editor" AS ENUM (
    'vscode',
    'chrome',
    'firefox',
    'figma',
    'neovim',
    'gnu-emacs',
    'jupyterlab',
    'obsidian',
    'blender',
    'freecad',
    'kicad',
    'krita',
    'gimp',
    'inkscape',
    'godot-engine',
    'unity',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "project"
  ADD COLUMN IF NOT EXISTS "editor" "project_editor" NOT NULL DEFAULT 'vscode',
  ADD COLUMN IF NOT EXISTS "editor_other" text;


