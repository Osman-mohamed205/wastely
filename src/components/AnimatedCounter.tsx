import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  formatFn?: (val: number) => string;
}

export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 750,
  className = '',
  formatFn,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startValueRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const targetValueRef = useRef<number>(value);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If value hasn't changed or is NaN, handle cleanly
    if (isNaN(value)) {
      setDisplayValue(0);
      return;
    }

    startValueRef.current = displayValue;
    targetValueRef.current = value;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth cubic ease-out curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + (targetValueRef.current - startValueRef.current) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValueRef.current);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = formatFn 
    ? formatFn(displayValue) 
    : displayValue.toLocaleString('en-MY', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export default AnimatedCounter;
