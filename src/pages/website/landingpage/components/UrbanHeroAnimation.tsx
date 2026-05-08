import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

interface TopoLine {
  elevation: number;
  points: Point[];
  baseY: number;
  noiseOffset: number;
}

const COLORS = {
  background: '#FFFDEF',
  majorLines: '#ECE4B7',
  minorLinesStart: '#1A2B42',
  minorLinesEnd: '#D5E1E3',
  mouseLines: '#FF8476',
  mouseGlow: '#D5E1E3',
} as const;

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const OPACITIES = {
  baseLineOpacity: 0.05,
  mouseProximityBoost: 0.3,
  mouseLineOpacity: 0.4,
  mouseGlow: {
    center: 0.08,
    middle: 0.02,
    edge: 0,
  },
} as const;

const UrbanHeroAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const terrainNoise = (x: number, y: number, time: number, scale: number): number => {
      const octave1 = Math.sin(x * 0.003 * scale + time * 0.1) * Math.cos(y * 0.002 * scale) * 15;
      const octave2 = Math.sin(x * 0.007 * scale - time * 0.05) * Math.cos(y * 0.006 * scale) * 8;
      const octave3 = Math.sin(x * 0.015 * scale + time * 0.08) * 4;
      return octave1 + octave2 + octave3;
    };

    const generateTopoLines = (numLines: number): TopoLine[] => {
      const lines: TopoLine[] = [];
      const spacing = canvas.height / (numLines + 1);

      for (let i = 0; i < numLines; i++) {
        const baseY = spacing * (i + 1);
        const points: Point[] = [];
        const resolution = 80;

        for (let j = 0; j <= resolution; j++) {
          const x = (canvas.width / resolution) * j;
          points.push({ x, y: baseY });
        }

        lines.push({
          elevation: i,
          points,
          baseY,
          noiseOffset: Math.random() * 1000,
        });
      }

      return lines;
    };

    const topoLines = generateTopoLines(35);

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;

    const animate = () => {
      time += 0.003;

      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      topoLines.forEach((line, lineIndex) => {
        ctx.beginPath();

        const elevationScale = 1 + (lineIndex * 0.02);

        line.points.forEach((point, pointIndex) => {
          const terrainOffset = terrainNoise(
            point.x + line.noiseOffset,
            lineIndex * 100,
            time,
            elevationScale
          );

          const dx = mouseX - point.x;
          const dy = mouseY - line.baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 250;

          let mouseInfluence = 0;
          if (distance < maxDistance) {
            const influence = 1 - distance / maxDistance;
            const strength = Math.pow(influence, 2);
            mouseInfluence = strength * 70;
          }

          const autoDrift =
            Math.sin(time * 0.5 + line.noiseOffset * 0.1) * 96 +
            Math.cos(time * 0.3 + point.x * 0.001 + lineIndex * 0.5) * 64;

          const finalY = line.baseY + terrainOffset + autoDrift + mouseInfluence;

          if (pointIndex === 0) {
            ctx.moveTo(point.x, finalY);
          } else {
            const prevPoint = line.points[pointIndex - 1];
            const prevDx = mouseX - prevPoint.x;
            const prevDy = mouseY - line.baseY;
            const prevDistance = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

            let prevMouseInfluence = 0;
            if (prevDistance < maxDistance) {
              const prevInfluence = 1 - prevDistance / maxDistance;
              const prevStrength = Math.pow(prevInfluence, 2);
              prevMouseInfluence = prevStrength * 70;
            }

            const prevTerrainOffset = terrainNoise(
              prevPoint.x + line.noiseOffset,
              lineIndex * 100,
              time,
              elevationScale
            );
            const prevAutoDrift =
              Math.sin(time * 0.5 + line.noiseOffset * 0.1) * 96 +
              Math.cos(time * 0.3 + prevPoint.x * 0.001 + lineIndex * 0.5) * 64;
            const prevY = line.baseY + prevTerrainOffset + prevAutoDrift + prevMouseInfluence;

            const cpX = (prevPoint.x + point.x) / 2;
            const cpY = (prevY + finalY) / 2;

            ctx.quadraticCurveTo(prevPoint.x, prevY, cpX, cpY);
            if (pointIndex === line.points.length - 1) {
              ctx.lineTo(point.x, finalY);
            }
          }
        });

        const lineCenterY = line.baseY;
        const distanceToLine = Math.abs(mouseY - lineCenterY);
        const mouseProximity = Math.max(0, 1 - distanceToLine / 200);
        const opacity = OPACITIES.baseLineOpacity + mouseProximity * OPACITIES.mouseProximityBoost;

        const depthFactor = lineIndex / topoLines.length;

        if (lineIndex % 4 === 0) {
          const majorRgb = hexToRgb(COLORS.majorLines);
          ctx.strokeStyle = `rgba(${majorRgb.r}, ${majorRgb.g}, ${majorRgb.b}, ${opacity * 1.2})`;
          ctx.lineWidth = 2;
        } else {
          const startRgb = hexToRgb(COLORS.minorLinesStart);
          const endRgb = hexToRgb(COLORS.minorLinesEnd);
          const blendedColor = [
            startRgb.r + (endRgb.r - startRgb.r) * depthFactor * 0.3,
            startRgb.g + (endRgb.g - startRgb.g) * depthFactor * 0.3,
            startRgb.b + (endRgb.b - startRgb.b) * depthFactor * 0.3,
          ];
          ctx.strokeStyle = `rgba(${blendedColor[0]}, ${blendedColor[1]}, ${blendedColor[2]}, ${opacity})`;
          ctx.lineWidth = 1;
        }

        if (mouseProximity > 0.7) {
          const mouseRgb = hexToRgb(COLORS.mouseLines);
          ctx.strokeStyle = `rgba(${mouseRgb.r}, ${mouseRgb.g}, ${mouseRgb.b}, ${mouseProximity * OPACITIES.mouseLineOpacity})`;
          ctx.lineWidth = 2.5;
        }

        ctx.stroke();
      });

      const glowRgb = hexToRgb(COLORS.mouseGlow);
      const gradient = ctx.createRadialGradient(
        mouseX, mouseY, 0,
        mouseX, mouseY, 120
      );
      gradient.addColorStop(0, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${OPACITIES.mouseGlow.center})`);
      gradient.addColorStop(0.5, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${OPACITIES.mouseGlow.middle})`);
      gradient.addColorStop(1, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${OPACITIES.mouseGlow.edge})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ background: COLORS.background }}
    />
  );
};

export default UrbanHeroAnimation;
