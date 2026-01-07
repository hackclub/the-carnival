-- Create editors table
CREATE TABLE IF NOT EXISTS "editor" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "icon_url" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- Create resource type enum
DO $$ BEGIN
  CREATE TYPE "resource_type" AS ENUM ('video', 'documentation', 'article');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create resources table
CREATE TABLE IF NOT EXISTS "resource" (
  "id" text PRIMARY KEY NOT NULL,
  "editor_id" text NOT NULL REFERENCES "editor"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "description" text,
  "type" "resource_type" NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- Seed initial editors based on the existing enum values
INSERT INTO "editor" ("id", "name", "slug", "description", "created_at", "updated_at") VALUES
  (gen_random_uuid()::text, 'VS Code', 'vscode', 'Visual Studio Code - A lightweight but powerful source code editor', NOW(), NOW()),
  (gen_random_uuid()::text, 'Chrome', 'chrome', 'Google Chrome Browser Extensions', NOW(), NOW()),
  (gen_random_uuid()::text, 'Firefox', 'firefox', 'Mozilla Firefox Browser Add-ons', NOW(), NOW()),
  (gen_random_uuid()::text, 'Figma', 'figma', 'Figma Design Tool Plugins', NOW(), NOW()),
  (gen_random_uuid()::text, 'Neovim', 'neovim', 'Neovim - Hyperextensible Vim-based text editor', NOW(), NOW()),
  (gen_random_uuid()::text, 'GNU Emacs', 'gnu-emacs', 'GNU Emacs - An extensible, customizable text editor', NOW(), NOW()),
  (gen_random_uuid()::text, 'JupyterLab', 'jupyterlab', 'JupyterLab - Web-based interactive development environment', NOW(), NOW()),
  (gen_random_uuid()::text, 'Obsidian', 'obsidian', 'Obsidian - A knowledge base and note-taking app', NOW(), NOW()),
  (gen_random_uuid()::text, 'Blender', 'blender', 'Blender - Open-source 3D creation suite', NOW(), NOW()),
  (gen_random_uuid()::text, 'FreeCAD', 'freecad', 'FreeCAD - Open-source parametric 3D modeler', NOW(), NOW()),
  (gen_random_uuid()::text, 'KiCad', 'kicad', 'KiCad - Open-source electronics design automation suite', NOW(), NOW()),
  (gen_random_uuid()::text, 'Krita', 'krita', 'Krita - Professional free and open-source painting program', NOW(), NOW()),
  (gen_random_uuid()::text, 'GIMP', 'gimp', 'GIMP - GNU Image Manipulation Program', NOW(), NOW()),
  (gen_random_uuid()::text, 'Inkscape', 'inkscape', 'Inkscape - Open-source vector graphics editor', NOW(), NOW()),
  (gen_random_uuid()::text, 'Godot Engine', 'godot-engine', 'Godot Engine - Open-source game engine', NOW(), NOW()),
  (gen_random_uuid()::text, 'Unity', 'unity', 'Unity - Cross-platform game engine', NOW(), NOW())
ON CONFLICT DO NOTHING;

