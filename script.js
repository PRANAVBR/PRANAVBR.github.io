/* ============================================================
   Pranav B R — Immersive 3D Portfolio
   Light Automotive Interactive Engine
   ============================================================ */

import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────
// Performance Detection
// ──────────────────────────────────────────────────────────────
const perf = (() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  let tier = 'high';
  if (isMobile) tier = 'low';
  else if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const r = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).toLowerCase();
      if (r.includes('intel') || r.includes('mesa')) tier = 'medium';
    }
  }
  return {
    tier,
    ambientParticles: tier === 'high' ? 3000 : tier === 'medium' ? 1500 : 800,
    speedParticles: tier === 'high' ? 1200 : tier === 'medium' ? 600 : 300,
    dustParticles: tier === 'high' ? 500 : tier === 'medium' ? 250 : 120,
    geometryCount: tier === 'high' ? 12 : tier === 'medium' ? 7 : 4,
    pixelRatio: Math.min(window.devicePixelRatio, tier === 'high' ? 2 : 1.5)
  };
})();

// ──────────────────────────────────────────────────────────────
// Scene Setup
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 30);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
renderer.setPixelRatio(perf.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // Transparent — CSS provides light bg

// ──────────────────────────────────────────────────────────────
// Textures (programmatic)
// ──────────────────────────────────────────────────────────────
function createCircleTexture(size = 64, softness = 0.3) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(softness, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const particleTex = createCircleTexture(32, 0.2);
const softTex = createCircleTexture(64, 0.1);

// ──────────────────────────────────────────────────────────────
// Automotive Color Palette
// ──────────────────────────────────────────────────────────────
const colors = {
  racingRed:  new THREE.Color(0xc41e3a),
  carbon:     new THREE.Color(0x1a1a2e),
  chrome:     new THREE.Color(0x94a3b8),
  titanium:   new THREE.Color(0x64748b),
  midnight:   new THREE.Color(0x0f172a),
  steel:      new THREE.Color(0x475569),
  warmGray:   new THREE.Color(0xd4cdc4),
};

const accentColors = [
  { r: 196/255, g: 30/255, b: 58/255 },   // racing red
  { r: 26/255, g: 26/255, b: 46/255 },     // carbon
  { r: 100/255, g: 116/255, b: 139/255 },  // chrome
  { r: 71/255, g: 85/255, b: 105/255 },    // steel
  { r: 15/255, g: 23/255, b: 42/255 },     // midnight
];

// ──────────────────────────────────────────────────────────────
// Layer 1: Ambient Particles (floating motes)
// ──────────────────────────────────────────────────────────────
const ambientGeo = new THREE.BufferGeometry();
const ambientCount = perf.ambientParticles;
const ambientPos = new Float32Array(ambientCount * 3);
const ambientCol = new Float32Array(ambientCount * 3);
const ambientSizes = new Float32Array(ambientCount);

for (let i = 0; i < ambientCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 15 + Math.random() * 70;
  ambientPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
  ambientPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
  ambientPos[i*3+2] = r * Math.cos(phi);

  const c = accentColors[Math.floor(Math.random() * accentColors.length)];
  ambientCol[i*3]   = c.r;
  ambientCol[i*3+1] = c.g;
  ambientCol[i*3+2] = c.b;
  ambientSizes[i] = 0.3 + Math.random() * 0.6;
}

ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
ambientGeo.setAttribute('color', new THREE.BufferAttribute(ambientCol, 3));
ambientGeo.setAttribute('size', new THREE.BufferAttribute(ambientSizes, 1));

const ambientMat = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: particleTex },
    uTime: { value: 0 }
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vColor = color;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float shimmer = sin(uTime * 1.5 + position.x * 5.0 + position.y * 3.0) * 0.3 + 0.7;
      gl_PointSize = size * shimmer * (180.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    varying vec3 vColor;
    void main() {
      vec4 tex = texture2D(uTexture, gl_PointCoord);
      gl_FragColor = vec4(vColor, tex.a * 0.35);
    }
  `,
  transparent: true,
  vertexColors: true,
  depthWrite: false
});

const ambientParticles = new THREE.Points(ambientGeo, ambientMat);
scene.add(ambientParticles);

// ──────────────────────────────────────────────────────────────
// Layer 2: Speed Particles (rushing toward camera)
// ──────────────────────────────────────────────────────────────
const speedCount = perf.speedParticles;
const speedGeo = new THREE.BufferGeometry();
const speedPos = new Float32Array(speedCount * 3);
const speedCol = new Float32Array(speedCount * 3);
const speedVel = new Float32Array(speedCount);

for (let i = 0; i < speedCount; i++) {
  speedPos[i*3]   = (Math.random() - 0.5) * 80;
  speedPos[i*3+1] = (Math.random() - 0.5) * 50;
  speedPos[i*3+2] = Math.random() * 100 - 50;

  const t = Math.random();
  const c = t < 0.5 ? accentColors[0] : t < 0.75 ? accentColors[1] : accentColors[2];
  speedCol[i*3]   = c.r;
  speedCol[i*3+1] = c.g;
  speedCol[i*3+2] = c.b;

  speedVel[i] = 0.03 + Math.random() * 0.12;
}

speedGeo.setAttribute('position', new THREE.BufferAttribute(speedPos, 3));
speedGeo.setAttribute('color', new THREE.BufferAttribute(speedCol, 3));

const speedMat = new THREE.PointsMaterial({
  map: particleTex,
  size: 0.5,
  vertexColors: true,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  sizeAttenuation: true
});

const speedParticleSystem = new THREE.Points(speedGeo, speedMat);
scene.add(speedParticleSystem);

// ──────────────────────────────────────────────────────────────
// Layer 3: Fine Dust (close, subtle)
// ──────────────────────────────────────────────────────────────
const dustCount = perf.dustParticles;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
const dustCol = new Float32Array(dustCount * 3);

for (let i = 0; i < dustCount; i++) {
  dustPos[i*3]   = (Math.random() - 0.5) * 50;
  dustPos[i*3+1] = (Math.random() - 0.5) * 30;
  dustPos[i*3+2] = (Math.random() - 0.5) * 25;

  const g = 0.3 + Math.random() * 0.4;
  dustCol[i*3] = g; dustCol[i*3+1] = g; dustCol[i*3+2] = g;
}

dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));

const dustMat = new THREE.PointsMaterial({
  map: softTex,
  size: 0.6,
  vertexColors: true,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  sizeAttenuation: true
});

const dustSystem = new THREE.Points(dustGeo, dustMat);
scene.add(dustSystem);

// ──────────────────────────────────────────────────────────────
// Ground Grid (perspective road feel)
// ──────────────────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(200, 60, 0xc41e3a, 0xd4cdc4);
gridHelper.position.y = -18;

// Handle both array and single material (varies by Three.js version)
const gridMats = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
gridMats.forEach(m => {
  m.transparent = true;
  m.opacity = 0.06;
  m.depthWrite = false;
});
scene.add(gridHelper);

// ──────────────────────────────────────────────────────────────
// Floating Wireframe Geometries (Automotive shapes)
// ──────────────────────────────────────────────────────────────
const geoFactories = [
  () => new THREE.TorusGeometry(1, 0.3, 8, 20),           // wheel
  () => new THREE.IcosahedronGeometry(1.2, 0),             // precision
  () => new THREE.OctahedronGeometry(1, 0),                // angular
  () => new THREE.DodecahedronGeometry(0.9, 0),            // complex
  () => new THREE.TorusKnotGeometry(0.6, 0.2, 40, 8),     // engine
  () => new THREE.CylinderGeometry(0.5, 0.5, 2, 6, 1, true), // piston
  () => new THREE.TetrahedronGeometry(1, 0),               // sharp
  () => new THREE.RingGeometry(0.5, 1, 6),                 // gauge
];

const geoColorArr = [colors.racingRed, colors.carbon, colors.chrome, colors.titanium, colors.steel, colors.racingRed];
const floatingObjs = [];

for (let i = 0; i < perf.geometryCount; i++) {
  const geo = geoFactories[i % geoFactories.length]();
  const wireGeo = new THREE.WireframeGeometry(geo);
  const color = geoColorArr[i % geoColorArr.length];
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.15
  });
  const mesh = new THREE.LineSegments(wireGeo, mat);

  const spread = 28;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 8 + Math.random() * spread;
  mesh.position.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) - 2,
    r * Math.cos(phi)
  );

  floatingObjs.push({
    mesh,
    rotSpeed: { x: (Math.random()-0.5)*0.006, y: (Math.random()-0.5)*0.006, z: (Math.random()-0.5)*0.006 },
    orbitSpeed: 0.06 + Math.random() * 0.12,
    orbitRadius: 5 + Math.random() * 18,
    orbitOffset: Math.random() * Math.PI * 2,
    baseY: mesh.position.y,
    breatheSpeed: 0.3 + Math.random() * 0.4,
    breatheAmp: 0.4 + Math.random() * 0.8,
    baseOpacity: 0.15,
    color
  });

  scene.add(mesh);
}

// ──────────────────────────────────────────────────────────────
// Energy Connection Lines
// ──────────────────────────────────────────────────────────────
const connectionGeo = new THREE.BufferGeometry();
const connectionMat = new THREE.LineBasicMaterial({
  color: 0xc41e3a,
  transparent: true,
  opacity: 0.04,
  depthWrite: false
});
const connections = new THREE.LineSegments(connectionGeo, connectionMat);
scene.add(connections);

function updateConnections() {
  const maxDist = 18;
  const pts = [];
  for (let i = 0; i < floatingObjs.length; i++) {
    for (let j = i + 1; j < floatingObjs.length; j++) {
      const a = floatingObjs[i].mesh.position;
      const b = floatingObjs[j].mesh.position;
      if (a.distanceTo(b) < maxDist) {
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  connectionGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

// ──────────────────────────────────────────────────────────────
// Mouse Tracking
// ──────────────────────────────────────────────────────────────
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;

window.addEventListener('mousemove', e => {
  targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

// ──────────────────────────────────────────────────────────────
// Scroll State
// ──────────────────────────────────────────────────────────────
let scrollProgress = 0;

window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = h > 0 ? window.scrollY / h : 0;
  const bar = document.getElementById('scroll-progress');
  if (bar) bar.style.width = (scrollProgress * 100) + '%';
}, { passive: true });

// ──────────────────────────────────────────────────────────────
// Animation Loop
// ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Smooth mouse
  mouseX += (targetMouseX - mouseX) * 0.05;
  mouseY += (targetMouseY - mouseY) * 0.05;

  // Update ambient particles
  ambientMat.uniforms.uTime.value = t;
  ambientParticles.rotation.y = t * 0.01 + scrollProgress * 0.4;
  ambientParticles.rotation.x = t * 0.005;

  // Update speed particles — rush forward, wrap around
  const sPos = speedGeo.attributes.position.array;
  const speedMultiplier = 1 + scrollProgress * 4; // Faster when scrolling down
  for (let i = 0; i < speedCount; i++) {
    sPos[i*3+2] += speedVel[i] * speedMultiplier;
    if (sPos[i*3+2] > 50) {
      sPos[i*3+2] = -50;
      sPos[i*3]   = (Math.random() - 0.5) * 80;
      sPos[i*3+1] = (Math.random() - 0.5) * 50;
    }
  }
  speedGeo.attributes.position.needsUpdate = true;
  speedMat.opacity = 0.15 + scrollProgress * 0.2; // More visible when scrolling

  // Dust
  dustSystem.rotation.y = t * 0.02;
  dustSystem.rotation.x = mouseY * 0.1;

  // Grid scroll effect — moves forward as you scroll
  gridHelper.position.z = (scrollProgress * 30) % 3.33;
  gridMats.forEach(m => {
    m.opacity = 0.04 + scrollProgress * 0.04;
  });

  // Floating geometries
  floatingObjs.forEach(obj => {
    obj.mesh.rotation.x += obj.rotSpeed.x;
    obj.mesh.rotation.y += obj.rotSpeed.y;
    obj.mesh.rotation.z += obj.rotSpeed.z;

    obj.mesh.position.x = obj.orbitRadius * Math.cos(t * obj.orbitSpeed + obj.orbitOffset);
    obj.mesh.position.z = obj.orbitRadius * Math.sin(t * obj.orbitSpeed + obj.orbitOffset);
    obj.mesh.position.y = obj.baseY + Math.sin(t * obj.breatheSpeed) * obj.breatheAmp;

    // Mouse proximity — wireframe brightens
    const dx = mouseX * 12 - obj.mesh.position.x;
    const dy = mouseY * 8 - obj.mesh.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const prox = Math.max(0, 1 - dist / 12);
    obj.mesh.material.opacity = obj.baseOpacity + prox * 0.35;
  });

  // Connection lines (throttled)
  if (frameCount++ % 30 === 0) updateConnections();

  // Camera
  camera.position.x += (mouseX * 2.5 - camera.position.x) * 0.025;
  camera.position.y += (-mouseY * 1.5 + 2 - camera.position.y) * 0.025;
  camera.position.z = 30 - scrollProgress * 8;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

// ──────────────────────────────────────────────────────────────
// Resize
// ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ──────────────────────────────────────────────────────────────
// Loading Screen
// ──────────────────────────────────────────────────────────────
(() => {
  const screen = document.getElementById('loading-screen');
  const bar = document.getElementById('loader-bar');
  if (!screen) return;

  document.body.classList.add('loading');
  let progress = 0;
  const startTime = Date.now();

  const interval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress > 95) progress = 95;
    if (bar) bar.style.width = progress + '%';
  }, 200);

  window.addEventListener('load', () => {
    clearInterval(interval);
    if (bar) bar.style.width = '100%';
    const remaining = Math.max(0, 1800 - (Date.now() - startTime));

    setTimeout(() => {
      screen.classList.add('hidden');
      document.body.classList.remove('loading');

      if (typeof gsap !== 'undefined') {
        gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.8, delay: 0.2, ease: 'power3.out' });
        gsap.from('.hero-name-line', { opacity: 0, y: 60, duration: 1, stagger: 0.15, delay: 0.4, ease: 'power3.out' });
        gsap.from('.hero-title-wrapper', { opacity: 0, y: 20, duration: 0.8, delay: 0.8, ease: 'power3.out' });
        gsap.from('.hero-tagline', { opacity: 0, y: 20, duration: 0.8, delay: 1, ease: 'power3.out' });
        gsap.from('.hero-cta', { opacity: 0, y: 20, duration: 0.8, delay: 1.2, ease: 'power3.out' });
        gsap.from('.hero-scroll-indicator', { opacity: 0, duration: 1, delay: 1.8, ease: 'power2.out' });
      }

      setTimeout(() => { screen.style.display = 'none'; }, 1000);
    }, remaining);
  });
})();

// ──────────────────────────────────────────────────────────────
// Custom Cursor
// ──────────────────────────────────────────────────────────────
(() => {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring || 'ontouchstart' in window) return;

  let cx = 0, cy = 0, dx = 0, dy = 0;

  document.addEventListener('mousemove', e => { dx = e.clientX; dy = e.clientY; });

  function updateCursor() {
    cx += (dx - cx) * 0.15;
    cy += (dy - cy) * 0.15;
    dot.style.left = dx + 'px'; dot.style.top = dy + 'px';
    ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    requestAnimationFrame(updateCursor);
  }
  updateCursor();

  const hoverTargets = 'a, button, .btn, .skill-node, .project-card, .stat-card, .social-link, .cert-card, .achievement-card, input, textarea, .project-link-icon';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverTargets)) document.body.classList.add('cursor-hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverTargets)) document.body.classList.remove('cursor-hover');
  });
})();

// ──────────────────────────────────────────────────────────────
// Typed Text Animation
// ──────────────────────────────────────────────────────────────
(() => {
  const titles = ['Software Engineer', 'Data Analyst', 'Backend Developer', 'Problem Solver'];
  const el = document.getElementById('typed-text');
  if (!el) return;

  let idx = 0, charIdx = 0, deleting = false;

  function type() {
    const current = titles[idx];
    charIdx += deleting ? -1 : 1;
    el.textContent = current.substring(0, charIdx);

    let speed = deleting ? 40 : 80;
    if (!deleting && charIdx === current.length) { speed = 2500; deleting = true; }
    else if (deleting && charIdx === 0) { deleting = false; idx = (idx + 1) % titles.length; speed = 400; }

    setTimeout(type, speed);
  }
  setTimeout(type, 1500);
})();

// ──────────────────────────────────────────────────────────────
// Navbar
// ──────────────────────────────────────────────────────────────
(() => {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger-btn');
  const mobileNav = document.getElementById('mobile-nav');

  if (navbar) window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }
})();

// ──────────────────────────────────────────────────────────────
// Smooth Scroll
// ──────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const href = this.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ──────────────────────────────────────────────────────────────
// GSAP Scroll Animations (always active — both directions)
// ──────────────────────────────────────────────────────────────
(() => {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    initFallbackReveal();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Shared ScrollTrigger config
  // play       → animate in when entering viewport (scroll down)
  // reset      → reset to hidden when scrolled past top (completely off-screen)
  // play       → animate in when entering viewport from top (scroll up)
  // reset      → reset to hidden when scrolled past bottom (completely off-screen)
  const st = (trigger, extra = {}) => ({
    trigger,
    start: 'top 100%',
    end: 'bottom 0%',
    toggleActions: 'play reset play reset',
    ...extra
  });

  // Section headers
  gsap.utils.toArray('.section-header').forEach(h => {
    gsap.fromTo(h,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: st(h) }
    );
  });

  // Photo wrap
  gsap.utils.toArray('.about-photo-wrap').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, x: -40, scale: 0.95 },
      { opacity: 1, x: 0, scale: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: st(el) }
    );
  });

  // About text
  gsap.utils.toArray('.about-text p').forEach((p, i) => {
    gsap.fromTo(p,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.7, delay: i * 0.12, ease: 'power3.out', scrollTrigger: st(p) }
    );
  });

  // Stat cards
  gsap.utils.toArray('.stat-card').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 40, scale: 0.93 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: i * 0.08, ease: 'back.out(1.2)', scrollTrigger: st(c) }
    );
  });

  // Skills
  gsap.utils.toArray('.skill-category').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, delay: i * 0.08, ease: 'power3.out', scrollTrigger: st(c) }
    );
  });

  // Timeline
  gsap.utils.toArray('.timeline-item').forEach((item, i) => {
    gsap.fromTo(item,
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.8, delay: i * 0.12, ease: 'power3.out', scrollTrigger: st(item) }
    );
  });

  // Education
  gsap.utils.toArray('.edu-card').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 40, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: i * 0.15, ease: 'power3.out', scrollTrigger: st(c) }
    );
  });

  // Projects
  gsap.utils.toArray('.project-card').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 50, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: i * 0.08, ease: 'power3.out', scrollTrigger: st(c) }
    );
  });

  // Achievements
  gsap.utils.toArray('.achievement-card').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, delay: i * 0.08, ease: 'power3.out', scrollTrigger: st(c) }
    );
  });

  // Certs
  gsap.utils.toArray('.cert-card').forEach((c, i) => {
    gsap.fromTo(c,
      { opacity: 0, y: 30, scale: 0.93 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, delay: i * 0.06, ease: 'back.out(1.2)', scrollTrigger: st(c) }
    );
  });

  // Contact
  gsap.fromTo('.contact-info',
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: st('.contact-info') }
  );
  gsap.fromTo('.contact-form-wrap',
    { opacity: 0, x: 30 },
    { opacity: 1, x: 0, duration: 0.8, delay: 0.12, ease: 'power3.out', scrollTrigger: st('.contact-form-wrap') }
  );
})();

function initFallbackReveal() {
  const sels = '.section-header, .about-photo-wrap, .about-text, .stat-card, .skill-category, .timeline-item, .edu-card, .project-card, .achievement-card, .cert-card, .contact-info, .contact-form-wrap';
  const els = document.querySelectorAll(sels);
  els.forEach(el => el.classList.add('reveal'));
  // Re-trigger on both enter and exit (only when 100% off-screen) so it works scrolling up too
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
      } else {
        e.target.classList.remove('revealed');
      }
    });
  }, { threshold: 0 });
  els.forEach(el => obs.observe(el));
}


// ──────────────────────────────────────────────────────────────
// Stats Counter
// ──────────────────────────────────────────────────────────────
(() => {
  const stats = document.querySelectorAll('.stat-number');
  if (!stats.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const isDecimal = target % 1 !== 0;
      let current = 0;
      const inc = target / 60;
      const step = 2000 / 60;

      const counter = setInterval(() => {
        current += inc;
        if (current >= target) { current = target; clearInterval(counter); }
        let display = isDecimal ? current.toFixed(1) : Math.floor(current).toString();
        if (target === 4) display += '+';
        if (target === 90) display += '%';
        el.textContent = display;
      }, step);

      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  stats.forEach(s => obs.observe(s));
})();

// ──────────────────────────────────────────────────────────────
// 3D Tilt Effect
// ──────────────────────────────────────────────────────────────
(() => {
  if ('ontouchstart' in window) return;
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const rx = ((y - r.height/2) / (r.height/2)) * -6;
      const ry = ((x - r.width/2) / (r.width/2)) * 6;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => { card.style.transition = ''; }, 500);
    });
    card.addEventListener('mouseenter', () => { card.style.transition = ''; });
  });
})();

// ──────────────────────────────────────────────────────────────
// Contact Form (Web3Forms Integration)
// ──────────────────────────────────────────────────────────────
(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    if (!btn) return;

    const originalHTML = btn.innerHTML;

    // Loading state
    btn.innerHTML = '<span>Sending...</span>';
    btn.disabled = true;

    try {
      const formData = new FormData(form);
      const object = Object.fromEntries(formData);
      const json = JSON.stringify(object);

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: json
      });

      const result = await response.json();

      if (result.success) {
        // Success state
        btn.innerHTML = '<span>Message Sent! ✓</span>';
        btn.classList.add('success');
        triggerBurst();
        form.reset();

        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('success');
          btn.disabled = false;
        }, 3000);
      } else {
        // API returned an error
        btn.innerHTML = '<span>Failed to Send ✗</span>';
        btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      }
    } catch (error) {
      // Network error
      btn.innerHTML = '<span>Network Error ✗</span>';
      btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }
  });
})();

// ──────────────────────────────────────────────────────────────
// Particle Burst
// ──────────────────────────────────────────────────────────────
function triggerBurst() {
  const cv = document.getElementById('burst-canvas');
  if (!cv) return;
  cv.classList.add('active');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  const particles = [];
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;

  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: 0.01 + Math.random() * 0.02,
      size: 2 + Math.random() * 4,
      color: ['#c41e3a', '#1a1a2e', '#64748b', '#0f172a'][Math.floor(Math.random() * 4)]
    });
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= p.decay;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    if (alive) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('active'); }
  }
  draw();
}

// ──────────────────────────────────────────────────────────────
// Active Nav
// ──────────────────────────────────────────────────────────────
(() => {
  const sections = document.querySelectorAll('section[id]');
  if (!sections.length) return;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 120;
    sections.forEach(section => {
      const top = section.offsetTop, height = section.offsetHeight, id = section.getAttribute('id');
      const link = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (link) {
        if (scrollY >= top && scrollY < top + height) {
          document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
          link.classList.add('active');
        }
      }
    });
  }, { passive: true });
})();

// ──────────────────────────────────────────────────────────────
// Magnetic Buttons
// ──────────────────────────────────────────────────────────────
(() => {
  if ('ontouchstart' in window) return;
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
})();

// ──────────────────────────────────────────────────────────────
// Skill Node Hover
// ──────────────────────────────────────────────────────────────
(() => {
  document.querySelectorAll('.skill-node').forEach(node => {
    node.addEventListener('mouseenter', () => {
      const parent = node.parentElement;
      if (parent) parent.querySelectorAll('.skill-node').forEach(n => { if (n !== node) n.style.opacity = '0.4'; });
    });
    node.addEventListener('mouseleave', () => {
      const parent = node.parentElement;
      if (parent) parent.querySelectorAll('.skill-node').forEach(n => { n.style.opacity = ''; });
    });
  });
})();

console.log(`%c🏎️ Portfolio loaded | Tier: ${perf.tier} | Particles: ${perf.ambientParticles + perf.speedParticles + perf.dustParticles}`, 'color: #c41e3a; font-weight: bold;');
