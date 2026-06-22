import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="h-full w-full bg-[#050505] text-[#F0F0F0] font-sans flex flex-col">
      {children}
    </div>
  );
}
