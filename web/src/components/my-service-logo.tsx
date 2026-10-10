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
    <img
      src="/icons/my-service-logo.png"
      alt="myservicelogo"
      className={`relative object-contain ${className}`}
      style={{ width, height }}
    />
  );
}
