'use client';

export default function SectionDivider() {
  return (
    <div className="pointer-events-none relative mx-auto w-full max-w-7xl px-6 md:px-12 lg:px-24">
      <div className="relative h-[48px]">
        <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#d8b07c]/45 to-transparent" />
        <div className="absolute left-1/2 top-1/2 h-[3px] w-[16%] min-w-[160px] max-w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d8b07c]/28 blur-md" />
      </div>
    </div>
  );
}
