import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ТОП «Драго»",
    short_name: "Драго",
    description: "Трудовой отряд подростков Москвы",
    start_url: "/cabinet",
    display: "standalone",
    background_color: "#15131a",
    theme_color: "#15131a",
    lang: "ru",
    icons: [
      { src: "/brand/drago-logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
