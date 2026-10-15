import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

export type PhotoGrade = "warm" | "night" | "flat";

const GRADES: Record<PhotoGrade, string> = {
  warm: "photo-grade-warm",
  night: "photo-grade-night",
  flat: "photo-grade",
};

type PhotoProps = Omit<ImageProps, "alt"> & {
  alt: string;
  grade?: PhotoGrade;
};

/** Cinematic grade for every product photograph — navy/orange, never raw stock. */
export function Photo({ alt, grade = "warm", className, ...props }: PhotoProps) {
  return (
    <Image alt={alt} className={cn("object-cover", GRADES[grade], className)} {...props} />
  );
}
