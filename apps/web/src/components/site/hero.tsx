import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { DragoMark, ELEMENTS } from "./brand";
import { Container } from "./section";

export function Hero({
  title,
  subtitle,
  tagline,
  recruitmentOpen,
  isLoggedIn,
}: {
  title: string;
  subtitle: string;
  tagline: string;
  recruitmentOpen: boolean;
  isLoggedIn: boolean;
}) {
  return (
    <section aria-labelledby="hero-title" className="bg-scales relative isolate overflow-hidden bg-ink text-paper">
      {/* Свечение четырёх стихий */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-float absolute -top-32 right-[-10%] size-[34rem] rounded-full bg-fire-bright/30 blur-[110px]" />
        <div className="animate-float absolute top-1/3 -left-40 size-[26rem] rounded-full bg-water-bright/20 blur-[100px] [animation-delay:-3s]" />
        <div className="animate-float absolute -bottom-40 left-1/3 size-[24rem] rounded-full bg-earth-bright/15 blur-[100px] [animation-delay:-6s]" />
        <div className="animate-float absolute right-1/4 bottom-10 size-[18rem] rounded-full bg-air-bright/20 blur-[90px] [animation-delay:-4s]" />
      </div>

      <Container className="relative grid min-h-[calc(100svh-4rem)] items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.25fr_1fr]">
        <div className="animate-rise">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-paper/80 uppercase">
            <span className="size-2 rounded-full bg-fire-bright" aria-hidden />
            Трудовые отряды подростков Москвы · РСО
          </p>
          <h1 id="hero-title" className="text-[clamp(3rem,11vw,7.5rem)] leading-[0.92] font-bold tracking-tight uppercase">
            {title.split(" ").map((word, i) => (
              <span key={i} className={i === 0 ? "block text-paper/90" : "block bg-gradient-to-r from-fire-bright via-[#ffb347] to-fire-bright bg-clip-text text-transparent"}>
                {word}
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-paper/80 sm:text-xl">{subtitle}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/join" className={buttonClass("primary", "lg")}>
              {recruitmentOpen ? "Вступить в отряд" : "Оставить заявку"}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/about" className={buttonClass("outline-light", "lg")}>
              Узнать о Драго
            </Link>
            <Link href={isLoggedIn ? "/cabinet" : "/login"} className={buttonClass("outline-light", "lg")}>
              Личный кабинет
            </Link>
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden>
          <div className="animate-float relative aspect-square">
            <div className="absolute inset-6 rounded-full border border-white/10" />
            <div className="absolute inset-16 rounded-full border border-white/10" />
            <DragoMark className="absolute inset-20 size-auto drop-shadow-[0_0_60px_rgb(255_106_61/0.45)]" title="" />
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="max-w-3xl font-display text-sm leading-relaxed text-paper/70 sm:text-base">{tagline}</p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ELEMENTS.map((el) => (
              <li key={el.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                <span className={`mb-3 block h-1.5 w-10 rounded-full ${el.bg}`} aria-hidden />
                <span className={`block font-display text-lg font-semibold ${el.color}`}>{el.label}</span>
                <span className="text-sm text-paper/65">{el.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <a
        href="#about"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-paper/50 transition-colors hover:text-paper sm:block"
        aria-label="Прокрутить к разделу «О нас»"
      >
        <ChevronDown className="size-7 animate-bounce" />
      </a>
    </section>
  );
}
