interface EvlSmokeState {
  seen: boolean;
  fileName: string;
  fileType: string;
  svg: string;
}

interface Window {
  __evlSmoke?: EvlSmokeState;
}
