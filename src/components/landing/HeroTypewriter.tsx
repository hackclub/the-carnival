"use client";

import Typewriter from "typewriter-effect";

export default function HeroTypewriter() {
  return (
    <Typewriter
      options={{
        strings: [
          "Figma: Palette Crossfade — live theme morphs",
          "VS Code: Questline — turn TODOs/tests into quests",
          "Chrome: Tone Tuner — soften comment drafts",
          "Godot/Unity: ReelBuilder — export vertical gameplay highlights for TikTok",
          "KiCad: Badge Forge — auto-generate PCB name tags",
        ],
        autoStart: true,
        loop: true,
      }}
    />
  );
}


