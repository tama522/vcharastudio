import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VcharaStudio",
    short_name: "VcharaStudio",
    description: "A web app template for character references and background compositing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe3",
    theme_color: "#d25f37",
    lang: "en",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
