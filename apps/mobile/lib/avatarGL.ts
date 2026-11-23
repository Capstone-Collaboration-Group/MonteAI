import type { ExpoWebGLRenderingContext } from 'expo-gl';

/**
 * Expo GL 16 only implements flip-Y and unpack alignment in pixelStorei.
 * The avatar's generated RGBA textures use straight alpha and need no browser
 * color conversion, but three.js still submits those two no-op defaults.
 * Skip only those defaults; keep supported calls and unexpected values visible.
 */
export function prepareAvatarGLContext(gl: ExpoWebGLRenderingContext): () => void {
  const originalPixelStorei = gl.pixelStorei;
  const pixelStorei: typeof gl.pixelStorei = (parameter, value) => {
    if (
      parameter === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL &&
      (value === false || value === 0)
    ) {
      return;
    }
    if (parameter === gl.UNPACK_COLORSPACE_CONVERSION_WEBGL && value === gl.NONE) {
      return;
    }
    originalPixelStorei.call(gl, parameter, value);
  };

  gl.pixelStorei = pixelStorei;
  return () => {
    // Do not overwrite another owner's wrapper if the context was changed.
    if (gl.pixelStorei === pixelStorei) gl.pixelStorei = originalPixelStorei;
  };
}
