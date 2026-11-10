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
    src: "https://images.pexels.com/photos/35238178/pexels-photo-35238178.jpeg?auto=compress&cs=tinysrgb&w=1800",
    alt: "Real photograph of Nairobi's skyline, with KICC and the historic clock tower",
    caption: "Nairobi, the city at the centre of our work",
    credit: "Abdullatif Bukeni / Pexels",
    creditUrl: "https://www.pexels.com/photo/nairobi-cityscape-featuring-kicc-and-clock-tower-35238178/",
    position: "center 48%",
  },
  nairobiGoldenHour: {
    src: "https://images.pexels.com/photos/26898331/pexels-photo-26898331.jpeg?auto=compress&cs=tinysrgb&w=1500",
    alt: "Aerial photograph of Nairobi's modern skyline and winding highways",
    caption: "A city that keeps moving",
    credit: "Kelvin Kibe / Pexels",
    creditUrl: "https://www.pexels.com/photo/view-of-a-city-26898331/",
    position: "center 48%",
  },
  cbdDay: {
    src: "https://images.pexels.com/photos/30908923/pexels-photo-30908923.jpeg?auto=compress&cs=tinysrgb&w=1400",
    alt: "Aerial photograph of a busy Nairobi street with vehicles, pedestrians and roadside shops",
    caption: "The movement behind the market",
    credit: "Benedict Buston / Pexels",
    creditUrl: "https://www.pexels.com/photo/busy-urban-street-in-nairobi-with-traffic-and-shops-30908923/",
    position: "center 54%",
  },
  localBusiness: {
    src: "https://images.pexels.com/photos/30908923/pexels-photo-30908923.jpeg?auto=compress&cs=tinysrgb&w=1000",
    alt: "Nairobi roadside shops and pedestrians, part of the city's everyday business life",
    caption: "The everyday businesses behind the numbers",
    credit: "Benedict Buston / Pexels",
    creditUrl: "https://www.pexels.com/photo/busy-urban-street-in-nairobi-with-traffic-and-shops-30908923/",
    position: "left center",
  },
  marketPeople: {
    src: "https://images.pexels.com/photos/33569518/pexels-photo-33569518.jpeg?auto=compress&cs=tinysrgb&w=1100",
    alt: "A real portrait of a woman working at a market in Nairobi",
    caption: "Markets are people, first",
    credit: "Charles Lichinga / Pexels",
    creditUrl: "https://www.pexels.com/photo/african-woman-working-in-nairobi-market-33569518/",
    position: "center 42%",
  },
  nationalPark: {
    src: "https://images.pexels.com/photos/29506595/pexels-photo-29506595.jpeg?auto=compress&cs=tinysrgb&w=1400",
    alt: "A giraffe photographed among the greenery of Nairobi National Park",
    caption: "A little of what makes Nairobi unique",
    credit: "Kyama Kilonzo / Pexels",
    creditUrl: "https://www.pexels.com/photo/giraffe-in-nairobi-national-park-kenya-29506595/",
    position: "center 38%",
  },
} satisfies Record<string, FintelPhoto>;
