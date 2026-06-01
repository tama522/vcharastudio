import type {
  CharacterCatalogOption,
  CharacterColorPalette,
  CharacterCustomField,
  CharacterDraftInput,
  GenerationRequestInput,
  SceneTemplate,
} from "@/lib/types";

function options(definitions: Array<[string, string, string, string?, Partial<CharacterCatalogOption>?]>) {
  return definitions.map(([id, label, prompt, description, extra]) => ({
    id,
    label,
    prompt,
    description,
    ...extra,
  })) satisfies CharacterCatalogOption[];
}

export const CUSTOM_GENERATION_OPTION_ID = "custom-text";
export const CUSTOM_SCENE_TEMPLATE_ID = "custom-text";

function withCustomTextOption(optionsList: CharacterCatalogOption[]) {
  return [
    ...optionsList,
    {
      id: CUSTOM_GENERATION_OPTION_ID,
      label: "Custom Text",
      prompt: "",
      description: "Write your own instruction.",
      badge: "Custom",
    },
  ] satisfies CharacterCatalogOption[];
}

export function isCustomSceneTemplateId(value?: string) {
  return value === CUSTOM_SCENE_TEMPLATE_ID;
}

export const catalog = {
  outfitSelectionModes: options([
    ["preset", "Complete Coordinated Outfit Preset", "complete coordinated outfit preset", "Complete coordinated outfit preset.", { badge: "Preset" }],
    ["separate", "Custom Outfit Assembled From Separate Clothing Items", "custom outfit assembled from separate clothing items", "Custom outfit assembled from separate clothing items.", { badge: "Custom" }],
  ]),
  sexes: options([
    ["female", "Female Character", "female character", "Female character.", { badge: "Female" }],
    ["male", "Male Character", "male character", "Male character.", { badge: "Male" }],
  ]),
  ageGroups: options([
    ["12", "Appears Around 12 Years Old", "appears around 12 years old", "Appears around 12 years old.", { badge: "12" }],
    ["15", "Appears Around 15 Years Old", "appears around 15 years old", "Appears around 15 years old.", { badge: "15" }],
    ["18", "Appears Around 18 Years Old", "appears around 18 years old", "Appears around 18 years old.", { badge: "18" }],
    ["21", "Appears Around 21 Years Old", "appears around 21 years old", "Appears around 21 years old.", { badge: "21" }],
    ["24", "Appears Around 24 Years Old", "appears around 24 years old", "Appears around 24 years old.", { badge: "24" }],
    ["27", "Appears Around 27 Years Old", "appears around 27 years old", "Appears around 27 years old.", { badge: "27" }],
    ["30", "Appears Around 30 Years Old", "appears around 30 years old", "Appears around 30 years old.", { badge: "30" }],
    ["35", "Appears Around 35 Years Old", "appears around 35 years old", "Appears around 35 years old.", { badge: "35" }],
    ["40", "Appears Around 40 Years Old", "appears around 40 years old", "Appears around 40 years old.", { badge: "40" }],
    ["50", "Appears Around 50 Years Old", "appears around 50 years old", "Appears around 50 years old.", { badge: "50" }],
    ["60", "Appears Around 60 Years Old", "appears around 60 years old", "Appears around 60 years old.", { badge: "60" }],
    ["70", "Appears Around 70 Years Old", "appears around 70 years old", "Appears around 70 years old.", { badge: "70" }],
    ["80", "Appears Around 80 Years Old", "appears around 80 years old", "Appears around 80 years old.", { badge: "80" }],
  ]),
  genderPresentations: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["soft", "Soft Gentle Personality", "soft gentle personality", undefined, { badge: "Soft" }],
    ["kind", "Kind Warm Personality", "kind warm personality", undefined, { badge: "Kind" }],
    ["cute", "Cute Cheerful Personality", "cute cheerful personality", undefined, { badge: "Cute" }],
    ["elegant", "Elegant Refined Personality", "elegant refined personality", undefined, { badge: "Elegant" }],
    ["natural", "Natural Relaxed Personality", "natural relaxed personality", undefined, { badge: "Natural" }],
    ["nature-loving", "Nature Loving Wholesome Personality", "nature-loving wholesome personality", undefined, { badge: "Nature" }],
    ["calm", "Calm Composed Personality", "calm composed personality", undefined, { badge: "Calm" }],
    ["bright", "Bright Upbeat Personality", "bright upbeat personality", undefined, { badge: "Bright" }],
    ["cool", "Cool Reserved Personality", "cool reserved personality", undefined, { badge: "Cool" }],
  ]),
  facePresets: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["idol-sweet", "Idol Like Sweet Face", "idol-like sweet face", "Idol-like sweet face.", { badge: "Sweet" }],
    ["cool-beauty", "Cool Beauty Facial Impression", "cool beauty facial impression", "Cool beauty facial impression.", { badge: "Cool" }],
    ["innocent-baby", "Innocent Baby Face Impression", "innocent baby-face impression", "Innocent baby-face impression.", { badge: "Cute" }],
    ["princess-elegant", "Elegant Princess Like Face", "elegant princess-like face", "Elegant princess-like face.", { badge: "Elegant" }],
    ["sporty-bright", "Bright Sporty Face", "bright sporty face", "Bright sporty face.", { badge: "Active" }],
    ["mystic-doll", "Mysterious Doll Like Face", "mysterious doll-like face", "Mysterious doll-like face.", { badge: "Doll" }],
    ["model-mature", "Mature Model Like Face", "mature model-like face", "Mature model-like face.", { badge: "Mature" }],
    ["intellectual", "Intellectual Refined Face", "intellectual refined face", "Intellectual refined face.", { badge: "Smart" }],
    ["sleepy-soft", "Soft Sleepy Looking Face", "soft sleepy-looking face", "Soft sleepy-looking face.", { badge: "Soft" }],
    ["fox-mischief", "Mischievous Fox Like Face", "mischievous fox-like face", "Mischievous fox-like face.", { badge: "Fox" }],
    ["prince-clean", "Clean Princely Face", "clean princely face", "Clean princely face.", { badge: "Prince" }],
    ["classic-japanese", "Classic Japanese Refined Face", "classic Japanese refined face", "Classic Japanese refined face.", { badge: "Wa" }],
    ["healer-gentle", "Gentle Healer Like Face", "gentle healer-like face", "Gentle healer-like face.", { badge: "Gentle" }],
    ["gal-glam", "Glam Gal Inspired Face", "glam gal-inspired face", "Glam gal-inspired face.", { badge: "Glam" }],
    ["retro-film", "Retro Cinema Face", "retro cinema face", "Retro cinema face.", { badge: "Retro" }],
    ["cyber-digital", "Cyber Styled Face", "cyber-styled face", "Cyber-styled face.", { badge: "Cyber" }],
    ["gothic-rose", "Gothic Rose Face", "gothic rose face", "Gothic rose face.", { badge: "Gothic" }],
    ["fairy-airy", "Airy Fairy Like Face", "airy fairy-like face", "Airy fairy-like face.", { badge: "Airy" }],
    ["heroic-smile", "Heroic Friendly Face", "heroic friendly face", "Heroic friendly face.", { badge: "Hero" }],
    ["shy-soft", "Shy Soft Face", "shy soft face", "Shy soft face.", { badge: "Shy" }],
  ]),
  bodyPresets: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["petite-light", "Petite Light Body Proportions", "petite light body proportions", "Petite light body proportions.", { badge: "Petite" }],
    ["petite-soft", "Petite Soft Body Proportions", "petite soft body proportions", "Petite soft body proportions.", { badge: "Petite" }],
    ["balanced-natural", "Balanced Natural Body Proportions", "balanced natural body proportions", "Balanced natural body proportions.", { badge: "Basic" }],
    ["balanced-slim", "Balanced Slim Body Proportions", "balanced slim body proportions", "Balanced slim body proportions.", { badge: "Slim" }],
    ["tall-elegant", "Tall Elegant Body Proportions", "tall elegant body proportions", "Tall elegant body proportions.", { badge: "Tall" }],
    ["tall-athletic", "Tall Athletic Body Proportions", "tall athletic body proportions", "Tall athletic body proportions.", { badge: "Athletic" }],
    ["compact-athletic", "Compact Athletic Body Proportions", "compact athletic body proportions", "Compact athletic body proportions.", { badge: "Active" }],
    ["curvy-soft", "Soft Curvy Body Proportions", "soft curvy body proportions", "Soft curvy body proportions.", { badge: "Curvy" }],
    ["willowy", "Willowy Elongated Body Proportions", "willowy elongated body proportions", "Willowy elongated body proportions.", { badge: "Long" }],
    ["dancer-fit", "Toned Dancer Like Body Proportions", "toned dancer-like body proportions", "Toned dancer-like body proportions.", { badge: "Dance" }],
    ["runner-fit", "Runner Like Lean Body Proportions", "runner-like lean body proportions", "Runner-like lean body proportions.", { badge: "Run" }],
    ["swimmer-fit", "Swimmer Like Balanced Body Proportions", "swimmer-like balanced body proportions", "Swimmer-like balanced body proportions.", { badge: "Sport" }],
    ["idol-stage", "Idol Like Camera Friendly Body Proportions", "idol-like camera-friendly body proportions", "Idol-like camera-friendly body proportions.", { badge: "Stage" }],
    ["prince-line", "Princely Straight Body Proportions", "princely straight body proportions", "Princely straight body proportions.", { badge: "Prince" }],
    ["mature-glam", "Mature Glamorous Body Proportions", "mature glamorous body proportions", "Mature glamorous body proportions.", { badge: "Glam" }],
    ["cute-round", "Cute Rounded Body Proportions", "cute rounded body proportions", "Cute rounded body proportions.", { badge: "Cute" }],
    ["oversized-comfy", "Oversized Comfy Body Silhouette", "oversized comfy body silhouette", "Oversized comfy body silhouette.", { badge: "Loose" }],
    ["power-strong", "Strong Powerful Body Proportions", "strong powerful body proportions", "Strong powerful body proportions.", { badge: "Strong" }],
    ["androgynous-linear", "Linear Androgynous Body Proportions", "linear androgynous body proportions", "Linear androgynous body proportions.", { badge: "Neutral" }],
    ["relaxed-natural", "Relaxed Natural Body Proportions", "relaxed natural body proportions", "Relaxed natural body proportions.", { badge: "Natural" }],
  ]),
  hairStyles: options([
    ["unspecified", "Unspecified", ""],
    ["long-wave", "Long Wavy Hair", "long wavy hair"],
    ["short-bob", "Short Bob Haircut", "short bob haircut"],
    ["twin-tail", "Twin Tail Hairstyle", "twin-tail hairstyle"],
    ["side-pony", "Side Ponytail", "side ponytail"],
    ["hime-cut", "Hime Cut Hairstyle", "hime cut hairstyle"],
    ["wolf-layer", "Layered Wolf Cut", "layered wolf cut"],
    ["mini-short", "Very Short Cropped Hair", "very short cropped hair"],
    ["long-straight", "Long Straight Hair", "long straight hair"],
    ["curly-medium", "Medium Curly Hair", "medium curly hair"],
    ["half-up", "Half Up Hairstyle", "half-up hairstyle"],
    ["braid-long", "Long Braided Hair", "long braided hair"],
    ["ponytail-high", "High Ponytail", "high ponytail"],
  ]),
  hairColors: options([
    ["unspecified", "Unspecified", ""],
    ["jet-black", "Jet Black Hair Color", "jet black hair color"],
    ["natural-black", "Natural Black Hair Color", "natural black hair color"],
    ["dark-brown", "Dark Brown Hair Color", "dark brown hair color"],
    ["chocolate-brown", "Chocolate Brown Hair Color", "chocolate brown hair color"],
    ["ash-brown", "Ash Brown Hair Color", "ash brown hair color"],
    ["milk-tea", "Milky Tea Beige Hair Color", "milky tea beige hair color"],
    ["honey-blonde", "Honey Blonde Hair Color", "honey blonde hair color"],
    ["silver", "Silver Hair Color", "silver hair color"],
    ["lavender", "Lavender Hair Color", "lavender hair color"],
    ["pink", "Pink Hair Color", "pink hair color"],
    ["wine-red", "Wine Red Hair Color", "wine red hair color"],
    ["blue-black", "Blue Black Hair Color", "blue black hair color"],
    ["navy", "Navy Hair Color", "navy hair color"],
    ["emerald", "Emerald Green Hair Color", "emerald green hair color"],
    ["two-tone", "Two Tone Hair Color", "two-tone hair color"],
    ["gradient", "Gradient Hair Color", "gradient hair color"],
  ]),
  bangs: options([
    ["unspecified", "Unspecified", ""],
    ["see-through", "See Through Bangs", "see-through bangs"],
    ["blunt", "Blunt Bangs", "blunt bangs"],
    ["side-swept", "Side Swept Bangs", "side-swept bangs"],
    ["curtain", "Curtain Bangs", "curtain bangs"],
    ["short-baby", "Short Baby Bangs", "short baby bangs"],
    ["heavy-full", "Heavy Full Bangs", "heavy full bangs"],
    ["wispy", "Wispy Separated Bangs", "wispy separated bangs"],
    ["none-open", "None", "open forehead without bangs"],
    ["asymmetry", "Asymmetrical Bangs", "asymmetrical bangs"],
    ["split-thin", "Thin Center Parted Fringe", "thin center-parted fringe"],
  ]),
  eyes: options([
    ["unspecified", "Unspecified", ""],
    ["almond", "Almond Shaped Eyes", "almond-shaped eyes"],
    ["round", "Round Expressive Eyes", "round expressive eyes"],
    ["sharp", "Sharp Narrow Eyes", "sharp narrow eyes"],
    ["droopy", "Soft Droopy Eyes", "soft droopy eyes"],
    ["sparkle", "Sparkling Glossy Eyes", "sparkling glossy eyes"],
    ["cat", "Cat Like Eyes", "cat-like eyes"],
    ["fox", "Fox Like Upturned Eyes", "fox-like upturned eyes"],
    ["sleepy", "Sleepy Half Lidded Eyes", "sleepy half-lidded eyes"],
    ["hero", "Straight Heroic Eyes", "straight heroic eyes"],
    ["princess", "Elegant Princess Like Eyes", "elegant princess-like eyes"],
    ["monolid-soft", "Soft Subtle Double Eyelids", "soft subtle double eyelids"],
    ["gem", "Jewel Like Irises", "jewel-like irises"],
  ]),
  eyebrows: options([
    ["unspecified", "Unspecified", ""],
    ["soft-arch", "Soft Arched Eyebrows", "soft arched eyebrows"],
    ["straight", "Straight Eyebrows", "straight eyebrows"],
    ["slim", "Slim Eyebrows", "slim eyebrows"],
    ["bold", "Defined Eyebrows", "defined eyebrows"],
    ["angled", "Angled Eyebrows", "angled eyebrows"],
    ["gentle", "Gentle Soft Eyebrows", "gentle soft eyebrows"],
    ["prince", "Clean Princely Eyebrows", "clean princely eyebrows"],
    ["hero", "Heroic Strong Eyebrows", "heroic strong eyebrows"],
  ]),
  mouth: options([
    ["unspecified", "Unspecified", ""],
    ["smile", "Gentle Smiling Lips", "gentle smiling lips"],
    ["cat", "Cat Like Mouth Shape", "cat-like mouth shape"],
    ["soft", "Soft Natural Lips", "soft natural lips"],
    ["cool", "Calm Composed Lips", "calm composed lips"],
    ["open-cheer", "Bright Slightly Open Smiling Mouth", "bright slightly open smiling mouth"],
    ["princess", "Refined Elegant Lips", "refined elegant lips"],
    ["shy", "Shy Reserved Lips", "shy reserved lips"],
    ["pout", "Slight Pout Lips", "slight pout lips"],
  ]),
  faceShapes: options([
    ["unspecified", "Unspecified", ""],
    ["oval", "Oval Face Shape", "oval face shape"],
    ["heart", "Heart Shaped Face", "heart-shaped face"],
    ["round", "Round Face Shape", "round face shape"],
    ["slim", "Slim Defined Jawline", "slim defined jawline"],
    ["diamond", "Diamond Shaped Face", "diamond-shaped face"],
    ["long", "Long Face Shape", "long face shape"],
    ["soft-square", "Soft Square Face Shape", "soft square face shape"],
    ["delicate-v", "Delicate V Line Face Shape", "delicate V-line face shape"],
  ]),
  skinTones: options([
    ["unspecified", "Unspecified", ""],
    ["porcelain", "Porcelain Skin Tone", "porcelain skin tone"],
    ["peach", "Soft Peach Skin Tone", "soft peach skin tone"],
    ["neutral", "Neutral Skin Tone", "neutral skin tone"],
    ["sunny", "Healthy Sun Kissed Skin Tone", "healthy sun-kissed skin tone"],
    ["ivory", "Ivory Skin Tone", "ivory skin tone"],
    ["olive", "Olive Skin Tone", "olive skin tone"],
    ["beige", "Warm Beige Skin Tone", "warm beige skin tone"],
    ["deep", "Deep Rich Skin Tone", "deep rich skin tone"],
  ]),
  heightProfiles: options([
    ["unspecified", "Unspecified", ""],
    ["petite", "Petite Height Impression", "petite height impression"],
    ["short-mid", "Slightly Short Height Impression", "slightly short height impression"],
    ["balanced", "Balanced Height Impression", "balanced height impression"],
    ["mid-tall", "Slightly Tall Height Impression", "slightly tall height impression"],
    ["tall", "Tall Elegant Height Impression", "tall elegant height impression"],
    ["very-tall", "Very Tall Fashion Forward Height Impression", "very tall fashion-forward height impression"],
  ]),
  bodyTypes: options([
    ["unspecified", "Unspecified", ""],
    ["slender", "Slender Silhouette", "slender silhouette"],
    ["athletic", "Light Athletic Silhouette", "light athletic silhouette"],
    ["soft", "Soft Silhouette", "soft silhouette"],
    ["defined", "Defined Toned Silhouette", "defined toned silhouette"],
    ["curvy", "Curvy Silhouette", "curvy silhouette"],
    ["straight", "Straight Clean Silhouette", "straight clean silhouette"],
    ["compact", "Compact Body Silhouette", "compact body silhouette"],
    ["long-limbed", "Long Limbed Silhouette", "long-limbed silhouette"],
    ["strong", "Strong Stable Silhouette", "strong stable silhouette"],
    ["airy", "Airy Lightweight Silhouette", "airy lightweight silhouette"],
  ]),
  outfits: withCustomTextOption(options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["custom-coord", "Custom Coordinated Outfit Assembled From Separate Clothing Items", "custom coordinated outfit assembled from separate clothing items", "Custom coordinated outfit assembled from separate clothing items.", { badge: "Custom" }],
    ["travel-coat", "Stylish Travel Coat Outfit", "stylish travel coat outfit", "Stylish travel coat outfit.", { badge: "Outer" }],
    ["cafe-knit", "Casual Knit Outfit", "casual knit outfit", "Casual knit outfit.", { badge: "Daily" }],
    ["school-modern", "Modern School Inspired Outfit", "modern school-inspired outfit", "Modern school-inspired outfit.", { badge: "School" }],
    ["sailor-classic", "Classic Sailor Uniform Outfit", "classic sailor uniform outfit", "Classic sailor uniform outfit.", { badge: "School" }],
    ["hoodie-street", "Oversized Street Hoodie Outfit", "oversized street hoodie outfit", "Oversized street hoodie outfit.", { badge: "Street" }],
    ["techwear", "Urban Techwear Outfit", "urban techwear outfit", "Urban techwear outfit.", { badge: "Street" }],
    ["denim-layered", "Layered Denim Casual Outfit", "layered denim casual outfit", "Layered denim casual outfit.", { badge: "Daily" }],
    ["outing-spring", "Spring Outing Casual Outfit", "spring outing casual outfit", "Spring outing casual outfit.", { badge: "Daily" }],
    ["outing-summer", "Summer Outing Casual Outfit", "summer outing casual outfit", "Summer outing casual outfit.", { badge: "Daily" }],
    ["outing-autumn", "Autumn Outing Casual Outfit", "autumn outing casual outfit", "Autumn outing casual outfit.", { badge: "Daily" }],
    ["outing-winter", "Winter Outing Casual Outfit", "winter outing casual outfit", "Winter outing casual outfit.", { badge: "Daily" }],
    ["room-jersey", "Relaxed Tracksuit Outfit", "relaxed tracksuit outfit", "Relaxed tracksuit outfit.", { badge: "Room" }],
    ["soft-pajama", "Soft Pajama Set Outfit", "soft pajama set outfit", "Soft pajama set outfit.", { badge: "Room" }],
    ["kigurumi-fluffy", "Fluffy Animal Kigurumi Outfit", "fluffy animal kigurumi outfit", "Fluffy animal kigurumi outfit.", { badge: "Room" }],
    ["kigurumi-loose", "Loose Oversized Kigurumi Outfit", "loose oversized kigurumi outfit", "Loose oversized kigurumi outfit.", { badge: "Room" }],
    ["idol-stage", "Sparkling Idol Stage Costume", "sparkling idol stage costume", "Sparkling idol stage costume.", { badge: "Stage" }],
    ["dance-performance", "Energetic Dance Performance Outfit", "energetic dance performance outfit", "Energetic dance performance outfit.", { badge: "Stage" }],
    ["bunny-girl", "Bunny Girl Costume", "bunny girl costume", "Bunny girl costume.", { badge: "Stage" }],
    ["showa-idol", "Showa Idol Inspired Stage Outfit", "Showa idol-inspired stage outfit", "Showa idol-inspired stage outfit.", { badge: "Stage" }],
    ["gothic-lolita", "Gothic Lolita Dress Outfit", "gothic lolita dress outfit", "Gothic lolita dress outfit.", { badge: "Dress" }],
    ["sweet-lolita", "Sweet Lolita Dress Outfit", "sweet lolita dress outfit", "Sweet lolita dress outfit.", { badge: "Dress" }],
    ["maid-classic", "Classic Maid Outfit", "classic maid outfit", "Classic maid outfit.", { badge: "Dress" }],
    ["maid-frill", "Frilly Maid Dress Outfit", "frilly maid dress outfit", "Frilly maid dress outfit.", { badge: "Dress" }],
    ["punk-rock", "Punk Rock Outfit", "punk rock outfit", "Punk rock outfit.", { badge: "Rock" }],
    ["biker-leather", "Biker Leather Outfit", "biker leather outfit", "Biker leather outfit.", { badge: "Outer" }],
    ["preppy-tennis", "Preppy Tennis Inspired Outfit", "preppy tennis-inspired outfit", "Preppy tennis-inspired outfit.", { badge: "Sport" }],
    ["jersey-sport", "Sport Jersey Outfit", "sport jersey outfit", "Sport jersey outfit.", { badge: "Sport" }],
    ["office-smart", "Smart Office Outfit", "smart office outfit", "Smart office outfit.", { badge: "Work" }],
    ["lab-coat", "Lab Coat Outfit", "lab coat outfit", "Lab coat outfit.", { badge: "Work" }],
    ["nurse-soft", "Soft Nurse Inspired Outfit", "soft nurse-inspired outfit", "Soft nurse-inspired outfit.", { badge: "Work" }],
    ["cafe-apron", "Cafe Apron Outfit", "cafe apron outfit", "Cafe apron outfit.", { badge: "Work" }],
    ["heisei-early-pop", "Early Heisei Pop Casual Outfit", "early Heisei pop casual outfit", "Early Heisei pop casual outfit.", { badge: "Retro" }],
    ["showa-50s-retro", "Late 1970s To Early 1980s Japanese Retro Outfit", "late 1970s to early 1980s Japanese retro outfit", "Late 1970s to early 1980s Japanese retro outfit.", { badge: "Retro" }],
    ["sixties-mod", "1960s Mod Fashion Outfit", "1960s mod fashion outfit", "1960s mod fashion outfit.", { badge: "Retro" }],
    ["retro-marine", "Retro Marine Inspired Outfit", "retro marine-inspired outfit", "Retro marine-inspired outfit.", { badge: "Retro" }],
    ["taisho-retro", "Taisho Retro Western Outfit", "Taisho retro western outfit", "Taisho retro western outfit.", { badge: "Retro" }],
    ["kimono-modern", "Modern Kimono Outfit", "modern kimono outfit", "Modern kimono outfit.", { badge: "Wa" }],
    ["classic-kimono", "Traditional Formal Kimono Outfit", "traditional formal kimono outfit", "Traditional formal kimono outfit.", { badge: "Wa" }],
    ["furisode-formal", "Formal Furisode Outfit", "formal furisode outfit", "Formal furisode outfit.", { badge: "Wa" }],
    ["hakama-taisho", "Taisho Era Hakama Outfit", "Taisho era hakama outfit", "Taisho era hakama outfit.", { badge: "Wa" }],
    ["haori-modern", "Modern Kimono With Haori Outfit", "modern kimono with haori outfit", "Modern kimono with haori outfit.", { badge: "Wa" }],
    ["wa-lolita", "Japanese Wa Lolita Outfit", "Japanese wa-lolita outfit", "Japanese wa-lolita outfit.", { badge: "Wa" }],
    ["yukata-summer", "Summer Yukata Outfit", "summer yukata outfit", "Summer yukata outfit.", { badge: "Wa" }],
    ["shrine-maiden", "Shrine Maiden Outfit", "shrine maiden outfit", "Shrine maiden outfit.", { badge: "Wa" }],
    ["fantasy-robe", "Fantasy Robe Outfit", "fantasy robe outfit", "Fantasy robe outfit.", { badge: "Fantasy" }],
    ["witch-dress", "Witch Inspired Dress Outfit", "witch-inspired dress outfit", "Witch-inspired dress outfit.", { badge: "Fantasy" }],
    ["magical-girl", "Magical Girl Costume", "magical girl costume", "Magical girl costume.", { badge: "Fantasy" }],
    ["princess-fantasy", "Fantasy Princess Costume", "fantasy princess costume", "Fantasy princess costume.", { badge: "Fantasy" }],
    ["vampire-noble", "Vampire Noble Costume", "vampire noble costume", "Vampire noble costume.", { badge: "Fantasy" }],
    ["steampunk-costume", "Steampunk Costume", "steampunk costume", "Steampunk costume.", { badge: "Fantasy" }],
    ["china-dress", "China Dress Costume", "china dress costume", "China dress costume.", { badge: "Dress" }],
    ["ninja-costume", "Ninja Costume", "ninja costume", "Ninja costume.", { badge: "Action" }],
    ["police-costume", "Police Inspired Costume", "police-inspired costume", "Police-inspired costume.", { badge: "Work" }],
    ["cyber-android", "Cyber Android Costume", "cyber android costume", "Cyber android costume.", { badge: "Cyber" }],
    ["military-jacket", "Military Jacket Outfit", "military jacket outfit", "Military jacket outfit.", { badge: "Outer" }],
    ["knit-onepiece", "Knit One Piece Outfit", "knit one-piece outfit", "Knit one-piece outfit.", { badge: "Dress" }],
  ])),
  outfitMaterials: options([
    ["unspecified", "Unspecified", ""],
    ["cotton", "Cotton Fabric Texture", "cotton fabric texture"],
    ["linen", "Linen Fabric Texture", "linen fabric texture"],
    ["silk", "Silk Fabric Texture", "silk fabric texture"],
    ["satin", "Satin Fabric Texture", "satin fabric texture"],
    ["wool", "Wool Fabric Texture", "wool fabric texture"],
    ["knit", "Chunky Knit Fabric Texture", "chunky knit fabric texture"],
    ["leather", "Leather Fabric Texture", "leather fabric texture"],
    ["denim", "Denim Fabric Texture", "denim fabric texture"],
    ["jersey", "Sport Jersey Fabric Texture", "sport jersey fabric texture"],
    ["lace", "Lace Fabric Detail", "lace fabric detail"],
    ["sheer", "Sheer Translucent Fabric Detail", "sheer translucent fabric detail"],
    ["velvet", "Velvet Fabric Texture", "velvet fabric texture"],
  ]),
  outfitPatterns: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["solid-clean", "Clean Solid Color Clothing", "clean solid-color clothing", "Clean solid-color clothing.", { badge: "Plain" }],
    ["pinstripe", "Pinstripe Clothing Pattern", "pinstripe clothing pattern", "Pinstripe clothing pattern.", { badge: "Line" }],
    ["wide-stripe", "Wide Stripe Clothing Pattern", "wide stripe clothing pattern", "Wide stripe clothing pattern.", { badge: "Line" }],
    ["micro-check", "Micro Check Clothing Pattern", "micro-check clothing pattern", "Micro-check clothing pattern.", { badge: "Check" }],
    ["tartan", "Tartan Plaid Clothing Pattern", "tartan plaid clothing pattern", "Tartan plaid clothing pattern.", { badge: "Check" }],
    ["houndstooth", "Houndstooth Pattern", "houndstooth pattern", "Houndstooth pattern.", { badge: "Check" }],
    ["dot", "Polka Dot Clothing Pattern", "polka dot clothing pattern", "Polka dot clothing pattern.", { badge: "Dot" }],
    ["mini-flower", "Small Floral Clothing Pattern", "small floral clothing pattern", "Small floral clothing pattern.", { badge: "Floral" }],
    ["large-flower", "Large Floral Clothing Pattern", "large floral clothing pattern", "Large floral clothing pattern.", { badge: "Floral" }],
    ["paisley", "Paisley Clothing Pattern", "paisley clothing pattern", "Paisley clothing pattern.", { badge: "Boho" }],
    ["camouflage", "Camouflage Pattern", "camouflage pattern", "Camouflage pattern.", { badge: "Military" }],
    ["galaxy", "Galaxy Inspired Pattern", "galaxy-inspired pattern", "Galaxy-inspired pattern.", { badge: "Fantasy" }],
    ["constellation", "Constellation Pattern", "constellation pattern", "Constellation pattern.", { badge: "Fantasy" }],
    ["heart", "Heart Motif Clothing Pattern", "heart motif clothing pattern", "Heart motif clothing pattern.", { badge: "Cute" }],
    ["star", "Star Motif Clothing Pattern", "star motif clothing pattern", "Star motif clothing pattern.", { badge: "Pop" }],
    ["ribbon", "Ribbon Motif Clothing Pattern", "ribbon motif clothing pattern", "Ribbon motif clothing pattern.", { badge: "Cute" }],
    ["mesh-panel", "Mesh Panel Clothing Detail", "mesh panel clothing detail", "Mesh panel clothing detail.", { badge: "Sport" }],
    ["color-block", "Color Blocked Clothing Design", "color-blocked clothing design", "Color-blocked clothing design.", { badge: "Block" }],
    ["gradient", "Gradient Dyed Clothing Design", "gradient-dyed clothing design", "Gradient-dyed clothing design.", { badge: "Grad" }],
    ["logo-repeat", "Repeating Logo Inspired Pattern", "repeating logo-inspired pattern", "Repeating logo-inspired pattern.", { badge: "Logo" }],
  ]),
  colorways: options([
    ["unspecified", "Unspecified", "", undefined, { swatches: [] }],
    ["coral-sage", "Coral And Sage Palette", "coral and sage palette", undefined, { swatches: ["#ef7f69", "#7aa088", "#fff2e8"] }],
    ["navy-cream", "Navy And Cream Palette", "navy and cream palette", undefined, { swatches: ["#24385a", "#f6efe2", "#a3b2cc"] }],
    ["rose-charcoal", "Rose And Charcoal Palette", "rose and charcoal palette", undefined, { swatches: ["#d16b8f", "#343238", "#f4dde4"] }],
    ["amber-ivory", "Amber And Ivory Palette", "amber and ivory palette", undefined, { swatches: ["#d79a3a", "#f7f0df", "#6c5230"] }],
    ["mint-silver", "Mint And Silver Palette", "mint and silver palette", undefined, { swatches: ["#89d8c0", "#d7dde3", "#4d6a67"] }],
    ["black-red", "Black And Crimson Palette", "black and crimson palette", undefined, { swatches: ["#1f1a1d", "#c93f49", "#f2e8eb"] }],
    ["lavender-gray", "Lavender And Gray Palette", "lavender and gray palette", undefined, { swatches: ["#b59be8", "#70727e", "#f1eff7"] }],
    ["sky-white", "Sky Blue And White Palette", "sky blue and white palette", undefined, { swatches: ["#6aa7e8", "#ffffff", "#d8e7fb"] }],
    ["emerald-gold", "Emerald And Gold Palette", "emerald and gold palette", undefined, { swatches: ["#157d67", "#dfb347", "#eff8f4"] }],
    ["wine-black", "Wine Red And Black Palette", "wine red and black palette", undefined, { swatches: ["#7f2237", "#121215", "#e4c2cb"] }],
    ["peach-cream", "Peach And Cream Palette", "peach and cream palette", undefined, { swatches: ["#f1b394", "#fff2e0", "#b46b52"] }],
    ["teal-navy", "Teal And Deep Navy Palette", "teal and deep navy palette", undefined, { swatches: ["#1b8d90", "#23324d", "#d9f1ee"] }],
    ["plum-rose", "Plum And Rose Palette", "plum and rose palette", undefined, { swatches: ["#713c68", "#cb718e", "#f5e5ed"] }],
    ["brown-camel", "Brown And Camel Palette", "brown and camel palette", undefined, { swatches: ["#634631", "#c99b5f", "#f1e2cc"] }],
    ["olive-khaki", "Olive And Khaki Palette", "olive and khaki palette", undefined, { swatches: ["#667646", "#b0a27b", "#ede8d8"] }],
    ["sakura-gray", "Sakura Pink And Cool Gray Palette", "sakura pink and cool gray palette", undefined, { swatches: ["#eb9ab1", "#9aa1ae", "#f8edf1"] }],
    ["ice-blue", "Icy Blue Monochrome Palette", "icy blue monochrome palette", undefined, { swatches: ["#85b9ef", "#d6e8fa", "#5d7896"] }],
    ["mono-white", "Black White Monochrome Palette", "black white monochrome palette", undefined, { swatches: ["#19191d", "#ffffff", "#8c8fa0"] }],
    ["sunset-orange", "Sunset Orange Palette", "sunset orange palette", undefined, { swatches: ["#f48443", "#7a2c2d", "#ffd8b0"] }],
    ["forest-moss", "Forest Green Palette", "forest green palette", undefined, { swatches: ["#355a43", "#7f9c5f", "#edf3e8"] }],
    ["aqua-lemon", "Aqua And Lemon Palette", "aqua and lemon palette", undefined, { swatches: ["#43c9c7", "#f1da52", "#fff8d9"] }],
    ["violet-neon", "Violet Neon Palette", "violet neon palette", undefined, { swatches: ["#8458ff", "#ff4fb3", "#221a3b"] }],
    ["smoke-blue", "Smoky Blue Palette", "smoky blue palette", undefined, { swatches: ["#62738f", "#bcc7d5", "#eff4f9"] }],
    ["milk-tea", "Milky Tea Palette", "milky tea palette", undefined, { swatches: ["#b88f6f", "#f5e5d4", "#735946"] }],
  ]),
  outerwears: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["none-outer", "None", "", "None.", { badge: "None" }],
    ["tailored-jacket", "Tailored Jacket Outerwear", "tailored jacket outerwear", "Tailored jacket outerwear.", { badge: "Jacket" }],
    ["long-coat", "Long Coat Outerwear", "long coat outerwear", "Long coat outerwear.", { badge: "Coat" }],
    ["short-blouson", "Short Blouson Outerwear", "short blouson outerwear", "Short blouson outerwear.", { badge: "Casual" }],
    ["cardigan-soft", "Soft Cardigan Outerwear", "soft cardigan outerwear", "Soft cardigan outerwear.", { badge: "Knit" }],
    ["denim-jacket", "Denim Jacket Outerwear", "denim jacket outerwear", "Denim jacket outerwear.", { badge: "Denim" }],
    ["leather-jacket", "Leather Jacket Outerwear", "leather jacket outerwear", "Leather jacket outerwear.", { badge: "Leather" }],
    ["hooded-parka", "Hooded Parka Outerwear", "hooded parka outerwear", "Hooded parka outerwear.", { badge: "Street" }],
    ["military-coat", "Military Coat Outerwear", "military coat outerwear", "Military coat outerwear.", { badge: "Military" }],
    ["cape-short", "Short Cape Outerwear", "short cape outerwear", "Short cape outerwear.", { badge: "Cape" }],
    ["track-jacket", "Track Jacket Outerwear", "track jacket outerwear", "Track jacket outerwear.", { badge: "Sport" }],
    ["bolero", "Bolero Outerwear", "bolero outerwear", "Bolero outerwear.", { badge: "Dress" }],
  ]),
  innerwears: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["crew-tee", "Crew Neck T Shirt Top", "crew neck t-shirt top", "Crew neck t-shirt top.", { badge: "Basic" }],
    ["oversize-tee", "Oversized T Shirt Top", "oversized t-shirt top", "Oversized t-shirt top.", { badge: "Loose" }],
    ["dress-shirt", "Clean Dress Shirt Top", "clean dress shirt top", "Clean dress shirt top.", { badge: "Shirt" }],
    ["frill-blouse", "Frilled Blouse Top", "frilled blouse top", "Frilled blouse top.", { badge: "Sweet" }],
    ["turtleneck", "Turtleneck Top", "turtleneck top", "Turtleneck top.", { badge: "Knit" }],
    ["cable-knit", "Cable Knit Top", "cable knit top", "Cable knit top.", { badge: "Knit" }],
    ["hoodie-inner", "Hoodie Top", "hoodie top", "Hoodie top.", { badge: "Street" }],
    ["camisole", "Camisole Top", "camisole top", "Camisole top.", { badge: "Light" }],
    ["sailor-top", "Sailor Collar Top", "sailor collar top", "Sailor collar top.", { badge: "School" }],
    ["jersey-top", "Sport Jersey Top", "sport jersey top", "Sport jersey top.", { badge: "Sport" }],
    ["vest-layer", "Layered Vest Top", "layered vest top", "Layered vest top.", { badge: "Layer" }],
    ["offshoulder-top", "Off Shoulder Top", "off-shoulder top", "Off-shoulder top.", { badge: "Glam" }],
  ]),
  bottoms: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["pleated-skirt", "Pleated Skirt Bottom", "pleated skirt bottom", "Pleated skirt bottom.", { badge: "Skirt" }],
    ["mini-skirt", "Mini Skirt Bottom", "mini skirt bottom", "Mini skirt bottom.", { badge: "Skirt" }],
    ["long-skirt", "Long Flowing Skirt Bottom", "long flowing skirt bottom", "Long flowing skirt bottom.", { badge: "Skirt" }],
    ["tiered-skirt", "Tiered Skirt Bottom", "tiered skirt bottom", "Tiered skirt bottom.", { badge: "Skirt" }],
    ["pencil-skirt", "Pencil Skirt Bottom", "pencil skirt bottom", "Pencil skirt bottom.", { badge: "Skirt" }],
    ["slim-pants", "Slim Pants Bottom", "slim pants bottom", "Slim pants bottom.", { badge: "Pants" }],
    ["wide-pants", "Wide Pants Bottom", "wide pants bottom", "Wide pants bottom.", { badge: "Pants" }],
    ["cargo-pants", "Cargo Pants Bottom", "cargo pants bottom", "Cargo pants bottom.", { badge: "Pants" }],
    ["short-pants", "Short Pants Bottom", "short pants bottom", "Short pants bottom.", { badge: "Pants" }],
    ["flared-pants", "Flared Pants Bottom", "flared pants bottom", "Flared pants bottom.", { badge: "Pants" }],
    ["track-pants", "Track Pants Bottom", "track pants bottom", "Track pants bottom.", { badge: "Sport" }],
    ["onepiece-skirt", "One Piece Dress Silhouette", "one-piece dress silhouette", "One-piece dress silhouette.", { badge: "Dress" }],
  ]),
  shoes: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["sneakers", "Casual Sneakers", "casual sneakers", "Casual sneakers.", { badge: "Daily" }],
    ["platform-sneakers", "Platform Sneakers", "platform sneakers", "Platform sneakers.", { badge: "Street" }],
    ["loafers", "Classic Loafers", "classic loafers", "Classic loafers.", { badge: "School" }],
    ["ankle-boots", "Ankle Boots", "ankle boots", "Ankle boots.", { badge: "Boots" }],
    ["long-boots", "Long Boots", "long boots", "Long boots.", { badge: "Boots" }],
    ["pumps", "Classic Pumps", "classic pumps", "Classic pumps.", { badge: "Dress" }],
    ["mary-jane", "Mary Jane Shoes", "mary jane shoes", "Mary jane shoes.", { badge: "Sweet" }],
    ["heels-sharp", "Sharp High Heels", "sharp high heels", "Sharp high heels.", { badge: "Glam" }],
    ["sport-shoes", "Sport Training Shoes", "sport training shoes", "Sport training shoes.", { badge: "Sport" }],
    ["sandals", "Light Sandals", "light sandals", "Light sandals.", { badge: "Light" }],
    ["combat-boots", "Combat Boots", "combat boots", "Combat boots.", { badge: "Rock" }],
    ["geta", "Japanese Geta Sandals", "Japanese geta sandals", "Japanese geta sandals.", { badge: "Wa" }],
  ]),
  socks: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["none-socks", "None", "", "None.", { badge: "None" }],
    ["ankle-socks", "Ankle Socks", "ankle socks", "Ankle socks.", { badge: "Short" }],
    ["crew-socks", "Crew Socks", "crew socks", "Crew socks.", { badge: "Basic" }],
    ["high-socks", "High Socks", "high socks", "High socks.", { badge: "High" }],
    ["thigh-high", "Thigh High Socks", "thigh-high socks", "Thigh-high socks.", { badge: "High" }],
    ["lace-socks", "Lace Socks", "lace socks", "Lace socks.", { badge: "Sweet" }],
    ["sport-socks", "Sport Socks", "sport socks", "Sport socks.", { badge: "Sport" }],
    ["tights", "Plain Tights", "plain tights", "Plain tights.", { badge: "Tights" }],
    ["pattern-tights", "Patterned Tights", "patterned tights", "Patterned tights.", { badge: "Tights" }],
    ["leg-warmers", "Leg Warmers", "leg warmers", "Leg warmers.", { badge: "Loose" }],
  ]),
  gloves: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["none-gloves", "None", "", "None.", { badge: "None" }],
    ["knit-gloves", "Knit Gloves", "knit gloves", "Knit gloves.", { badge: "Winter" }],
    ["lace-gloves", "Lace Gloves", "lace gloves", "Lace gloves.", { badge: "Dress" }],
    ["leather-gloves", "Leather Gloves", "leather gloves", "Leather gloves.", { badge: "Leather" }],
    ["fingerless-gloves", "Fingerless Gloves", "fingerless gloves", "Fingerless gloves.", { badge: "Street" }],
    ["long-gloves", "Long Elegant Gloves", "long elegant gloves", "Long elegant gloves.", { badge: "Glam" }],
    ["sport-gloves", "Sport Gloves", "sport gloves", "Sport gloves.", { badge: "Sport" }],
    ["frill-cuffs", "Frilled Cuff Hand Accessory", "frilled cuff hand accessory", "Frilled cuff hand accessory.", { badge: "Sweet" }],
  ]),
  hats: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["none-hat", "None", "", "None.", { badge: "None" }],
    ["beret", "Beret Hat", "beret hat", "Beret hat.", { badge: "Classic" }],
    ["baseball-cap", "Baseball Cap", "baseball cap", "Baseball cap.", { badge: "Street" }],
    ["beanie", "Beanie Hat", "beanie hat", "Beanie hat.", { badge: "Casual" }],
    ["bucket-hat", "Bucket Hat", "bucket hat", "Bucket hat.", { badge: "Street" }],
    ["wide-brim-hat", "Wide Brim Hat", "wide-brim hat", "Wide-brim hat.", { badge: "Elegant" }],
    ["witch-hat", "Witch Hat", "witch hat", "Witch hat.", { badge: "Fantasy" }],
    ["headband", "Headband Accessory", "headband accessory", "Headband accessory.", { badge: "Cute" }],
    ["newsboy-cap", "Newsboy Cap", "newsboy cap", "Newsboy cap.", { badge: "Retro" }],
    ["hood-up", "Hood Worn Over The Head", "hood worn over the head", "Hood worn over the head.", { badge: "Hood" }],
  ]),
  onePoints: options([
    ["unspecified", "Unspecified", "", undefined, { badge: "Free" }],
    ["none", "None", "", "None.", { badge: "None" }],
    ["mini-logo", "Small Logo Accent On Clothing", "small logo accent on clothing", "Small logo accent on clothing.", { badge: "Logo" }],
    ["single-letter", "Single Letter Typographic Accent", "single-letter typographic accent", "Single-letter typographic accent.", { badge: "Text" }],
    ["wordmark", "Short Wordmark Printed On Clothing", "short wordmark printed on clothing", "Short wordmark printed on clothing.", { badge: "Text" }],
    ["numbering", "Athletic Numbering Detail On Clothing", "athletic numbering detail on clothing", "Athletic numbering detail on clothing.", { badge: "Text" }],
    ["heart-badge", "Small Heart Badge Accent", "small heart badge accent", "Small heart badge accent.", { badge: "Badge" }],
    ["star-badge", "Small Star Badge Accent", "small star badge accent", "Small star badge accent.", { badge: "Badge" }],
    ["moon-badge", "Crescent Moon Accent", "crescent moon accent", "Crescent moon accent.", { badge: "Badge" }],
    ["crown", "Small Crown Emblem Accent", "small crown emblem accent", "Small crown emblem accent.", { badge: "Emblem" }],
    ["cat-face", "Tiny Cat Face Accent", "tiny cat face accent", "Tiny cat face accent.", { badge: "Mascot" }],
    ["bear-face", "Tiny Bear Face Accent", "tiny bear face accent", "Tiny bear face accent.", { badge: "Mascot" }],
    ["wing-mark", "Small Wing Emblem Accent", "small wing emblem accent", "Small wing emblem accent.", { badge: "Emblem" }],
    ["lightning", "Lightning Symbol Accent", "lightning symbol accent", "Lightning symbol accent.", { badge: "Icon" }],
    ["flower-pin", "Small Flower Emblem Accent", "small flower emblem accent", "Small flower emblem accent.", { badge: "Icon" }],
    ["ribbon-mark", "Small Ribbon Accent", "small ribbon accent", "Small ribbon accent.", { badge: "Icon" }],
    ["shield-emblem", "Small Shield Emblem Accent", "small shield emblem accent", "Small shield emblem accent.", { badge: "Emblem" }],
    ["planet-mark", "Small Planet Symbol Accent", "small planet symbol accent", "Small planet symbol accent.", { badge: "Icon" }],
    ["pixel-icon", "Pixel Art Style Accent", "pixel-art style accent", "Pixel-art style accent.", { badge: "Pixel" }],
    ["speech-bubble", "Tiny Speech Bubble Accent", "tiny speech bubble accent", "Tiny speech bubble accent.", { badge: "Pop" }],
    ["barcode", "Small Barcode Graphic Accent", "small barcode graphic accent", "Small barcode graphic accent.", { badge: "Code" }],
  ]),
  accessories: options([
    ["hairpin-star", "Star Hairpin Accessory", "star hairpin accessory"],
    ["camera", "Mini Camera Charm", "mini camera charm"],
    ["scarf", "Light Scarf Accessory", "light scarf accessory"],
    ["earcuff", "Ear Cuff Accessory", "ear cuff accessory"],
    ["choker", "Choker Accessory", "choker accessory"],
    ["glasses-round", "Round Glasses Accessory", "round glasses accessory"],
    ["glasses-square", "Square Glasses Accessory", "square glasses accessory"],
    ["beret", "Beret Accessory", "beret accessory"],
    ["ribbon", "Ribbon Accessory", "ribbon accessory"],
    ["cap", "Casual Cap Accessory", "casual cap accessory"],
    ["necklace", "Necklace Accessory", "necklace accessory"],
    ["bracelet", "Bracelet Accessory", "bracelet accessory"],
  ]),
  poses: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["cool-pose", "Stylish Cool Pose With A Strong Readable Silhouette", "stylish cool pose with a strong readable silhouette"],
    ["cute-pose", "Cute Charming Pose With Friendly Body Language", "cute charming pose with friendly body language"],
    ["friends-photo-pose", "Natural Friendly Snapshot Pose, Suitable For Posing With Friends", "natural friendly snapshot pose, suitable for posing with friends"],
    ["playful-pose", "Playful Excited Pose With Lively Movement", "playful excited pose with lively movement"],
    ["hyper-energy-pose", "Very High Energy Celebratory Pose", "very high-energy celebratory pose"],
    ["funny-pose", "Funny Entertaining Pose With Clear Playful Intent", "funny entertaining pose with clear playful intent"],
    ["big-movement-pose", "Flashy Full Body Pose With Large Energetic Movement", "flashy full-body pose with large energetic movement"],
    ["weird-silly-pose", "Weird Silly Pose With Intentionally Odd Comedic Energy", "weird silly pose with intentionally odd comedic energy"],
    ["natural-photo-pose", "Natural Casual Photo Pose", "natural casual photo pose"],
    ["confident-pose", "Confident Expressive Pose", "confident expressive pose"],
    ["relaxed-pose", "Relaxed Comfortable Pose", "relaxed comfortable pose"],
    ["idol-pose", "Idol Like Camera Friendly Pose", "idol-like camera-friendly pose"],
    ["elegant-pose", "Elegant Refined Pose", "elegant refined pose"],
    ["active-pose", "Active Dynamic Pose", "active dynamic pose"],
  ])),
  bodyPostures: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["standing", "Standing Body Posture", "standing body posture"],
    ["jumping", "Jumping Body Posture With The Body Airborne", "jumping body posture with the body airborne"],
    ["crouching", "Crouching Body Posture", "crouching body posture"],
    ["cross-legged", "Sitting Cross Legged Posture", "sitting cross-legged posture"],
    ["seiza", "Formal Seiza Sitting Posture", "formal seiza sitting posture"],
    ["side-sitting", "Side Sitting Posture With Legs Swept To One Side", "side-sitting posture with legs swept to one side"],
    ["gym-sitting", "Sitting With Knees Hugged Close To The Body", "sitting with knees hugged close to the body"],
    ["chair-sofa-sitting", "Sitting On A Chair Or Sofa", "sitting on a chair or sofa"],
    ["lying-down", "Lying Down Or Sleeping Posture", "lying down or sleeping posture"],
  ])),
  expressions: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["smile", "Natural Smiling Expression", "natural smiling expression"],
    ["happy", "Happy Cheerful Expression", "happy cheerful expression"],
    ["cute-expression", "Cute Charming Expression", "cute charming expression"],
    ["cool-expression", "Cool Confident Expression", "cool confident expression"],
    ["playful-expression", "Playful Excited Expression", "playful excited expression"],
    ["hyper-expression", "Very High Energy Excited Expression", "very high-energy excited expression"],
    ["shy", "Shy Bashful Expression", "shy bashful expression"],
    ["affectionate", "Affectionate Loving Expression", "affectionate loving expression"],
    ["surprised", "Surprised Expression", "surprised expression"],
    ["calm", "Calm Composed Expression", "calm composed expression"],
    ["serious", "Serious Focused Expression", "serious focused expression"],
    ["troubled-expression", "Troubled Uncertain Expression", "troubled uncertain expression"],
    ["sad", "Sad Expression", "sad expression"],
    ["angry", "Angry Expression", "angry expression"],
  ])),
  cameraDistances: options([
    ["unspecified", "Unspecified", ""],
    ["auto-photo", "Photo Aware Automatic Character Framing With A Larger Readable Face By Default", "photo-aware automatic character framing with a larger readable face by default"],
    ["full", "Full Body Framing With The Entire Character Visible", "full body framing with the entire character visible"],
    ["medium", "Above Knee Medium Shot Framing", "above-knee medium shot framing"],
    ["waist-up", "Waist Up Framing", "waist-up framing"],
    ["chest-up", "Chest Up Framing", "chest-up framing"],
    ["shoulders-up", "Shoulders Up Portrait Framing", "shoulders-up portrait framing"],
    ["close", "Close Up Framing", "close-up framing"],
    ["wide-full", "Wide Full Body Framing With Breathing Room", "wide full body framing with breathing room"],
    ["portrait-close", "Portrait Close Up Framing", "portrait close-up framing"],
  ]),
  aspectRatios: options([
    ["match-input", "Match The Uploaded Image Aspect Ratio", "match the uploaded image aspect ratio"],
    ["4:5", "Vertical 4:5 Composition", "vertical 4:5 composition"],
    ["1:1", "Square Composition", "square composition"],
    ["16:9", "Wide Cinematic Composition", "wide cinematic composition"],
  ]),
  placements: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["photo-auto", "Choose The Most Natural Placement From The Photo Composition, Prioritizing Readable Face Size And Avoiding Tiny Full Body Placement", "choose the most natural placement from the photo composition, prioritizing readable face size and avoiding tiny full-body placement"],
    ["left-lower-foreground", "Place The Character In The Lower Left Foreground, Larger And Closer To The Viewer While Preserving The Background Photo", "place the character in the lower-left foreground, larger and closer to the viewer while preserving the background photo"],
    ["foreground-left", "Positioned On The Left Foreground", "positioned on the left foreground"],
    ["center", "Positioned At The Center", "positioned at the center"],
    ["window-side", "Placed Slightly To The Right With Depth", "placed slightly to the right with depth"],
    ["foreground-right", "Positioned On The Right Foreground", "positioned on the right foreground"],
    ["right-lower-foreground", "Place The Character In The Lower Right Foreground, Larger And Closer To The Viewer While Preserving The Background Photo", "place the character in the lower-right foreground, larger and closer to the viewer while preserving the background photo"],
    ["back-center", "Positioned Slightly Deeper In The Center", "positioned slightly deeper in the center"],
  ])),
  subjectAnchors: options([
    ["unspecified", "Unspecified", ""],
    ["left", "Subject Anchored To The Left Side Of The Frame", "subject anchored to the left side of the frame"],
    ["center", "Subject Anchored To The Center Of The Frame", "subject anchored to the center of the frame"],
    ["right", "Subject Anchored To The Right Side Of The Frame", "subject anchored to the right side of the frame"],
  ]),
  depthLayers: options([
    ["unspecified", "Unspecified", ""],
    ["foreground", "Subject Placed In The Foreground With Stronger Separation", "subject placed in the foreground with stronger separation"],
    ["midground", "Subject Placed In The Midground With Balanced Depth", "subject placed in the midground with balanced depth"],
    ["background", "Subject Placed Deeper In The Scene While Staying Readable", "subject placed deeper in the scene while staying readable"],
  ]),
  lightingModes: options([
    ["unspecified", "Unspecified", ""],
    ["match-background", "Match The Uploaded Background Lighting And Color Temperature", "match the uploaded background lighting and color temperature"],
    ["soft-studio", "Softly Brighten The Subject While Preserving Scene Realism", "softly brighten the subject while preserving scene realism"],
    ["golden-hour", "Warm Cinematic Light With Gentle Golden Hour Glow", "warm cinematic light with gentle golden-hour glow"],
    ["neon-dramatic", "Dramatic Contrast With Colorful Rim Lighting", "dramatic contrast with colorful rim lighting"],
  ]),
  occlusionModes: options([
    ["unspecified", "Unspecified", ""],
    ["none", "None", "no extra foreground occlusion"],
    ["soft-foreground", "Subtle Foreground Occlusion For Integration Depth", "subtle foreground occlusion for integration depth"],
    ["frame-with-props", "Use Soft Props Or Foreground Elements To Frame The Subject", "use soft props or foreground elements to frame the subject"],
  ]),
  consistencyModes: options([
    ["unspecified", "Unspecified", ""],
    ["strict", "Prioritize Face, Hair, And Signature Colors With Minimal Drift", "prioritize face, hair, and signature colors with minimal drift"],
    ["balanced", "Keep The Core Identity While Allowing Outfit And Pose Variation", "keep the core identity while allowing outfit and pose variation"],
    ["free", "Allow Wider Stylistic Interpretation While Keeping The Overall Vibe", "allow wider stylistic interpretation while keeping the overall vibe"],
  ]),
  characterRenderStyles: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["anime", "Anime Character Rendering", "anime character rendering"],
    ["photoreal", "Photoreal Live Action Character Rendering", "photoreal live-action character rendering"],
    ["cel-anime", "Cel Animation Style Character Rendering", "cel animation style character rendering"],
    ["deformed", "Deformed Chibi Style Character Rendering", "deformed chibi-style character rendering"],
    ["3d-render", "Stylized 3D Rendered Character Look", "stylized 3D rendered character look"],
    ["manga", "Manga Line Art Character Rendering", "manga line-art character rendering"],
    ["watercolor", "Watercolor Character Illustration", "watercolor character illustration"],
    ["oil-paint", "Oil Painting Style Character Rendering", "oil painting style character rendering"],
    ["pastel", "Soft Pastel Character Rendering", "soft pastel character rendering"],
    ["storybook", "Storybook Character Illustration", "storybook character illustration"],
    ["photoreal-soft", "Soft Semi Realistic Character Rendering", "soft semi-realistic character rendering"],
    ["film", "Cinematic Film Like Character Rendering", "cinematic film-like character rendering"],
    ["pixel-art", "Pixel Art Inspired Character Rendering", "pixel art inspired character rendering"],
    ["paper-cut", "Paper Cutout Style Character Rendering", "paper cutout style character rendering"],
    ["retro-game", "Retro Game Illustration Style", "retro game illustration style"],
  ])),
  backgroundRenderStyles: withCustomTextOption(options([
    ["unspecified", "Unspecified", ""],
    ["anime", "Anime Background Rendering", "anime background rendering"],
    ["cel-anime", "Cel Animation Style Background Rendering", "cel animation style background rendering"],
    ["deformed", "Deformed Playful Background Rendering", "deformed playful background rendering"],
    ["3d-render", "Stylized 3D Rendered Background", "stylized 3D rendered background"],
    ["manga", "Manga Background Rendering", "manga background rendering"],
    ["watercolor", "Watercolor Background Rendering", "watercolor background rendering"],
    ["oil-paint", "Oil Painting Style Background", "oil painting style background"],
    ["pastel", "Pastel Painted Background", "pastel painted background"],
    ["storybook", "Storybook Painted Background", "storybook painted background"],
    ["photoreal-soft", "Soft Photoreal Styled Background", "soft photoreal styled background"],
    ["film", "Cinematic Film Like Background Rendering", "cinematic film-like background rendering"],
    ["paper-cut", "Paper Cutout Style Background Rendering", "paper cutout style background rendering"],
  ])),
} satisfies Record<string, CharacterCatalogOption[]>;

const optionFieldMap = {
  outfitSelectionMode: "outfitSelectionModes",
  sex: "sexes",
  ageGroup: "ageGroups",
  genderPresentation: "genderPresentations",
  facePreset: "facePresets",
  bodyPreset: "bodyPresets",
  hairStyle: "hairStyles",
  hairColor: "hairColors",
  bangs: "bangs",
  eyes: "eyes",
  eyebrows: "eyebrows",
  mouth: "mouth",
  faceShape: "faceShapes",
  skinTone: "skinTones",
  heightProfile: "heightProfiles",
  bodyType: "bodyTypes",
  outfit: "outfits",
  outfitMaterial: "outfitMaterials",
  outfitPattern: "outfitPatterns",
  colorway: "colorways",
  outerwear: "outerwears",
  innerwear: "innerwears",
  bottoms: "bottoms",
  shoes: "shoes",
  socks: "socks",
  gloves: "gloves",
  hat: "hats",
  onePoint: "onePoints",
} as const;

type DraftOptionField = keyof typeof optionFieldMap;

const customFieldCatalogMap = {
  genderPresentation: "genderPresentations",
  facePreset: "facePresets",
  bodyPreset: "bodyPresets",
  hairStyle: "hairStyles",
  hairColor: "hairColors",
  bangs: "bangs",
  eyes: "eyes",
  eyebrows: "eyebrows",
  mouth: "mouth",
  faceShape: "faceShapes",
  skinTone: "skinTones",
  heightProfile: "heightProfiles",
  bodyType: "bodyTypes",
  outfit: "outfits",
  outfitMaterial: "outfitMaterials",
  outfitPattern: "outfitPatterns",
  outerwear: "outerwears",
  innerwear: "innerwears",
  bottoms: "bottoms",
  shoes: "shoes",
  socks: "socks",
  gloves: "gloves",
  hat: "hats",
  onePoint: "onePoints",
} as const satisfies Record<CharacterCustomField, keyof typeof catalog>;

const generationFieldCatalogMap = {
  pose: "poses",
  bodyPosture: "bodyPostures",
  expression: "expressions",
  placement: "placements",
  outfitOverride: "outfits",
  characterRenderStyle: "characterRenderStyles",
  backgroundRenderStyle: "backgroundRenderStyles",
} as const;

type GenerationCustomField = keyof typeof generationFieldCatalogMap;
type GenerationCustomInput = Pick<
  GenerationRequestInput,
  | "pose"
  | "poseCustomText"
  | "bodyPosture"
  | "bodyPostureCustomText"
  | "expression"
  | "expressionCustomText"
  | "placement"
  | "placementCustomText"
  | "outfitOverride"
  | "outfitOverrideCustomText"
  | "characterRenderStyle"
  | "characterRenderStyleCustomText"
  | "backgroundRenderStyle"
  | "backgroundRenderStyleCustomText"
>;

const defaultColorPalette = {
  primary: "#ef7f69",
  secondary: "#7aa088",
  accent: "#fff2e8",
  detail: "#2f3f54",
  highlight: "#f6d66a",
} satisfies CharacterColorPalette;

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeHexColor(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function defaultPaletteFromColorway(colorway: string): CharacterColorPalette {
  const swatches = getOption(catalog.colorways, colorway).swatches ?? [];

  return {
    primary: swatches[0] ?? defaultColorPalette.primary,
    secondary: swatches[1] ?? defaultColorPalette.secondary,
    accent: swatches[2] ?? defaultColorPalette.accent,
    detail: swatches[3] ?? swatches[2] ?? defaultColorPalette.detail,
    highlight: swatches[4] ?? swatches[1] ?? defaultColorPalette.highlight,
  };
}

function splitAccessoryNotes(value: string) {
  return value
    .split(/[\n,、]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export const sceneTemplates: SceneTemplate[] = [
  {
    id: "travel-harbor",
    category: "Travel",
    label: "Harbor Boardwalk",
    description: "A seaside boardwalk template for relaxed travel snapshots.",
    promptHint: "sunlit harbor boardwalk, relaxed travel snapshot, scenic depth",
  },
  {
    id: "room-soft",
    category: "Room",
    label: "Soft Bedroom",
    description: "A cozy room composition with natural window light.",
    promptHint: "cozy bedroom interior, morning window light, intimate domestic scene",
  },
  {
    id: "cafe-terrace",
    category: "Cafe",
    label: "Afternoon Terrace",
    description: "A cafe terrace scene with a comfortable table-side distance.",
    promptHint: "stylish cafe terrace, soft afternoon light, lifestyle shot",
  },
  {
    id: "night-city",
    category: "Night",
    label: "Neon Walk Home",
    description: "A slightly dramatic night city template with reflections and neon light.",
    promptHint: "city night street, reflective neon lights, cinematic depth",
  },
];

export const defaultDraft: CharacterDraftInput = {
  name: "Mio Template",
  tagline: "A placeholder character for your own template",
  story: "",
  negativePrompt: "extra fingers, cropped feet, broken lighting, distorted room scale",
  outfitSelectionMode: "preset",
  sex: "female",
  ageGroup: "24",
  genderPresentation: "unspecified",
  facePreset: "unspecified",
  bodyPreset: "unspecified",
  customFields: {},
  hairStyle: "unspecified",
  hairColor: "unspecified",
  bangs: "unspecified",
  eyes: "unspecified",
  eyebrows: "unspecified",
  mouth: "unspecified",
  faceShape: "unspecified",
  skinTone: "unspecified",
  heightProfile: "unspecified",
  bodyType: "unspecified",
  outfit: "unspecified",
  outfitMaterial: "unspecified",
  outfitPattern: "unspecified",
  colorway: "unspecified",
  colorMode: "preset",
  customColorPalette: defaultPaletteFromColorway("coral-sage"),
  outerwear: "unspecified",
  innerwear: "unspecified",
  bottoms: "unspecified",
  shoes: "unspecified",
  socks: "unspecified",
  gloves: "unspecified",
  hat: "unspecified",
  onePoint: "unspecified",
  customMarkText: "",
  outfitDetailNotes: "",
  accessories: [],
  customAccessoryNotes: "",
};

export function hasOption(optionsList: CharacterCatalogOption[], id: string) {
  return optionsList.some((option) => option.id === id && !option.disabled);
}

export function normalizeCharacterDraft(input: Partial<CharacterDraftInput> = {}): CharacterDraftInput {
  const merged = {
    ...defaultDraft,
    ...input,
  } satisfies CharacterDraftInput;

  const normalized = { ...merged };

  for (const [field, catalogKey] of Object.entries(optionFieldMap) as Array<[DraftOptionField, keyof typeof catalog]>) {
    normalized[field] = hasOption(catalog[catalogKey], merged[field]) ? merged[field] : defaultDraft[field];
  }

  if (normalized.outfitSelectionMode === "separate") {
    normalized.outfit = "custom-coord";
  } else if (normalized.outfit === "custom-coord") {
    normalized.outfit = defaultDraft.outfit;
  }

  normalized.name = String(merged.name ?? defaultDraft.name).trim() || defaultDraft.name;
  normalized.tagline = String(merged.tagline ?? "").trim();
  normalized.story = String(merged.story ?? defaultDraft.story).trim() || defaultDraft.story;
  normalized.negativePrompt = String(merged.negativePrompt ?? defaultDraft.negativePrompt).trim() || defaultDraft.negativePrompt;
  normalized.customFields = Object.fromEntries(
    (Object.keys(customFieldCatalogMap) as CharacterCustomField[])
      .map((field) => [field, normalizeText(input.customFields?.[field], 80)])
      .filter(([, value]) => Boolean(value)),
  );
  normalized.customMarkText = String(merged.customMarkText ?? "").trim().slice(0, 24);
  normalized.outfitDetailNotes = String(merged.outfitDetailNotes ?? "").trim().slice(0, 160);
  normalized.customAccessoryNotes = normalizeText(merged.customAccessoryNotes, 160);
  normalized.colorMode = merged.colorMode === "custom" ? "custom" : "preset";
  normalized.customColorPalette = resolveDraftColorPalette({
    colorMode: "custom",
    colorway: normalized.colorway,
    customColorPalette: merged.customColorPalette,
  });

  const accessoryIds = Array.isArray(input.accessories) ? input.accessories : defaultDraft.accessories;
  normalized.accessories = [...new Set(accessoryIds.filter((id) => hasOption(catalog.accessories, id)))].slice(0, 4);

  return normalized;
}

export function getOption(optionsList: CharacterCatalogOption[], id: string) {
  return optionsList.find((option) => option.id === id) ?? optionsList[0];
}

export function isMeaningfulOptionLabel(label: string) {
  return Boolean(label) && label !== "Unspecified" && label !== "None";
}

export function isCustomGenerationOption(id: string) {
  return id === CUSTOM_GENERATION_OPTION_ID;
}

export function normalizeGenerationCustomText(value: unknown) {
  return normalizeText(value, 120);
}

function getGenerationFieldValue(input: GenerationCustomInput, field: GenerationCustomField) {
  switch (field) {
    case "pose":
      return input.pose;
    case "bodyPosture":
      return input.bodyPosture;
    case "expression":
      return input.expression;
    case "placement":
      return input.placement;
    case "outfitOverride":
      return input.outfitOverride;
    case "characterRenderStyle":
      return input.characterRenderStyle;
    case "backgroundRenderStyle":
      return input.backgroundRenderStyle;
  }
}

function getGenerationFieldCustomText(input: GenerationCustomInput, field: GenerationCustomField) {
  switch (field) {
    case "pose":
      return normalizeGenerationCustomText(input.poseCustomText);
    case "bodyPosture":
      return normalizeGenerationCustomText(input.bodyPostureCustomText);
    case "expression":
      return normalizeGenerationCustomText(input.expressionCustomText);
    case "placement":
      return normalizeGenerationCustomText(input.placementCustomText);
    case "outfitOverride":
      return normalizeGenerationCustomText(input.outfitOverrideCustomText);
    case "characterRenderStyle":
      return normalizeGenerationCustomText(input.characterRenderStyleCustomText);
    case "backgroundRenderStyle":
      return normalizeGenerationCustomText(input.backgroundRenderStyleCustomText);
  }
}

export function resolveGenerationFieldOption(input: GenerationCustomInput, field: GenerationCustomField) {
  const value = getGenerationFieldValue(input, field);
  const customText = getGenerationFieldCustomText(input, field);

  if (isCustomGenerationOption(value) && customText) {
    return {
      id: CUSTOM_GENERATION_OPTION_ID,
      label: customText,
      prompt: customText,
    } satisfies CharacterCatalogOption;
  }

  const catalogKey = generationFieldCatalogMap[field];
  return getOption(catalog[catalogKey], value);
}

export function resolveDraftFieldOption(draft: CharacterDraftInput, field: CharacterCustomField) {
  const customValue = normalizeText(draft.customFields?.[field], 80);
  if (customValue) {
    return {
      id: `custom-${field}`,
      label: customValue,
      prompt: customValue,
    } satisfies CharacterCatalogOption;
  }

  const catalogKey = customFieldCatalogMap[field];
  return getOption(catalog[catalogKey], draft[field]);
}

export function resolveDraftColorPalette(input: Pick<CharacterDraftInput, "colorMode" | "colorway" | "customColorPalette">) {
  const fallback = defaultPaletteFromColorway(input.colorway);
  if (input.colorMode !== "custom") {
    return fallback;
  }

  return {
    primary: normalizeHexColor(input.customColorPalette?.primary, fallback.primary),
    secondary: normalizeHexColor(input.customColorPalette?.secondary, fallback.secondary),
    accent: normalizeHexColor(input.customColorPalette?.accent, fallback.accent),
    detail: normalizeHexColor(input.customColorPalette?.detail, fallback.detail),
    highlight: normalizeHexColor(input.customColorPalette?.highlight, fallback.highlight),
  } satisfies CharacterColorPalette;
}

export function resolveDraftColorSwatches(
  input: Pick<CharacterDraftInput, "colorMode" | "colorway" | "customColorPalette">,
) {
  const palette = resolveDraftColorPalette(input);
  return [palette.primary, palette.secondary, palette.accent, palette.detail, palette.highlight];
}

export function resolveDraftColorLabel(
  input: Pick<CharacterDraftInput, "colorMode" | "colorway" | "customColorPalette">,
) {
  if (input.colorMode !== "custom") {
    return getOption(catalog.colorways, input.colorway).label;
  }

  const swatches = resolveDraftColorSwatches(input);
  return `Custom palette ${swatches.join(" / ")}`;
}

export function resolveDraftColorPrompt(
  input: Pick<CharacterDraftInput, "colorMode" | "colorway" | "customColorPalette">,
) {
  if (input.colorMode !== "custom") {
    return getOption(catalog.colorways, input.colorway).prompt;
  }

  const palette = resolveDraftColorPalette(input);
  return `custom palette with primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}, detail ${palette.detail}, highlight ${palette.highlight}`;
}

export function resolveDraftAccessoryLabels(draft: CharacterDraftInput) {
  return [
    ...draft.accessories.map((id) => getOption(catalog.accessories, id).label),
    ...splitAccessoryNotes(draft.customAccessoryNotes),
  ];
}

export function resolveDraftAccessoryPrompt(draft: CharacterDraftInput) {
  return [
    ...draft.accessories.map((id) => getOption(catalog.accessories, id).prompt),
    ...splitAccessoryNotes(draft.customAccessoryNotes),
  ]
    .filter(Boolean)
    .join(", ");
}
