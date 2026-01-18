import Image from "next/image";

interface Props {
  width?: number;
  height?: number;
  className?: string;
}

export default function MyServiceLogo({
  width = 200,
  height = 200,
  className = "",
}: Props) {
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width, height }}
    >
      <Image
        src="/icons/my-service-logo.png"
        alt="myservicelogo"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
