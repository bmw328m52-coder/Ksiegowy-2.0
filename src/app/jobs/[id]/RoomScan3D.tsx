"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ScanData } from "@/lib/dao/room_scans.types";
import { openingSpans, planModel, wallAxis, wallPieces } from "@/lib/scan2d";
import { wallLetter } from "./RoomScanPlan";

const WALL = 0xf2f1ee;
const EDGE = 0x8a8580;
const FLOOR = 0xdcd2c3;
const GLASS = 0x74a6f2;
const DOOR = 0xa06f3f;

function objectColor(category: string): number {
  if (["refrigerator", "stove", "oven", "dishwasher", "washerDryer"].includes(category)) return 0x6b6b70;
  if (category === "sink") return 0xc7ccd1;
  if (category === "storage") return 0xcca880;
  return 0xe6dccc;
}

function label(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#282624";
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 64px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 68);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(0.28, 0.28, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Widok 3D skanu (mysz/palec: obrót, kółko/szczypanie: zoom, prawy przycisk: przesuw). */
export default function RoomScan3D({ data }: { data: ScanData }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf8f3);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ab98, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-3, 8, 5);
    scene.add(sun);

    const edgeMat = new THREE.LineBasicMaterial({ color: EDGE });
    const box = (w: number, h: number, d: number, mat: THREE.Material, edges = true) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      scene.add(mesh);
      return mesh;
    };

    const wallMat = new THREE.MeshStandardMaterial({ color: WALL, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: GLASS, transparent: true, opacity: 0.35 });
    const doorMat = new THREE.MeshStandardMaterial({ color: DOOR, transparent: true, opacity: 0.25 });

    data.walls.forEach((wall, i) => {
      const { len, ux, uy } = wallAxis(wall);
      if (len <= 1) return;
      const angle = -Math.atan2(uy, ux);
      const spans = openingSpans(wall, data.openings);
      const place = (t0: number, t1: number, z0: number, z1: number, depth: number, mat: THREE.Material, edges = true) => {
        if (t1 - t0 <= 1 || z1 - z0 <= 1) return;
        const m = box((t1 - t0) / 1000, (z1 - z0) / 1000, depth, mat, edges);
        const tm = (t0 + t1) / 2;
        m.position.set((wall.x1 + ux * tm) / 1000, (z0 + z1) / 2000, (wall.y1 + uy * tm) / 1000);
        m.rotation.y = angle;
      };
      for (const p of wallPieces(len, wall.height_mm, spans)) place(p.t0, p.t1, p.z0, p.z1, 0.08, wallMat);
      for (const s of spans) {
        if (s.kind === "window") place(s.t0, s.t1, s.bottom, s.top, 0.02, glassMat, false);
        if (s.kind === "door") place(s.t0, s.t1, s.bottom, s.top, 0.01, doorMat, false);
      }
      const tag = label(wallLetter(i));
      tag.position.set((wall.x1 + wall.x2) / 2000, wall.height_mm / 1000 + 0.2, (wall.y1 + wall.y2) / 2000);
      scene.add(tag);
    });

    const corners = data.walls.flatMap((w): [number, number][] => [
      [w.x1, w.y1],
      [w.x2, w.y2],
    ]);
    const hull = planModel(data).floor;
    if (hull.length >= 3) {
      const shape = new THREE.Shape(hull.map(([x, y]) => new THREE.Vector2(x / 1000, -y / 1000)));
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
    }

    for (const o of data.objects) {
      const m = box(
        o.width_mm / 1000,
        o.height_mm / 1000,
        o.depth_mm / 1000,
        new THREE.MeshStandardMaterial({ color: objectColor(o.category), roughness: 0.7 })
      );
      m.position.set(o.cx / 1000, ((o.elevation_mm ?? 0) + o.height_mm / 2) / 1000, o.cy / 1000);
      m.rotation.y = (-o.rotation_deg * Math.PI) / 180;
    }

    // Kamera z narożnika, nad pomieszczeniem.
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2000 : 0;
    const cz = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2000 : 0;
    const span = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 2000) / 1000 : 4;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    camera.position.set(cx - span * 0.75, span * 1.1, cz + span * 1.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 0.6, cz);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();

    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    return () => {
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        const o = obj as THREE.Mesh;
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          (m as THREE.SpriteMaterial).map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [data]);

  return <div ref={host} className="h-[420px] w-full overflow-hidden rounded-lg border border-[#ededea]" />;
}
