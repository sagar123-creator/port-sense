import { SlideRail } from "@/components/home/SlideRail";
import { HeroSlide } from "@/components/home/HeroSlide";
import { ProblemSlide } from "@/components/home/ProblemSlide";
import { MethodSlide } from "@/components/home/MethodSlide";
import { ProofSlide } from "@/components/home/ProofSlide";

export default function HomePage() {
  return (
    <>
      <SlideRail />
      <HeroSlide />
      <ProblemSlide />
      <MethodSlide />
      <ProofSlide />
    </>
  );
}
