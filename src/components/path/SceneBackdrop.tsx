/**
 * SceneBackdrop — one phase's world: a sky gradient + stylized silhouette art.
 * Rendered into the fixed backdrop stack; PathClient crossfades .is-active.
 * Silhouette fills are derived from the phase palette in CSS via color-mix,
 * so all art variants restyle themselves per phase (classes scene-l1..l3,
 * far → near). Placeholder art — photographic/illustrated plates land later.
 */
import type { SceneSpec } from "@/lib/journey";

function Stars({ n, seed }: { n: number; seed: number }) {
  const stars = [];
  for (let i = 0; i < n; i++) {
    // Rounded so server and client render byte-identical values (hydration).
    const s = Math.round((Math.abs(Math.sin(seed + i * 12.9898) * 43758.5453) % 1) * 1000) / 1000;
    const t = Math.round((Math.abs(Math.sin(seed + i * 78.233) * 12543.123) % 1) * 1000) / 1000;
    stars.push(
      // cy offset keeps stars inside the visible band of the bottom-anchored
      // art crop on wide viewports.
      <circle key={i} className="scene-star" cx={s * 1000} cy={200 + t * 170} r={t > 0.7 ? 1.8 : 1} />
    );
  }
  return <g>{stars}</g>;
}

function Art({ art }: { art: SceneSpec["art"] }) {
  switch (art) {
    case "sierra":
      return (
        <>
          <Stars n={70} seed={3} />
          <polygon className="scene-l1 scene-far" points="0,600 0,320 140,220 260,330 380,180 470,300 560,140 700,310 820,200 1000,340 1000,600" />
          <polygon className="scene-l2 scene-mid" points="0,600 0,420 180,320 330,430 500,300 660,440 840,340 1000,430 1000,600" />
          <polygon className="scene-l3 scene-near" points="0,600 0,520 220,440 430,530 640,450 850,540 1000,490 1000,600" />
        </>
      );
    case "meadow":
      return (
        <>
          <circle className="scene-sun" cx={780} cy={330} r={48} />
          <ellipse className="scene-l1 scene-far" cx={220} cy={640} rx={560} ry={230} />
          <ellipse className="scene-l2 scene-mid" cx={820} cy={680} rx={620} ry={250} />
          <g className="scene-l3 scene-near">
            <polygon points="150,600 150,470 120,510 150,470 180,510" />
            <polygon points="146,600 154,600 154,460 146,460" />
            <polygon points="150,455 122,512 178,512" />
            <polygon points="150,410 128,470 172,470" />
            <polygon points="870,600 878,600 878,480 870,480" />
            <polygon points="874,475 848,530 900,530" />
            <polygon points="874,435 854,492 894,492" />
          </g>
        </>
      );
    case "suburb":
      return (
        <>
          <circle className="scene-sun" cx={190} cy={300} r={46} />
          <g className="scene-l2 scene-mid">
            <polygon points="0,600 0,470 60,470 90,440 120,470 180,470 180,600" />
            <polygon points="220,600 220,450 280,410 340,450 340,600" />
            <polygon points="380,600 380,480 450,480 450,600" />
            <polygon points="470,600 470,440 520,405 570,440 570,600" />
            <polygon points="620,600 620,465 700,465 700,600" />
            <polygon points="730,600 730,435 790,400 850,435 850,600" />
            <polygon points="890,600 890,475 1000,475 1000,600" />
          </g>
          <rect className="scene-l3 scene-near" x={0} y={560} width={1000} height={40} />
        </>
      );
    case "ventures":
      return (
        <>
          <circle className="scene-sun" cx={500} cy={330} r={72} />
          <ellipse className="scene-l1 scene-far" cx={200} cy={660} rx={520} ry={240} />
          <ellipse className="scene-l2 scene-mid" cx={850} cy={700} rx={560} ry={260} />
          <g className="scene-l3 scene-near">
            <rect x={300} y={430} width={5} height={120} />
            <polygon className="scene-flag" points="305,430 355,442 305,456" />
            <rect x={700} y={470} width={5} height={90} />
            <polygon className="scene-flag" points="705,470 748,481 705,493" />
          </g>
        </>
      );
    case "campus":
      return (
        <>
          <g className="scene-l2 scene-mid">
            <rect x={80} y={430} width={150} height={170} />
            <rect x={260} y={480} width={110} height={120} />
            <rect x={640} y={460} width={140} height={140} />
            <rect x={820} y={430} width={100} height={170} />
          </g>
          {/* Geisel-ish tower */}
          <g className="scene-l3 scene-near">
            <rect x={480} y={410} width={40} height={190} />
            <polygon points="410,410 590,410 560,330 440,330" />
            <polygon points="425,330 575,330 552,275 448,275" />
            <rect x={412} y={404} width={176} height={10} />
            <rect x={427} y={324} width={146} height={9} />
          </g>
        </>
      );
    case "lab":
      return (
        <>
          <g className="scene-l2 scene-mid">
            <rect x={0} y={520} width={1000} height={80} />
            <rect x={120} y={430} width={70} height={90} />
            <rect x={300} y={455} width={110} height={65} />
            <rect x={700} y={440} width={60} height={80} />
            <rect x={820} y={470} width={120} height={50} />
          </g>
          <g className="scene-trace">
            <path d="M 0 300 Q 60 250, 120 300 T 240 300 T 360 300 T 480 300 T 600 300 T 720 300 T 840 300 T 1000 300" />
            <path d="M 0 360 Q 40 330, 80 360 T 160 360 T 240 360 T 320 360 T 400 360 T 480 360 T 560 360 T 640 360 T 720 360 T 800 360 T 880 360 T 1000 360" />
          </g>
        </>
      );
    case "braid":
      return (
        <g className="scene-braidBands">
          <path className="scene-l1" d="M 0 380 C 200 330, 300 430, 500 380 S 800 330, 1000 380 L 1000 600 L 0 600 Z" />
          <path className="scene-l2" d="M 0 450 C 250 400, 350 500, 550 450 S 850 400, 1000 460 L 1000 600 L 0 600 Z" />
          <path className="scene-l3" d="M 0 520 C 200 480, 400 560, 600 520 S 850 480, 1000 530 L 1000 600 L 0 600 Z" />
        </g>
      );
    case "nordic":
      return (
        <>
          <path className="scene-aurora" d="M 0 280 C 250 220, 420 330, 640 260 S 900 210, 1000 270" />
          <path className="scene-aurora scene-aurora2" d="M 0 330 C 260 270, 460 380, 680 310 S 920 260, 1000 320" />
          <g className="scene-l3 scene-near">
            <polygon points="180,600 180,480 230,430 280,480 280,600" />
            <polygon points="330,600 330,500 372,455 414,500 414,600" />
            <polygon points="640,600 640,490 690,440 740,490 740,600" />
            <rect x={0} y={560} width={1000} height={40} />
          </g>
        </>
      );
    case "industrial":
      return (
        <>
          <Stars n={40} seed={11} />
          <g className="scene-l2 scene-mid">
            <rect x={60} y={420} width={220} height={180} />
            <rect x={300} y={480} width={160} height={120} />
            <rect x={640} y={400} width={90} height={200} />
            <rect x={760} y={470} width={200} height={130} />
            <rect x={700} y={300} width={8} height={140} />
            <rect x={660} y={300} width={120} height={8} />
          </g>
          <g className="scene-lightdots">
            <circle cx={120} cy={470} r={3} />
            <circle cx={200} cy={470} r={3} />
            <circle cx={680} cy={430} r={3} />
            <circle cx={820} cy={510} r={3} />
          </g>
        </>
      );
    case "runup":
      return (
        <>
          <g className="scene-rays">
            <polygon points="500,430 380,120 440,120" />
            <polygon points="500,430 560,110 620,120" />
            <polygon points="500,430 220,200 260,160" />
            <polygon points="500,430 740,160 780,210" />
          </g>
          <circle className="scene-sun" cx={500} cy={430} r={80} />
          <ellipse className="scene-l2 scene-mid" cx={180} cy={680} rx={520} ry={240} />
          <ellipse className="scene-l3 scene-near" cx={860} cy={700} rx={520} ry={250} />
        </>
      );
    case "sanfrancisco":
      return (
        <>
          <circle className="scene-sun" cx={840} cy={290} r={58} />
          <g className="scene-l1 scene-far">
            <rect x={40} y={380} width={70} height={220} />
            <rect x={130} y={420} width={90} height={180} />
            <rect x={560} y={400} width={80} height={200} />
            <rect x={660} y={430} width={70} height={170} />
            <rect x={900} y={410} width={70} height={190} />
          </g>
          <g className="scene-l2 scene-mid">
            {/* pyramid tower */}
            <polygon points="380,600 380,560 410,300 430,300 460,560 460,600" />
            <rect x={490} y={370} width={80} height={230} />
            <rect x={250} y={410} width={90} height={190} />
            <rect x={740} y={380} width={90} height={220} />
          </g>
          <rect className="scene-fog" x={0} y={480} width={1000} height={70} rx={35} />
          <g className="scene-l3 scene-near">
            {/* bridge towers + cable */}
            <rect x={80} y={330} width={14} height={160} />
            <rect x={260} y={330} width={14} height={160} />
            <path d="M 0 380 Q 170 470, 340 380" fill="none" className="scene-cable" />
            <rect x={0} y={488} width={360} height={10} />
          </g>
        </>
      );
    case "delta":
      return (
        <>
          <g>
            <path className="scene-l1" d="M 0 430 C 300 410, 700 450, 1000 420 L 1000 600 L 0 600 Z" />
            <path className="scene-l2" d="M 0 490 C 300 470, 700 510, 1000 480 L 1000 600 L 0 600 Z" />
            <path className="scene-l3" d="M 0 550 C 300 530, 700 570, 1000 545 L 1000 600 L 0 600 Z" />
          </g>
          <g className="scene-reeds">
            <path d="M 120 600 C 118 540, 128 520, 122 490" />
            <path d="M 140 600 C 142 550, 132 530, 140 505" />
            <path d="M 860 600 C 858 545, 868 525, 862 495" />
            <path d="M 882 600 C 884 555, 874 535, 882 510" />
          </g>
        </>
      );
    case "sea":
      return (
        <g>
          <path className="scene-l1" d="M 0 400 C 200 380, 400 420, 600 400 S 900 380, 1000 400 L 1000 600 L 0 600 Z" />
          <path className="scene-l2" d="M 0 460 C 250 440, 450 480, 700 460 S 950 445, 1000 460 L 1000 600 L 0 600 Z" />
          <path className="scene-l3" d="M 0 520 C 200 505, 500 540, 750 520 S 950 510, 1000 522 L 1000 600 L 0 600 Z" />
        </g>
      );
  }
}

interface Props {
  scene: SceneSpec;
  active: boolean;
}

export default function SceneBackdrop({ scene, active }: Props) {
  const { palette } = scene;
  return (
    <div
      className={`sceneBackdrop sceneBackdrop--${scene.light}${active ? " is-active" : ""}`}
      style={
        {
          "--sky": palette.sky,
          "--skyLow": palette.skyLow,
          "--water": palette.water,
          "--accent": palette.accent,
          "--ink": palette.ink,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <div className="sceneSky" />
      <svg className="sceneArt" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice">
        <Art art={scene.art} />
      </svg>
      <div className="sceneVignette" />
    </div>
  );
}
