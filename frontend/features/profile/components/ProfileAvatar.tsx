"use client";

import Image from "next/image";
import { useState } from "react";

export function ProfileAvatar({
  initials,
  photoSrc,
  photoUpdatedAt,
  size,
  className = "",
}: Readonly<{
  initials: string;
  photoSrc?: string | null;
  photoUpdatedAt?: string | null;
  size: number;
  className?: string;
}>) {
  const [failedVersion, setFailedVersion] = useState<string | null>(null);
  const photoKey = photoSrc ?? photoUpdatedAt ?? null;
  const hasPhoto = Boolean(photoKey && photoKey !== failedVersion);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0d412e] font-bold text-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {hasPhoto ? (
        <Image
          src={photoSrc ?? `/api/me/profile/photo?v=${encodeURIComponent(photoUpdatedAt!)}`}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedVersion(photoKey)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
