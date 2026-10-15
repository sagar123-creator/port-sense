/** Local fallback globe texture — no Mapbox, no NASA key, no CDN watermark. */
export function makeEarthTexture(): string {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#041428");
  ocean.addColorStop(0.45, "#0a3d6e");
  ocean.addColorStop(1, "#041428");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const project = (lng: number, lat: number): [number, number] => [
    ((lng + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  const fillRing = (ring: ReadonlyArray<readonly [number, number]>, fill: string) => {
    if (ring.length < 3) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ring.forEach((pt, i) => {
      const [x, y] = project(pt[0], pt[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };

  const land = "#1f6b45";
  const ice = "#d7e3ec";

  fillRing(
    [
      [-168, 65],
      [-141, 70],
      [-125, 49],
      [-95, 49],
      [-83, 44],
      [-80, 25],
      [-97, 26],
      [-105, 22],
      [-117, 32],
      [-125, 40],
      [-153, 59],
      [-168, 65],
    ],
    "#245c3a",
  );
  fillRing(
    [
      [-81, 8],
      [-60, 5],
      [-35, -7],
      [-48, -28],
      [-70, -50],
      [-75, -18],
      [-80, 0],
      [-81, 8],
    ],
    land,
  );
  fillRing(
    [
      [-10, 36],
      [10, 38],
      [28, 42],
      [40, 45],
      [40, 36],
      [12, 30],
      [-9, 32],
      [-10, 36],
    ],
    land,
  );
  fillRing(
    [
      [-17, 20],
      [12, 32],
      [32, 31],
      [51, 12],
      [40, -5],
      [18, -35],
      [12, 5],
      [-14, 10],
      [-17, 20],
    ],
    land,
  );
  fillRing(
    [
      [44, 12],
      [60, 25],
      [77, 8],
      [91, 22],
      [122, 22],
      [142, 50],
      [100, 55],
      [60, 50],
      [44, 24],
      [44, 12],
    ],
    land,
  );
  fillRing(
    [
      [68, 24],
      [88, 22],
      [80, 8],
      [73, 18],
      [68, 24],
    ],
    "#2f7a4c",
  );
  fillRing(
    [
      [113, -11],
      [153, -12],
      [150, -38],
      [115, -35],
      [113, -11],
    ],
    land,
  );
  fillRing(
    [
      [-55, 60],
      [-20, 70],
      [-45, 83],
      [-73, 78],
      [-55, 60],
    ],
    ice,
  );
  fillRing(
    [
      [40, 70],
      [140, 72],
      [100, 78],
      [40, 70],
    ],
    ice,
  );

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = project(0, lat)[1];
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  return canvas.toDataURL("image/jpeg", 0.82);
}
