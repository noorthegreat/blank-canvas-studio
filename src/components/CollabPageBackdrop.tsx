import ForegroundImage from "@/assets/index-foreground.webp";
import CloudsImage from "@/assets/index-clouds.webp";

const CollabPageBackdrop = () => {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${CloudsImage})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat min-h-dvh"
        style={{ backgroundImage: `url(${ForegroundImage})`, backgroundPosition: "center 80%" }}
      />
    </>
  );
};

export default CollabPageBackdrop;
