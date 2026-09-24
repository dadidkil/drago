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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
