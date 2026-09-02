/** Data shapes for /demos/crossteach/curves.json and /demos/crossteach/microct/microct.json. */

export interface SupervisedHistoryEntry {
  epoch: number;
  train_loss: number;
  val_loss: number;
  val_dice: number;
  val_iou: number;
  val_pixel_accuracy: number;
}

export interface TestMetrics {
  loss: number;
  dice: number;
  iou: number;
  pixel_accuracy: number;
}

export interface SupervisedRun {
  model: string;
  setting: string;
  labeled_fraction: number;
  best_val_dice: number;
  history: SupervisedHistoryEntry[];
  test_metrics: TestMetrics;
}

export interface CrossTeachHistoryEntry {
  epoch: number;
  unet_supervised_loss: number;
  vit_supervised_loss: number;
  unet_consistency_loss: number;
  vit_consistency_loss: number;
  unet_confident_image_ratio: number;
  vit_confident_image_ratio: number;
  unet_val_loss: number;
  unet_val_dice: number;
  unet_val_iou: number;
  vit_val_loss: number;
  vit_val_dice: number;
  vit_val_iou: number;
  ensemble_val_dice: number;
  ensemble_val_iou: number;
  ensemble_val_pixel_accuracy: number;
}

export interface SubModelMetrics {
  loss?: number;
  dice: number;
  iou: number;
  pixel_accuracy: number;
}

export interface CrossTeachRun {
  model: string;
  setting: string;
  labeled_fraction: number;
  unlabeled_fraction: number;
  confidence_threshold: number;
  consistency_weight: number;
  consistency_warmup_epochs: number;
  best_val_ensemble_dice: number;
  history: CrossTeachHistoryEntry[];
  test_metrics: {
    unet: SubModelMetrics;
    vit: SubModelMetrics;
    ensemble: SubModelMetrics;
  };
}

export interface CheckpointReEval {
  model: string;
  setting: string;
  notes: string;
  labeled_fraction: number;
  unlabeled_fraction: number;
  confidence_threshold: number;
  consistency_weight: number;
  consistency_warmup_epochs: number;
  best_val_dice_from_checkpoint: number;
  validation_metrics: {
    unet: SubModelMetrics;
    vit: SubModelMetrics;
    ensemble: SubModelMetrics;
  };
}

export interface FinalEvalRow {
  model: string;
  dice: number;
  iou: number;
  pixelAccuracy: number;
}

export interface CurvesConfig {
  labeledFraction: number;
  valFraction: number;
  epochs: number;
  batchSize: number;
  lr: number;
  confidenceThreshold: number;
  consistencyWeight: number;
  warmupEpochs: number;
  unetSize: number;
  vitSize: number;
  note: string;
}

export interface CurvesData {
  unetSupervised: SupervisedRun;
  vitSupervised: SupervisedRun;
  crossTeaching: CrossTeachRun;
  checkpointReEval: CheckpointReEval;
  finalEval: { file: string; rows: FinalEvalRow[] };
  config: CurvesConfig;
}

export interface MicroctSliceMeta {
  id: string;
  poreFraction: number;
}

export interface MicroctData {
  slices: MicroctSliceMeta[];
  source: string;
  report: {
    labeled: number;
    unlabeled: number;
    dice: {
      unetSupervised: number;
      vitSupervised: number;
      unetCrossTeaching: number;
      vitCrossTeaching: number;
    };
    note: string;
  };
}
