import Reveal from "./Reveal";

type UpgradeItem = {
  title: string;
  description: string;
  items: string[];
  accentHex: string;
};

const CATEGORIES: UpgradeItem[] = [
  {
    title: "Creative Tools",
    description: "Software and licenses that spark your next breakthrough.",
    items: [
      "Procreate license 🎨",
      "JetBrains IDE license 🧑‍💻",
      "Design tools 🖌️",
      "Cursor Pro ⚡",
      "Dev software subscriptions or licenses 🧰",
    ],
    accentHex: "#f59e0b",
  },
  {
    title: "Hardware & Peripherals",
    description: "Devices and workspace upgrades to supercharge your setup.",
    items: [
      "Peripherals 🖥️⌨️🖱️",
      "Keyboard & Mouse ⌨️🖱️",
      "Headphones or earphones 🎧",
      "Laptop or monitor stands 📐",
      "Monitor 🖥️",
      "USB or extension hub 🔌",
      "Cable management 🪢",
      "External SSD 💾",
      "Power bank 🔋",
      "Chargers or cables 🔌",
      "Desk/work mat 🧻",
    ],
    accentHex: "#fbbf24",
  },
  {
    title: "Computers & Upgrades",
    description: "Performance boosts and parts that keep you shipping.",
    items: [
      "Computer upgrades 🚀",
      "PC upgrades 🛠️",
      "Development hardware 🧰",
      "Arduino or Raspberry Pi kit 🤖🥧",
      "Raspberry Pi 🥧",
      "Electronic components 🔩",
      "3D printer upgrade items 🧩",
      "Filament for Bambu Labs A1 Mini 🧵",
      "Specialty devices 🧪",
    ],
    accentHex: "#f59e0b",
  },
  {
    title: "Infrastructure & Credits",
    description: "Internet services that power your projects.",
    items: [
      "Domain credits 🔑",
      "Cloud hosting ☁️",
      "Hosting credits ☁️💳",
      "API access 🔗",
      "AI credits 🤖",
      "Other dev services 💼",
      "Development services 🧰",
    ],
    accentHex: "#d97706",
  },
];

function Card({ title, description, items, accentHex }: UpgradeItem) {
  return (
    <Reveal className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="h-2 w-8 rounded-full"
          style={{ backgroundColor: accentHex }}
          aria-hidden
        />
        <h3 className="text-lg font-semibold text-amber-900">{title}</h3>
      </div>
      <p className="text-sm text-amber-800 mb-3">{description}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-amber-900">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-amber-50/70 ring-1 ring-amber-200 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

type ShopGroup = {
  title: string;
  emoji: string;
  shops: string[];
};

const SHOP_GROUPS: ShopGroup[] = [
  {
    title: "Online Marketplaces",
    emoji: "🛒",
    shops: [
      "Amazon — huge selection of electronics, components, and tools.",
      "AliExpress — inexpensive electronic parts, modules, sensors, and accessories.",
      "eBay — used and new electronics, rare parts, refurbished gear.",
      "Newegg — computer parts, gaming equipment, and DIY electronics.",
    ],
  },
  {
    title: "Maker & Components",
    emoji: "🧰",
    shops: [
      "Adafruit — maker electronics, sensors, Arduino/Raspberry Pi kits.",
      "SparkFun — DIY electronics, development boards, and educational kits; very beginner-friendly.",
      "Digi-Key — professional-grade electronic components and semiconductors.",
      "Mouser Electronics — similar to Digi-Key; great for serious engineering projects.",
      "Tindie — marketplace for indie hardware makers.",
      "Seeed Studio — development boards, IoT modules, and PCBs.",
      "RobotShop — robotics kits and sensors.",
    ],
  },
  {
    title: "PCB Fabrication",
    emoji: "🧩",
    shops: [
      "PCBWay / JLCPCB — PCB manufacturing and component sourcing.",
    ],
  },
  {
    title: "Retail Stores",
    emoji: "🏬",
    shops: [
      "Best Buy (US, Canada) — consumer electronics, laptops, phones.",
      "Micro Center (US) — computer parts, peripherals, and maker gear.",
      "Fry’s Electronics — historical mention (mostly closed).",
      "Currys (UK) — consumer electronics and appliances.",
      "MediaMarkt (Europe) — computers, phones, TVs, and gadgets.",
    ],
  },
];

function ShopsGroupCard({ title, emoji, shops }: ShopGroup) {
  return (
    <Reveal className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-2 w-8 rounded-full bg-amber-300" aria-hidden />
        <h3 className="text-lg font-semibold text-amber-900">{emoji} {title}</h3>
      </div>
      <ul className="space-y-2 text-sm text-amber-900">
        {shops.map((s) => (
          <li key={s} className="rounded-lg bg-amber-50/70 ring-1 ring-amber-200 px-3 py-2">
            {s}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

export default function Upgrades() {
  return (
    <section className="pt-24 pb-16" aria-labelledby="upgrades-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 id="upgrades-heading" className="text-2xl md:text-3xl font-extrabold text-amber-900">
            Upgrades Gallery
          </h1>
          <p className="mt-2 text-amber-800">
            A curated list of tools, hardware, and services you can request to
            upgrade your developer environment.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            If you have something in mind that isn’t listed, ask in #carnival before purchase.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((cat) => (
            <Card key={cat.title} {...cat} />
          ))}
        </div>

        <div className="mt-12">
          <div className="text-center mb-4">
            <h2 className="text-xl md:text-2xl font-extrabold text-amber-900">Where to buy</h2>
            <p className="mt-1 text-sm text-amber-700">
              Common places to purchase upgrades. If you want to buy from somewhere else, please ask in #carnival first.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SHOP_GROUPS.map((group) => (
              <ShopsGroupCard key={group.title} {...group} />
            ))}
          </div>
        </div>

        <div className="mt-10 text-xs text-amber-700 text-center">
          <p>
            Licenses and credits include things like design tools, IDEs, domain and hosting credits, and API/AI access.
            Please attribute and follow vendor license terms when applicable.
          </p>
        </div>
      </div>
    </section>
  );
}


