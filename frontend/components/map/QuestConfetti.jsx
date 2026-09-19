"use client";

import { useEffect, useRef } from "react";
import styles from "./QuestResultModal.module.css";

const COLORS = ["#f4c453", "#ee827c", "#64c5b0", "#91a4ef", "#ffdda0", "#faf3dd"];

export default function QuestConfetti() {
  const canvas = useRef(null);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion?.matches) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    let frame;
    let width;
    let height;
    let particles = [];
    let previous;
    let elapsed = 0;
    let wave = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.current.width = width * ratio;
      canvas.current.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const burst = () => {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 65; i += 1) {
          const angle = (-90 + side * (24 + Math.random() * 48)) * Math.PI / 180;
          const speed = Math.min(height, 850) * (0.85 + Math.random() * 0.55);
          particles.push({
            x: width / 2 - side * Math.min(width * 0.44, 300),
            y: height * 0.66,
            vx: Math.cos(angle) * speed * Math.min(width / 600, 1),
            vy: Math.sin(angle) * speed,
            size: 5 + Math.random() * 6,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 12,
            flutter: Math.random() * Math.PI * 2,
            color: COLORS[i % COLORS.length],
            shape: i % 9 === 0 ? "star" : i % 3 === 0 ? "ribbon" : "paper",
            age: 0,
          });
        }
      }
    };
    const draw = (now) => {
      const dt = Math.min((now - (previous ?? now)) / 1000, 0.033);
      previous = now;
      elapsed += dt;
      if (wave < 3 && elapsed >= wave * 0.3) { burst(); wave += 1; }
      context.clearRect(0, 0, width, height);
      particles = particles.filter((p) => p.y < height + 40 && p.age < 5.5);
      for (const p of particles) {
        p.age += dt;
        p.vx *= Math.exp(-1.3 * dt);
        p.vy = Math.min(p.vy + 650 * dt, 170 + p.size * 8);
        p.x += (p.vx + Math.sin(p.age * 5 + p.flutter) * 24) * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        context.save();
        context.globalAlpha = Math.min(1, (5.5 - p.age) / 0.8);
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.scale(1, Math.cos(p.age * 9 + p.flutter) * 0.8 + 0.2);
        context.fillStyle = p.color;
        if (p.shape === "star") {
          context.beginPath();
          for (let point = 0; point < 10; point += 1) {
            const angle = point * Math.PI / 5;
            const radius = p.size * (point % 2 ? 0.45 : 1);
            context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          context.closePath();
          context.fill();
        } else {
          context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.shape === "ribbon" ? 2.6 : 0.7));
        }
        context.restore();
      }
      if (elapsed < 6.2) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    motion?.addEventListener("change", stop);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      motion?.removeEventListener("change", stop);
    };
  }, []);

  return <canvas ref={canvas} className={styles.confetti} aria-hidden="true" />;
}
