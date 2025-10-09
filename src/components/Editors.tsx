import Reveal from "./Reveal";

type Editor = {
  name: string;
  docsUrl: string;
  kind: string;
  primaryLangs: string[];
  mechanism: string;
  free: string;
  iconSrc?: string;
};

const editors: Editor[] = [
  {
    name: "VS Code",
    docsUrl: "https://code.visualstudio.com/api/get-started/your-first-extension",
    kind: "Code Editor",
    primaryLangs: ["TypeScript", "JavaScript"],
    mechanism: "Web runtime (Node/DOM)",
    free: "Free",
    iconSrc: "/vscode.webp",
  },
  {
    name: "Chrome / Firefox",
    docsUrl: "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension",
    kind: "Browser",
    primaryLangs: ["TypeScript", "JavaScript"],
    mechanism: "WebExtensions API",
    free: "Free",
    iconSrc: "/chrome.webp",
  },
  {
    name: "Figma",
    docsUrl: "https://www.figma.com/plugin-docs/plugin-quickstart-guide/",
    kind: "Design",
    primaryLangs: ["TypeScript", "JavaScript"],
    mechanism: "Plugin API (UI/worker)",
    free: "Free",
    iconSrc: "/figma.webp",
  },
  {
    name: "Neovim",
    docsUrl: "https://neovim.io/doc/user/lua.html",
    kind: "Code Editor",
    primaryLangs: ["Lua", "Vimscript"],
    mechanism: "Embedded Lua",
    free: "FOSS",
    iconSrc: "/neovim.svg",
  },
  {
    name: "GNU Emacs",
    docsUrl: "https://www.gnu.org/software/emacs/manual/html_node/elisp/Introduction.html",
    kind: "Code Editor",
    primaryLangs: ["Emacs Lisp"],
    mechanism: "Embedded interpreter",
    free: "FOSS",
  },
  {
    name: "JupyterLab",
    docsUrl: "https://jupyterlab.readthedocs.io/en/2.2.x/developer/extension_dev.html",
    kind: "Notebook IDE",
    primaryLangs: ["TypeScript", "JavaScript"],
    mechanism: "Web modular extensions",
    free: "FOSS",
  },
  {
    name: "Obsidian",
    docsUrl: "https://github.com/obsidianmd/obsidian-sample-plugin",
    kind: "Knowledge Mgmt",
    primaryLangs: ["TypeScript", "JavaScript"],
    mechanism: "Front-end plugin API",
    free: "Free for all uses",
  },
  {
    name: "Blender",
    docsUrl: "https://docs.blender.org/api/current/",
    kind: "3D Suite",
    primaryLangs: ["Python"],
    mechanism: "Internal Python API",
    free: "FOSS (GPL)",
  },
  {
    name: "FreeCAD",
    docsUrl: "https://wiki.freecad.org/Python_scripting_tutorial",
    kind: "CAD",
    primaryLangs: ["Python"],
    mechanism: "Workbench/Macros",
    free: "FOSS",
  },
  {
    name: "Krita",
    docsUrl: "https://scripting.krita.org/",
    kind: "Digital Painting",
    primaryLangs: ["Python"],
    mechanism: "Scripting API",
    free: "FOSS",
  },
  {
    name: "GIMP",
    docsUrl: "https://developer.gimp.org/resource/script-fu/programmers-reference/",
    kind: "Raster Graphics",
    primaryLangs: ["Python", "Script-Fu", "C"],
    mechanism: "Multi-API (GObject)",
    free: "FOSS",
  },
  {
    name: "Inkscape",
    docsUrl: "https://inkscape.gitlab.io/extensions/documentation/tutorial/index.html",
    kind: "Vector Graphics",
    primaryLangs: ["Python"],
    mechanism: "External script execution",
    free: "FOSS",
  },
  {
    name: "Godot Engine",
    docsUrl: "https://docs.godotengine.org/en/4.4/tutorials/plugins/editor/making_plugins.html",
    kind: "Game Engine",
    primaryLangs: ["GDScript", "C#"],
    mechanism: "Editor plugins",
    free: "FOSS",
    iconSrc: "/unity.svg", // placeholder icon
  },
  {
    name: "Audacity",
    docsUrl: "https://manual.audacityteam.org/man/nyquist.html",
    kind: "Audio",
    primaryLangs: ["Nyquist (Lisp)"],
    mechanism: "Embedded DSL",
    free: "FOSS",
  },
  {
    name: "Your Editor / New Platform",
    docsUrl: "https://hackclub.slack.com/archives/C091ZRTMF16",
    kind: "New Platform Idea",
    primaryLangs: ["You decide"],
    mechanism: "Pitch it in #carnival — get feedback and collaborators",
    free: "TBD",
  },
];

const Editors = () => {
  return (
    <section id="editors" className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-amber-900">Editors & Platforms You Can Build For</h1>
          <p className="mt-2 text-amber-800">Free, hackable tools with real plugin ecosystems.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {editors.map((e, i) => (
            <Reveal
              key={e.name}
              className="rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm hover:shadow-md transform transition-all hover:-translate-y-0.5"
              hoverLift
              delaySec={i * 0.03}
            >
              <div className="flex items-center gap-3 mb-3">
                {e.iconSrc && (
                  <img src={e.iconSrc} alt="" role="presentation" className="h-6 w-6" />
                )}
                <h3 className="text-lg font-bold text-amber-900">{e.name}</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200">{e.free}</span>
              </div>
              <p className="text-sm text-amber-800 mb-2">{e.kind}</p>
              <div className="text-xs text-amber-700 mb-3">
                <div><span className="font-semibold">Languages:</span> {e.primaryLangs.join(", ")}</div>
                <div><span className="font-semibold">Mechanism:</span> {e.mechanism}</div>
              </div>
              <div className="flex gap-2">
                <a
                  href={e.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
                >
                  Docs
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Editors;


