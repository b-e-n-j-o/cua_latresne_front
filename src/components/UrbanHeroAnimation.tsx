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

// ==================== CONFIGURATION DES COULEURS ====================
// Toutes les couleurs de l'animation sont centralisées ici pour faciliter les modifications
const COLORS = {
  // Fond de l'animation
  background: '#FFFDEF',
  
  // Lignes topographiques majeures (tous les 4 lignes)
  majorLines: '#ECE4B7', // gris clair
  
  // Lignes topographiques mineures (début du dégradé)
  minorLinesStart: '#1A2B42', // gris foncé
  
  // Lignes topographiques mineures (fin du dégradé)
  minorLinesEnd: '#D5E1E3', // gris clair
  
  // Lignes animées par le curseur (accent tomate)
  mouseLines: '#FF8476', // tomate
  
  // Glow autour du curseur
  mouseGlow: '#D5E1E3', // tomate
} as const;

// Helper function pour convertir hex en RGB
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

// ==================== CONFIGURATION DES OPACITÉS ====================
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

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Improved noise function for terrain-like features
    const terrainNoise = (x: number, y: number, time: number, scale: number): number => {
      // Multiple octaves for more realistic terrain
      const octave1 = Math.sin(x * 0.003 * scale + time * 0.1) * Math.cos(y * 0.002 * scale) * 15;
      const octave2 = Math.sin(x * 0.007 * scale - time * 0.05) * Math.cos(y * 0.006 * scale) * 8;
      const octave3 = Math.sin(x * 0.015 * scale + time * 0.08) * 4;
      
      return octave1 + octave2 + octave3;
    };

    // Generate topographic lines with more density
    const generateTopoLines = (numLines: number): TopoLine[] => {
      const lines: TopoLine[] = [];
      const spacing = canvas.height / (numLines + 1);
      
      for (let i = 0; i < numLines; i++) {
        const baseY = spacing * (i + 1);
        const points: Point[] = [];
        const resolution = 80; // More points for smoother curves
        
        for (let j = 0; j <= resolution; j++) {
          const x = (canvas.width / resolution) * j;
          points.push({ x, y: baseY });
        }
        
        lines.push({
          elevation: i,
          points,
          baseY,
          noiseOffset: Math.random() * 1000 // Different noise space for each line
        });
      }
      
      return lines;
    };

    const topoLines = generateTopoLines(35); // More lines for topographic density

    // Smooth mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = {
        x: e.clientX,
        y: e.clientY
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    let time = 0;
    
    const animate = () => {
      time += 0.003; // Much slower for terrain feel
      
      // Smooth mouse interpolation
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08;
      
      // Clear with background color
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      // Draw topographic lines
      topoLines.forEach((line, lineIndex) => {
        ctx.beginPath();
        
        const elevationScale = 1 + (lineIndex * 0.02); // Lines get slightly more variation with elevation
        
        line.points.forEach((point, pointIndex) => {
          // Calculate base terrain using multi-octave noise
          const terrainOffset = terrainNoise(
            point.x + line.noiseOffset, 
            lineIndex * 100, 
            time, 
            elevationScale
          );
          
          // Calculate mouse influence - creates peaks and valleys
          const dx = mouseX - point.x;
          const dy = mouseY - line.baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 250;
          
          let mouseInfluence = 0;
          if (distance < maxDistance) {
            const influence = 1 - distance / maxDistance;
            // Gaussian-like curve for more natural peak/valley
            const strength = Math.pow(influence, 2);
            mouseInfluence = strength * 70; // Height of mouse-created terrain
          }
          
          // Drift automatique plus présent pour donner de l'animation continue
          const autoDrift =
            Math.sin(time * 0.5 + line.noiseOffset * 0.1) * 96 +
            Math.cos(time * 0.3 + point.x * 0.001 + lineIndex * 0.5) * 64;

          // Final y position - subtil terrain + drift + mouse peaks
          const finalY = line.baseY + terrainOffset + autoDrift + mouseInfluence;
          
          if (pointIndex === 0) {
            ctx.moveTo(point.x, finalY);
          } else {
            // Use quadratic curves for smooth topographic lines
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
        
        // Calculate opacity based on proximity to mouse
        const lineCenterY = line.baseY;
        const distanceToLine = Math.abs(mouseY - lineCenterY);
        const mouseProximity = Math.max(0, 1 - distanceToLine / 200);
        const opacity = OPACITIES.baseLineOpacity + mouseProximity * OPACITIES.mouseProximityBoost;
        
        // Color variations for depth effect
        const depthFactor = lineIndex / topoLines.length;
        
        if (lineIndex % 4 === 0) {
          // Every 4th line is brighter (major contour lines)
          const majorRgb = hexToRgb(COLORS.majorLines);
          ctx.strokeStyle = `rgba(${majorRgb.r}, ${majorRgb.g}, ${majorRgb.b}, ${opacity * 1.2})`;
          ctx.lineWidth = 2;
        } else {
          // Minor contour lines with depth gradient
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
        
        // Add accent color to lines very close to mouse
        if (mouseProximity > 0.7) {
          const mouseRgb = hexToRgb(COLORS.mouseLines);
          ctx.strokeStyle = `rgba(${mouseRgb.r}, ${mouseRgb.g}, ${mouseRgb.b}, ${mouseProximity * OPACITIES.mouseLineOpacity})`;
          ctx.lineWidth = 2.5;
        }
        
        ctx.stroke();
      });

      // Draw subtle glow around mouse
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

    // Cleanup
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