import Image from "next/image";

interface BarberImageProps {
  image?: string | null;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Componente para mostrar la imagen de un barbero
 * Maneja tanto imágenes base64 como URLs externas
 */
export function BarberImage({
  image,
  name,
  size = 64,
  className = "",
}: BarberImageProps) {
  if (!image) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  // Si es base64, usar img normal
  if (image.startsWith("data:")) {
    return (
      <img
        src={image}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Si es URL externa, usar Next/Image
  return (
    <Image
      src={image}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
