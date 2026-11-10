import type { CSSProperties } from "react";

export type FintelPhoto = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  creditUrl: string;
  position?: string;
};

type PhotoPanelProps = {
  photo: FintelPhoto;
  className?: string;
  eager?: boolean;
  overlay?: boolean;
};

export function PhotoPanel({ photo, className = "", eager = false, overlay = true }: PhotoPanelProps) {
  const style = { objectPosition: photo.position ?? "center" } as CSSProperties;
  return (
    <figure className={`fintel-photo ${className}`}>
      <img
        src={photo.src}
        alt={photo.alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        style={style}
      />
      {overlay && <div className="fintel-photo__shade" aria-hidden="true" />}
      <figcaption className="fintel-photo__caption">
        <span>{photo.caption}</span>
        <a href={photo.creditUrl} target="_blank" rel="noreferrer noopener" aria-label={`Photo credit: ${photo.credit}`}>
          Photo: {photo.credit}
        </a>
      </figcaption>
    </figure>
  );
}

export const fintelPhotos = {
  nairobiDusk: {
    src: "https://images.pexels.com/photos/29069329/pexels-photo-29069329.jpeg?auto=compress&cs=tinysrgb&w=1800",
    alt: "Nairobi's city centre at dusk, with office buildings and city lights across the skyline",
    caption: "Nairobi, after the working day",
    credit: "Ken Mwaura / Pexels",
    creditUrl: "https://www.pexels.com/photo/stunning-nairobi-skyline-at-dusk-29069329/",
    position: "center 54%",
  },
  nairobiGoldenHour: {
    src: "https://fi-hatchbox-production-uploads.s3.amazonaws.com/posts/1686177006_pexels-antony-trivet-13348192.jpg",
    alt: "Nairobi skyline in warm evening light, with the KICC tower among the city's buildings",
    caption: "A city building its next chapter",
    credit: "Antony Trivet / Pexels",
    creditUrl: "https://fi.co/insight/build-a-great-startup-in-2023-with-the-fi-kenya-startup-accelerator",
    position: "center 48%",
  },
  cbdDay: {
    src: "https://images.pexels.com/photos/37993590/pexels-photo-37993590.jpeg?auto=compress&cs=tinysrgb&w=1400",
    alt: "A daytime street scene in Nairobi with traffic and tall office buildings",
    caption: "The streets behind the economy",
    credit: "MC G'Zay / Pexels",
    creditUrl: "https://www.pexels.com/photo/busy-nairobi-street-and-architecture-scene-37993590/",
    position: "center 54%",
  },
  localBusiness: {
    src: "https://images.pexels.com/photos/28505434/pexels-photo-28505434.jpeg?auto=compress&cs=tinysrgb&w=1000",
    alt: "A busy neighbourhood shopfront in Nairobi with customers gathered outside",
    caption: "The businesses behind the numbers",
    credit: "Natalia Msungu / Pexels",
    creditUrl: "https://www.pexels.com/photo/small-shopfront-in-busy-urban-setting-28505434/",
    position: "center 52%",
  },
  marketPeople: {
    src: "https://images.pexels.com/photos/33569518/pexels-photo-33569518.jpeg?auto=compress&cs=tinysrgb&w=1000",
    alt: "A market trader at work in Nairobi",
    caption: "Markets are people, first",
    credit: "Charles Lichinga / Pexels",
    creditUrl: "https://www.pexels.com/photo/african-woman-working-in-nairobi-market-33569518/",
    position: "center 42%",
  },
  nationalPark: {
    src: "https://images.unsplash.com/photo-1635595358293-03620e36be48?auto=format&fit=crop&fm=jpg&q=80&w=1400",
    alt: "Zebras grazing in Nairobi National Park with the city skyline visible in the distance",
    caption: "A city with a remarkable natural edge",
    credit: "Unsplash contributor",
    creditUrl: "https://unsplash.com/s/photos/nairobi-national-park",
    position: "center 58%",
  },
} satisfies Record<string, FintelPhoto>;
