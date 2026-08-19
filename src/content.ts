import { LatexConversionController } from "./controller";
import { warmMathJax } from "./latex/renderer";

const controller = new LatexConversionController();
controller.start();

void warmMathJax().catch(() => {
  // A real conversion reports the actionable error while preserving the source.
});
