(() => {
  const supportsFinePointer =
    window.matchMedia?.("(pointer: fine)").matches ?? true;
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (!supportsFinePointer || prefersReducedMotion) {
    return;
  }

  const canvas = document.getElementById("cursor-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    return;
  }

  const config = {
    quantity: 28,
    baseRadius: 20,
    radiusScaleMin: 1,
    radiusScaleMax: 1.5,
    speedMin: 0.01,
    speedMax: 0.05,
    radiusEase: 0.02,
    followEase: 0.18,
    innerCount: 12,
    rotationSpeed: 0.02,
    outerParticleSizeMin: 2,
    outerParticleSizeMax: 6,
    innerParticleSizeMin: 2,
    innerParticleSizeMax: 4,
    sizeEase: 0.06,
    outerAlpha: 1,
    innerAlpha: 0.75,
    lineWidth: 0.5,
    lineAlpha: 0.3,
  };

  let canvasWidth = 0;
  let canvasHeight = 0;
  let devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);

  let pointerX = window.innerWidth * 0.5;
  let pointerY = window.innerHeight * 0.5;
  let pointerDown = false;

  let radiusScale = 1;

  const getAccentPalette = () => {
    const styles = getComputedStyle(document.documentElement);
    const values = [
      styles.getPropertyValue("--dataviz-accent"),
      styles.getPropertyValue("--dashboards-accent"),
      styles.getPropertyValue("--hci-accent"),
      styles.getPropertyValue("--management-accent"),
      styles.getPropertyValue("--gis-accent"),
      styles.getPropertyValue("--sustainability-accent"),
    ]
      .map((value) => value.trim())
      .filter(Boolean);

    return values.length
      ? values
      : ["#F2C94C", "#3554bb", "#7fe7ff", "#9b89ff", "#7dffb2", "#ffffff"];
  };

  let palette = getAccentPalette();

  const pickColor = () => {
    const color = palette[Math.floor(Math.random() * palette.length)];
    return color || "#ffffff";
  };

  const createParticle = ({ index, outerCount }) => {
    const isOuter = index < outerCount;
    const baseAngle = isOuter
      ? (index / outerCount) * Math.PI * 2
      : Math.random() * Math.PI * 2;

    const minSize = isOuter
      ? config.outerParticleSizeMin
      : config.innerParticleSizeMin;
    const maxSize = isOuter
      ? config.outerParticleSizeMax
      : config.innerParticleSizeMax;

    const startingRadius = minSize + Math.random() * (maxSize - minSize);

    return {
      radius: startingRadius,
      targetRadius: minSize + Math.random() * (maxSize - minSize),
      minSize,
      maxSize,
      alpha: isOuter ? config.outerAlpha : config.innerAlpha,
      position: { x: pointerX, y: pointerY },
      last: { x: pointerX, y: pointerY },
      offset: { x: 0, y: 0 },
      shift: { x: pointerX, y: pointerY },
      speed:
        config.speedMin + Math.random() * (config.speedMax - config.speedMin),
      fillColor: pickColor(),
      baseAngle,
      orbitFactor: isOuter ? 1 : 0.2 + Math.random() * 0.55,
      wobble: isOuter ? 0 : 0.35 + Math.random() * 0.65,
    };
  };

  const outerCount = Math.max(3, config.quantity - config.innerCount);
  const particles = Array.from({ length: config.quantity }, (_, index) =>
    createParticle({ index, outerCount })
  );

  let globalRotation = 0;

  const resize = () => {
    const nextDpr = Math.max(1, window.devicePixelRatio || 1);
    devicePixelRatio = nextDpr;

    canvasWidth = Math.floor(window.innerWidth * devicePixelRatio);
    canvasHeight = Math.floor(window.innerHeight * devicePixelRatio);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
  };

  const updatePointer = (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  };

  const onPointerDown = () => {
    pointerDown = true;
  };

  const onPointerUp = () => {
    pointerDown = false;
  };

  let rafId = 0;
  let isRunning = true;

  const draw = () => {
    if (!isRunning) {
      return;
    }

    if (pointerDown) {
      radiusScale += (config.radiusScaleMax - radiusScale) * config.radiusEase;
    } else {
      radiusScale -= (radiusScale - config.radiusScaleMin) * config.radiusEase;
    }

    radiusScale = Math.min(radiusScale, config.radiusScaleMax);

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Update positions first (so we can draw connecting lines cleanly)
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];

      particle.last.x = particle.position.x;
      particle.last.y = particle.position.y;

      particle.offset.x += particle.speed;
      particle.offset.y += particle.speed;

      particle.shift.x += (pointerX - particle.shift.x) * config.followEase;
      particle.shift.y += (pointerY - particle.shift.y) * config.followEase;

      const angle =
        particle.baseAngle +
        globalRotation +
        (particle.wobble ? Math.sin(particle.offset.x * 2) * 0.25 : 0);

      const orbit = config.baseRadius * particle.orbitFactor * radiusScale;

      particle.position.x = particle.shift.x + Math.cos(angle) * orbit;
      particle.position.y = particle.shift.y + Math.sin(angle) * orbit;

      particle.position.x = Math.max(
        Math.min(particle.position.x, window.innerWidth),
        0
      );
      particle.position.y = Math.max(
        Math.min(particle.position.y, window.innerHeight),
        0
      );

      particle.radius += (particle.targetRadius - particle.radius) * config.sizeEase;
      if (Math.abs(particle.targetRadius - particle.radius) < 0.05) {
        particle.targetRadius =
          particle.minSize +
          Math.random() * (particle.maxSize - particle.minSize);
      }
    }

    // Connect outer ring particles to inner particles with thin white lines
    context.globalAlpha = config.lineAlpha;
    context.strokeStyle = "white";
    context.lineWidth = config.lineWidth;
    context.beginPath();
    for (let i = 0; i < outerCount; i += 1) {
      const outerParticle = particles[i];
      const innerParticle =
        particles[outerCount + (i % Math.max(1, config.innerCount))];

      if (!innerParticle) {
        continue;
      }

      context.moveTo(outerParticle.position.x, outerParticle.position.y);
      context.lineTo(innerParticle.position.x, innerParticle.position.y);
    }
    context.stroke();

    // Draw dots on top
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      context.globalAlpha = particle.alpha;
      context.beginPath();
      context.fillStyle = particle.fillColor;
      context.arc(
        particle.position.x,
        particle.position.y,
        particle.radius / 2,
        0,
        Math.PI * 2,
        true
      );
      context.fill();
    }

    context.globalAlpha = 1;
    globalRotation += config.rotationSpeed;

    rafId = window.requestAnimationFrame(draw);
  };

  const pause = () => {
    isRunning = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resume = () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    rafId = window.requestAnimationFrame(draw);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  };

  const init = () => {
    resize();

    palette = getAccentPalette();
    for (const particle of particles) {
      particle.fillColor = pickColor();
    }

    rafId = window.requestAnimationFrame(draw);

    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (window.matchMedia) {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener?.("change", () => {
        if (query.matches) {
          pause();
        }
      });
    }

    const observer = new MutationObserver(() => {
      palette = getAccentPalette();
      for (const particle of particles) {
        particle.fillColor = pickColor();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
