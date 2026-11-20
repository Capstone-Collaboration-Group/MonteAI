package expo.modules.verificationcamera

import android.graphics.Bitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.sharedobjects.SharedRef

class VerificationCameraModule : Module() {
  private var probe: CaptureFileWriteProbe? = null

  override fun definition() = ModuleDefinition {
    Name("VerificationCamera")

    Function("getCapabilities") {
      mapOf("policy" to CAPTURE_POLICY, "fileProbeSupported" to BuildConfig.DEBUG)
    }

    AsyncFunction("encodeJpeg") { picture: SharedRef<Bitmap>, crop: GuideCrop ->
      MemoryJpegEncoder.encode(picture.ref, crop)
    }

    Function("disposePicture") { picture: SharedRef<Bitmap> ->
      MemoryJpegEncoder.dispose(picture.ref)
    }

    Function("beginFileWriteProbe") {
      probe?.stop()
      val context = appContext.reactContext ?: throw MemoryImageException()
      probe = CaptureFileWriteProbe(context)
      probe!!.start()
    }

    Function("endFileWriteProbe") {
      probe?.stop() ?: CaptureFileWriteProbe.unavailableReport()
    }

    Function("getFileWriteReport") {
      probe?.report() ?: CaptureFileWriteProbe.unavailableReport()
    }

    OnDestroy { probe?.stop(); probe = null }
  }
}
