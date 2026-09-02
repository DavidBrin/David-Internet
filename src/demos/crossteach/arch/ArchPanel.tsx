"use client";

/** #architectures — U-Net vs ViT, inside. Prefix ctA. */
import { useEffect, useState } from "react";
import "./arch.css";
import UnetDiagram from "./UnetDiagram";
import VitDiagram from "./VitDiagram";
import DetectorCard from "./DetectorCard";
import { IMAGE_IDS, DEFAULT_IMAGE_ID, type ActivationsData, type AttentionData, type ImageId } from "./types";

export default function ArchPanel() {
  const [actData, setActData] = useState<ActivationsData | null>(null);
  const [attnData, setAttnData] = useState<AttentionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageId, setImageId] = useState<ImageId>(DEFAULT_IMAGE_ID);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/demos/crossteach/act/activations.json").then((r) => {
        if (!r.ok) throw new Error(`activations.json ${r.status}`);
        return r.json() as Promise<ActivationsData>;
      }),
      fetch("/demos/crossteach/attention/attention.json").then((r) => {
        if (!r.ok) throw new Error(`attention.json ${r.status}`);
        return r.json() as Promise<AttentionData>;
      }),
    ])
      .then(([act, attn]) => {
        if (cancelled) return;
        setActData(act);
        setAttnData(attn);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const imageActs = actData?.images.find((i) => i.id === imageId) ?? null;

  return (
    <div className="ctPanel">
      <h2 className="ctH2">U-Net vs ViT, inside</h2>
      <p className="ctIntro">
        The U-Net&apos;s convolutions read texture through a growing receptive field - conv1 sees edges, layer4 sees
        whole shapes - with skip connections carrying the fine detail lost to downsampling back to the decoder. The
        ViT chops the image into 196 patches and lets every patch attend to every other patch from layer one, no
        growing required. Cross-teaching pairs the two because they make different mistakes: local precision against
        global context.
      </p>

      <div className="ctARow ctAPicker">
        {IMAGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="ctAThumb"
            data-active={id === imageId}
            onClick={() => setImageId(id)}
            aria-label={`Show ${id}`}
            title={id}
          >
            <img src={`/demos/crossteach/input/${id}.webp`} alt={id} />
          </button>
        ))}
      </div>

      {error && <p className="ctNote ctAError">Could not load architecture data ({error}).</p>}
      {!error && (!actData || !attnData) && <p className="ctNote">Loading checkpoint data...</p>}

      {actData && attnData && (
        <div className="ctASplit">
          <UnetDiagram imageId={imageId} stages={imageActs?.stages ?? []} />
          <VitDiagram imageId={imageId} layers={attnData.layers} heads={attnData.heads} />
        </div>
      )}

      <DetectorCard />
    </div>
  );
}
