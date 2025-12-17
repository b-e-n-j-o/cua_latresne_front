import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

// Configuration des couleurs (reprises de l'ancienne animation)
const COLORS = {
  background: '#FFFDEF',
  lines: '#1A2B42',
  mouseLines: '#FF8476',
} as const;

const TopographicAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mouseRef = useRef<Point>({ x: -1000, y: -1000 });
  const targetMouseRef = useRef<Point>({ x: -1000, y: -1000 });

  // Implémentation simple de bruit de Perlin 2D
  const createNoiseGenerator = () => {
    const permutation = new Array(256);
    for (let i = 0; i < 256; i++) {
      permutation[i] = i;
    }
    
    // Mélanger avec un seed fixe pour avoir le même terrain
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    
    const p = [...permutation, ...permutation];

    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    
    const grad = (hash: number, x: number, y: number) => {
      const h = hash & 3;
      const u = h < 2 ? x : y;
      const v = h < 2 ? y : x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    return (x: number, y: number): number => {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      
      x -= Math.floor(x);
      y -= Math.floor(y);
      
      const u = fade(x);
      const v = fade(y);
      
      const a = p[X] + Y;
      const aa = p[a];
      const ab = p[a + 1];
      const b = p[X + 1] + Y;
      const ba = p[b];
      const bb = p[b + 1];
      
      return lerp(v,
        lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
        lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1))
      );
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let displayWidth = 0;
    let displayHeight = 0;

    // Set canvas size avec high DPI pour un rendu net
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      displayWidth = rect.width;
      displayHeight = rect.height;
      
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      ctx.scale(dpr, dpr);
      
      // Anti-aliasing pour des lignes plus lisses
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const noise = createNoiseGenerator();

    // Smooth mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = {
        x: e.clientX,
        y: e.clientY
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Fonction pour obtenir l'élévation avec plusieurs octaves de bruit
    const getElevation = (x: number, y: number, time: number, mouseX: number, mouseY: number): number => {
      let elevation = 0;
      let amplitude = 1;
      let frequency = 1;
      const octaves = 4;
      
      for (let i = 0; i < octaves; i++) {
        const sampleX = x * frequency * 0.0008;
        const sampleY = y * frequency * 0.0008;
        elevation += noise(sampleX, sampleY) * amplitude;
        
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      // Animation très légère
      const autoAnimation = Math.sin(time * 0.3 + x * 0.001) * 3 + Math.cos(time * 0.2 + y * 0.001) * 3;
      
      // Influence de la souris
      const dx = mouseX - x;
      const dy = mouseY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 300;
      
      let mouseInfluence = 0;
      if (distance < maxDistance) {
        const influence = 1 - distance / maxDistance;
        // Courbe gaussienne pour une déformation naturelle
        mouseInfluence = Math.pow(influence, 2) * 80;
      }
      
      return (elevation + 1) * 100 + autoAnimation + mouseInfluence;
    };

    // Fonction pour lisser un chemin avec des courbes de Bézier
    const smoothPath = (points: Point[]): void => {
      if (points.length < 2) return;
      
      ctx.moveTo(points[0].x, points[0].y);
      
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
        return;
      }
      
      // Utiliser des courbes quadratiques pour lisser
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        
        if (i === 0) {
          // Premier segment
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.lineTo(midX, midY);
        } else if (i === points.length - 2) {
          // Dernier segment
          ctx.quadraticCurveTo(current.x, current.y, next.x, next.y);
        } else {
          // Segments du milieu
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
      }
    };

    let time = 0;

    const drawTopography = () => {
      time += 0.01;
      
      // Smooth mouse interpolation
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.1;
      
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      
      // Clear canvas
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      // Paramètres des lignes de contour
      const minElevation = 0;
      const maxElevation = 200;
      const contourInterval = 20;
      const gridSize = 5;

      // Créer une grille d'élévation
      const cols = Math.ceil(displayWidth / gridSize) + 1;
      const rows = Math.ceil(displayHeight / gridSize) + 1;
      
      const elevationGrid: number[][] = [];
      for (let row = 0; row < rows; row++) {
        elevationGrid[row] = [];
        for (let col = 0; col < cols; col++) {
          const x = col * gridSize;
          const y = row * gridSize;
          elevationGrid[row][col] = getElevation(x, y, time, mouseX, mouseY);
        }
      }

      // Dessiner chaque ligne de contour
      for (let elevation = minElevation; elevation <= maxElevation; elevation += contourInterval) {
        // Stocker tous les points par ligne de contour pour former des chemins continus
        const contourPoints: Point[] = [];

        // Parcourir toutes les cellules de la grille
        for (let row = 0; row < rows - 1; row++) {
          for (let col = 0; col < cols - 1; col++) {
            const x = col * gridSize;
            const y = row * gridSize;

            // Les 4 coins de la cellule
            const e00 = elevationGrid[row][col];
            const e10 = elevationGrid[row][col + 1];
            const e01 = elevationGrid[row + 1][col];
            const e11 = elevationGrid[row + 1][col + 1];

            // Déterminer le cas marching squares
            let caseValue = 0;
            if (e00 >= elevation) caseValue |= 1;
            if (e10 >= elevation) caseValue |= 2;
            if (e11 >= elevation) caseValue |= 4;
            if (e01 >= elevation) caseValue |= 8;

            // Fonction d'interpolation linéaire
            const interpolate = (v1: number, v2: number, p1: Point, p2: Point): Point => {
              if (Math.abs(v1 - v2) < 0.001) return p1;
              const t = (elevation - v1) / (v2 - v1);
              return {
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y)
              };
            };

            // Points des bords de la cellule
            const topLeft = { x, y };
            const topRight = { x: x + gridSize, y };
            const bottomRight = { x: x + gridSize, y: y + gridSize };
            const bottomLeft = { x, y: y + gridSize };

            // Points d'intersection possibles
            const top = interpolate(e00, e10, topLeft, topRight);
            const right = interpolate(e10, e11, topRight, bottomRight);
            const bottom = interpolate(e01, e11, bottomLeft, bottomRight);
            const left = interpolate(e00, e01, topLeft, bottomLeft);

            // Ajouter les points selon le cas
            switch (caseValue) {
              case 1: case 14:
                contourPoints.push(left, top);
                break;
              case 2: case 13:
                contourPoints.push(top, right);
                break;
              case 3: case 12:
                contourPoints.push(left, right);
                break;
              case 4: case 11:
                contourPoints.push(right, bottom);
                break;
              case 5:
                contourPoints.push(left, top);
                contourPoints.push(right, bottom);
                break;
              case 6: case 9:
                contourPoints.push(top, bottom);
                break;
              case 7: case 8:
                contourPoints.push(left, bottom);
                break;
              case 10:
                contourPoints.push(top, right);
                contourPoints.push(left, bottom);
                break;
            }
          }
        }

        // Dessiner les contours avec des courbes lisses
        if (contourPoints.length > 0) {
          // Calculer la proximité moyenne de ce contour à la souris
          let avgDistanceToMouse = 0;
          contourPoints.forEach(point => {
            const dx = mouseX - point.x;
            const dy = mouseY - point.y;
            avgDistanceToMouse += Math.sqrt(dx * dx + dy * dy);
          });
          avgDistanceToMouse /= contourPoints.length;
          
          const mouseProximity = Math.max(0, 1 - avgDistanceToMouse / 300);
          
          // Couleur et épaisseur selon la proximité de la souris
          if (mouseProximity > 0.3) {
            // Interpoler entre la couleur normale et la couleur accent
            ctx.strokeStyle = mouseProximity > 0.6 ? COLORS.mouseLines : COLORS.lines;
            ctx.lineWidth = 1.5 + mouseProximity * 1;
            ctx.globalAlpha = 0.4 + mouseProximity * 0.6;
          } else {
            ctx.strokeStyle = COLORS.lines;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.15;
          }
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Grouper les points en chemins continus
          let currentPath: Point[] = [];
          
          for (let i = 0; i < contourPoints.length; i++) {
            const point = contourPoints[i];
            
            if (currentPath.length === 0) {
              currentPath.push(point);
            } else {
              const lastPoint = currentPath[currentPath.length - 1];
              const distance = Math.sqrt(
                Math.pow(point.x - lastPoint.x, 2) + 
                Math.pow(point.y - lastPoint.y, 2)
              );
              
              // Si le point est proche du dernier, on continue le chemin
              if (distance < gridSize * 2) {
                currentPath.push(point);
              } else {
                // Sinon on dessine le chemin actuel et on en commence un nouveau
                if (currentPath.length > 1) {
                  ctx.beginPath();
                  smoothPath(currentPath);
                  ctx.stroke();
                }
                currentPath = [point];
              }
            }
          }
          
          // Dessiner le dernier chemin
          if (currentPath.length > 1) {
            ctx.beginPath();
            smoothPath(currentPath);
            ctx.stroke();
          }
        }
      }
      
      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(drawTopography);
    };

    drawTopography();

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
      className="fixed top-0 left-0 w-full h-full"
      style={{ background: COLORS.background }}
    />
  );
};

export default TopographicAnimation;