import Image from "next/image";
import contract from "@/lib/brand/kuwi-rive.json";
import { RiveMascot } from "./rive-mascot";

export function WelcomeMascot() {
  return (
    <div className="w-full lg:py-4">
      <RiveMascot
        fallback={
          <Image
            src={contract.fallback}
            width={contract.width}
            height={contract.height}
            alt=""
            aria-hidden="true"
            className="relative h-auto w-full"
          />
        }
      />
    </div>
  );
}
